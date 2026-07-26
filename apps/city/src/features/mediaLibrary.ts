import type {
  ProfileMediaAsset,
  ProfileMediaKind,
  ProfileMediaPurpose,
  ProjectMediaType,
  UserProfile,
} from "./profile";
import { isGuestSession } from "./session";
import { supabase } from "../lib/supabase";
import { repairProfileMediaBindings } from "./profileMediaBindings";

const DB_NAME = "creator-city-media";
const DB_VERSION = 1;
const STORE_NAME = "assets";
const BUCKET_NAME = "creator-media";
const guestMedia = new Map<string, Blob>();

type StoredMedia = { id: string; blob: Blob };
type MediaMetadata = Pick<ProfileMediaAsset, "durationInSeconds" | "width" | "height">;
type StoreMediaOptions = {
  projectId?: string;
  experienceId?: string;
  purpose?: ProfileMediaPurpose;
  comment?: string;
};

function openMediaDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("当前浏览器不支持本地媒体库"));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("无法打开本地媒体库"));
  });
}

function mediaId() {
  return `media-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "upload";
}

export function inferMediaKind(file: File): ProfileMediaKind | null {
  if (file.type.startsWith("video/")) return "project-video";
  if (file.type.startsWith("image/")) return "project-image";
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return /(?:resume|cv|简历)/i.test(file.name) ? "resume" : "project-document";
  }
  return null;
}

export function mediaTypeForKind(kind: ProfileMediaKind): ProjectMediaType | undefined {
  if (kind === "project-video") return "video";
  if (kind === "project-image") return "image";
  if (kind === "project-document") return "document";
  return undefined;
}

export function defaultPurposeForKind(kind: ProfileMediaKind): ProfileMediaPurpose {
  if (kind === "project-video") return "demo";
  if (kind === "project-image") return "photo";
  if (kind === "project-document") return "document";
  return "resume";
}

async function inspectImage(file: File): Promise<MediaMetadata> {
  const url = URL.createObjectURL(file);
  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error("无法读取图片尺寸"));
      image.src = url;
    });
    return dimensions;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function inspectVideo(file: File): Promise<MediaMetadata> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<MediaMetadata>((resolve, reject) => {
      const video = document.createElement("video");
      const timer = window.setTimeout(() => reject(new Error("读取视频信息超时")), 12000);
      video.preload = "metadata";
      video.muted = true;
      video.onloadedmetadata = () => {
        window.clearTimeout(timer);
        resolve({
          durationInSeconds: Number.isFinite(video.duration) ? Math.round(video.duration * 10) / 10 : undefined,
          width: video.videoWidth || undefined,
          height: video.videoHeight || undefined,
        });
      };
      video.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error("无法读取视频信息"));
      };
      video.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function inspectMediaFile(file: File): Promise<MediaMetadata> {
  try {
    if (file.type.startsWith("video/")) return await inspectVideo(file);
    if (file.type.startsWith("image/")) return await inspectImage(file);
  } catch {
    // Metadata improves editing, but a decodable file should still be uploadable.
  }
  return {};
}

export async function storeMediaFile(file: File, kind: ProfileMediaKind, options: StoreMediaOptions = {}): Promise<ProfileMediaAsset> {
  const id = mediaId();
  const metadata = await inspectMediaFile(file);
  const guest = isGuestSession();
  if (!guest) {
    try {
      const database = await openMediaDatabase();
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).put({ id, blob: file } satisfies StoredMedia);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error("媒体保存失败"));
        transaction.onabort = () => reject(transaction.error || new Error("媒体保存已取消"));
      });
      database.close();
    } catch {
      // IndexedDB is a local preview cache; Supabase Storage remains the source of truth.
    }
  }
  const asset: ProfileMediaAsset = {
    id,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    kind,
    purpose: options.purpose || defaultPurposeForKind(kind),
    createdAt: new Date().toISOString(),
    projectId: options.projectId,
    experienceId: options.experienceId,
    comment: options.comment || "",
    analysisStatus: "pending",
    narrativeBeats: [],
    ...metadata,
  };
  if (guest) guestMedia.set(id, file);
  else {
    await saveMediaToCloud(asset, file).catch((error) => {
      console.warn("Failed to upload Supabase media", error instanceof Error ? error.message : error);
    });
  }
  return asset;
}

export async function getMediaBlob(id: string): Promise<Blob | null> {
  if (isGuestSession()) return guestMedia.get(id) || null;
  try {
  const database = await openMediaDatabase();
  const result = await new Promise<StoredMedia | undefined>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result as StoredMedia | undefined);
    request.onerror = () => reject(request.error || new Error("媒体读取失败"));
  });
  database.close();
  if (result?.blob) return result.blob;
  } catch {
    // Fall through to Supabase Storage.
  }
  return downloadMediaFromCloud(id);
}

export async function deleteMediaFile(id: string): Promise<void> {
  if (isGuestSession()) {
    guestMedia.delete(id);
    return;
  }
  try {
  const database = await openMediaDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("媒体删除失败"));
  });
  database.close();
  } catch {
    // Best effort local cache delete.
  }
  await deleteMediaFromCloud(id).catch((error) => {
    console.warn("Failed to delete Supabase media", error instanceof Error ? error.message : error);
  });
}

async function saveMediaToCloud(asset: ProfileMediaAsset, file: File): Promise<void> {
  if (!supabase) return;
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;
  const storagePath = `${userId}/${asset.kind}/${asset.id}-${safeFileName(file.name)}`;
  const upload = await supabase.storage.from(BUCKET_NAME).upload(storagePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });
  if (upload.error) throw upload.error;
  const { error } = await supabase.from("media_assets").upsert({
    id: asset.id,
    user_id: userId,
    file_name: asset.name,
    storage_path: storagePath,
    mime_type: asset.mimeType,
    size_bytes: asset.size,
    category: asset.kind,
    metadata_json: {
      purpose: asset.purpose,
      projectId: asset.projectId ?? null,
      experienceId: asset.experienceId ?? null,
      comment: asset.comment,
      durationInSeconds: asset.durationInSeconds ?? null,
      width: asset.width ?? null,
      height: asset.height ?? null,
    },
  });
  if (error) throw error;
}

async function downloadMediaFromCloud(id: string): Promise<Blob | null> {
  if (!supabase) return null;
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;
  const { data: row } = await supabase
    .from("media_assets")
    .select("storage_path")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!row?.storage_path) return null;
  const { data, error } = await supabase.storage.from(BUCKET_NAME).download(row.storage_path);
  if (error || !data) return null;
  return data;
}

async function deleteMediaFromCloud(id: string): Promise<void> {
  if (!supabase) return;
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;
  const { data: row } = await supabase
    .from("media_assets")
    .select("storage_path")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (row?.storage_path) await supabase.storage.from(BUCKET_NAME).remove([row.storage_path]);
  await supabase.from("media_assets").delete().eq("id", id).eq("user_id", userId);
}

function waitForSeek(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("视频抽帧超时")), 8000);
    video.onseeked = () => { window.clearTimeout(timer); resolve(); };
    video.onerror = () => { window.clearTimeout(timer); reject(new Error("视频抽帧失败")); };
    video.currentTime = time;
  });
}

function frameFromCanvas(source: CanvasImageSource, sourceWidth: number, sourceHeight: number) {
  const maxWidth = 720;
  const scale = Math.min(1, maxWidth / Math.max(1, sourceWidth));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器无法创建抽帧画布");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.74);
}

export async function extractMediaFrames(file: Blob, count = 4): Promise<string[]> {
  if (file.type.startsWith("image/")) {
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("图片预览失败"));
        element.src = url;
      });
      return [frameFromCanvas(image, image.naturalWidth, image.naturalHeight)];
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  if (!file.type.startsWith("video/")) return [];

  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("视频加载超时")), 12000);
      video.onloadeddata = () => { window.clearTimeout(timer); resolve(); };
      video.onerror = () => { window.clearTimeout(timer); reject(new Error("视频加载失败")); };
      video.src = url;
      video.load();
    });
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    const times = Array.from({ length: Math.max(1, count) }, (_, index) => duration * (0.08 + (0.84 * index) / Math.max(1, count - 1)));
    const frames: string[] = [];
    for (const time of times) {
      await waitForSeek(video, Math.max(0, Math.min(duration - 0.02, time)));
      frames.push(frameFromCanvas(video, video.videoWidth || 1280, video.videoHeight || 720));
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function resolveProfileMedia(profile: UserProfile): Promise<{ profile: UserProfile; revoke: () => void }> {
  const repairedProfile = repairProfileMediaBindings(profile);
  const objectUrls: string[] = [];
  const mediaAssets = await Promise.all(repairedProfile.mediaAssets.map(async (asset) => {
    try {
      const blob = await getMediaBlob(asset.id);
      if (!blob) return { ...asset, runtimeStatus: "missing" as const, runtimeError: "浏览器本地媒体库中未找到原文件，请重新上传。" };
      const runtimeUrl = URL.createObjectURL(blob);
      objectUrls.push(runtimeUrl);
      return { ...asset, runtimeUrl, runtimeStatus: "ready" as const, runtimeError: undefined };
    } catch (error) {
      return { ...asset, runtimeStatus: "error" as const, runtimeError: error instanceof Error ? error.message : "读取本地媒体失败" };
    }
  }));
  const assetMap = new Map(mediaAssets.map((asset) => [asset.id, asset]));
  const projects = repairedProfile.projects.map((project) => {
    const assetIds = project.mediaAssetIds.length ? project.mediaAssetIds : project.mediaAssetId ? [project.mediaAssetId] : [];
    const resolvedAssets = assetIds.map((id) => assetMap.get(id)).filter((asset) => Boolean(asset?.runtimeUrl)) as ProfileMediaAsset[];
    const firstAsset = resolvedAssets.find((asset) => asset.kind === "project-video") || resolvedAssets[0];
    if (!firstAsset?.runtimeUrl) return { ...project, mediaAssetIds: assetIds };
    return {
      ...project,
      mediaAssetIds: assetIds,
      mediaAssetId: firstAsset.id,
      mediaUrl: firstAsset.runtimeUrl,
      mediaType: mediaTypeForKind(firstAsset.kind) || project.mediaType,
    };
  });
  return { profile: { ...repairedProfile, projects, mediaAssets }, revoke: () => objectUrls.forEach((url) => URL.revokeObjectURL(url)) };
}

export function formatMediaSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
