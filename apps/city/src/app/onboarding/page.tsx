"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Clapperboard, Clock3, FileStack, FileText, GitFork, Image as ImageIcon, Link2, LoaderCircle, Map as MapIcon, MessageSquareText, Palette, ScanLine, Sparkles, Trash2, UploadCloud, UserRound, Video, WandSparkles } from "lucide-react";
import {
  createEmptyProfile,
  createEmptyProject,
  loadProfile,
  loadCloudProfile,
  normalizeProfile,
  saveProfile,
  type CreatorAward,
  type CreatorEducation,
  type CreatorExperience,
  type CreatorMetric,
  type CreatorProject,
  type ProfileMediaAsset,
  type ProfileMediaPurpose,
  type UserProfile,
  type VideoTheme,
} from "@/features/profile";
import { deleteMediaFile, extractMediaFrames, formatMediaSize, getMediaBlob, inferMediaKind, mediaTypeForKind, storeMediaFile } from "@/features/mediaLibrary";
import { buildLocalMediaNarrative, mediaPurposeLabels, narrativePhaseLabels, normalizeNarrativeBeats, shouldRegenerateNarrative } from "@/features/mediaNarrative";
import { normalizedProjectKey, repairProfileMediaBindings } from "@/features/profileMediaBindings";
import { loadSession } from "@/features/session";
import { LightRays } from "@/components/motion/LightRays";

type ImportState = "idle" | "loading" | "done" | "error";

const steps = [
  { id: 1, title: "资料与媒体", icon: Link2 },
  { id: 2, title: "经历", icon: UserRound },
  { id: 3, title: "证据", icon: BarChart3 },
  { id: 4, title: "项目编排", icon: Clapperboard },
];

const sourceRail = [
  { label: "GitHub", icon: GitFork },
  { label: "简历", icon: FileText },
  { label: "视频", icon: Video },
  { label: "图片", icon: ImageIcon },
  { label: "文档", icon: FileStack },
];

const themeOptions: Array<{ id: VideoTheme; label: string; caption: string; mark: string; colors: [string, string, string] }> = [
  { id: "beijing-night", label: "京城夜幕", caption: "朱红、琉璃与城市网格", mark: "京", colors: ["#111816", "#d84d42", "#72c8b4"] },
  { id: "paper-archive", label: "纸上档案", caption: "宣纸、朱砂与编辑刻度", mark: "卷", colors: ["#faf8f2", "#bd302d", "#d2a64b"] },
  { id: "signal-lab", label: "信号实验室", caption: "黑场、荧光与数据脉冲", mark: "讯", colors: ["#080d0c", "#31d3a2", "#ffb547"] },
  { id: "gallery-white", label: "先锋展厅", caption: "高亮留白与现代原色", mark: "展", colors: ["#ffffff", "#295fd6", "#f04438"] },
];

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const splitList = (value: string) => value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean);

function githubName(value: string) {
  const clean = value.trim().replace(/^@/, "");
  const match = clean.match(/github\.com\/([^/?#]+)/i);
  return match?.[1] || clean;
}

type GithubProject = { name: string; desc: string; url: string; tech: string[] };

const isPlaceholderText = (value: string | undefined) => !value?.trim() || /^(?:no description|待补充|暂无)/i.test(value.trim());

function mergeGithubProjects(current: UserProfile, incoming: GithubProject[]) {
  const usedIds = new Set<string>();
  const imported = incoming.map((item, index) => {
    const key = normalizedProjectKey(item);
    const existing = current.projects.find((project) => !usedIds.has(project.id) && (
      normalizedProjectKey(project) === key
      || project.name.trim().toLowerCase() === item.name.trim().toLowerCase()
    ));
    if (!existing) {
      return {
        ...createEmptyProject(index),
        name: item.name,
        desc: isPlaceholderText(item.desc) ? "" : item.desc,
        url: item.url,
        tech: item.tech,
        presentationMode: "browser" as const,
      };
    }
    usedIds.add(existing.id);
    return {
      ...existing,
      name: item.name || existing.name,
      desc: isPlaceholderText(existing.desc) && !isPlaceholderText(item.desc) ? item.desc : existing.desc,
      url: item.url || existing.url,
      tech: [...new Set([...existing.tech, ...item.tech])],
    };
  });
  return [...imported, ...current.projects.filter((project) => !usedIds.has(project.id))];
}

function Field({ label, value, onChange, placeholder, multiline = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; multiline?: boolean }) {
  return (
    <label className="story-field block text-sm font-black">
      {label}
      {multiline ? <textarea className="studio-input mt-2 min-h-24 resize-y font-normal" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /> : <input className="studio-input mt-2 font-normal" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />}
    </label>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button className="studio-icon-button story-remove-button" type="button" aria-label={label} title={label} onClick={onClick}><Trash2 size={16} /></button>;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>(() => createEmptyProfile());
  const [step, setStep] = useState(1);
  const [projectInput, setProjectInput] = useState("");
  const [importState, setImportState] = useState<ImportState>("idle");
  const [message, setMessage] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [analyzingId, setAnalyzingId] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const initializedRef = useRef(false);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    sessionStorage.removeItem("creator-city-arrival");
    const session = loadSession();
    if (!session) {
      router.replace("/");
      return;
    }
    void loadCloudProfile().then((existing) => {
      const baseProfile = repairProfileMediaBindings(existing || loadProfile() || normalizeProfile({ ...createEmptyProfile(), name: session.displayName }));
      const refreshedProfile = {
        ...baseProfile,
        mediaAssets: baseProfile.mediaAssets.map((asset) => shouldRegenerateNarrative(asset.narrativeBeats)
          ? { ...asset, analysisStatus: "draft" as const, narrativeBeats: buildLocalMediaNarrative(asset, baseProfile) }
          : asset),
      };
      profileRef.current = refreshedProfile;
      setProfile(refreshedProfile);
      saveProfile(refreshedProfile);
      setHydrated(true);
    });
  }, [router]);

  useEffect(() => {
    if (!hydrated) return;
    const timeout = window.setTimeout(() => saveProfile(profile), 220);
    return () => window.clearTimeout(timeout);
  }, [hydrated, profile]);

  const update = (patch: Partial<UserProfile> | ((current: UserProfile) => Partial<UserProfile>)) => setProfile((current) => {
    const next = {
      ...current,
      ...(typeof patch === "function" ? patch(current) : patch),
      updatedAt: new Date().toISOString(),
    };
    profileRef.current = next;
    return next;
  });
  const coverage = useMemo(() => [
    ["经历", profile.experiences.length + profile.education.length],
    ["结果", profile.metrics.length + profile.awards.length],
    ["项目", profile.projects.length],
    ["研究", profile.papers.length],
  ] as const, [profile]);

  const importGithub = async () => {
    const username = githubName(profile.githubUsername);
    if (!username) return;
    update({ githubUsername: username });
    setImportState("loading");
    setMessage("");
    try {
      const response = await fetch(`/api/github/user?username=${encodeURIComponent(username)}`);
      const json = await response.json();
      if (!json.ok) throw new Error(json.error || "GitHub 暂时不可用");
      const incoming = json.data.projects as GithubProject[];
      setProfile((current) => {
        const projects = mergeGithubProjects(current, incoming);
        const beforeProjectIds = new Map(current.mediaAssets.map((asset) => [asset.id, asset.projectId]));
        const merged = repairProfileMediaBindings({
          ...current,
          name: json.data.name || current.name,
          bio: json.data.bio || current.bio,
          projects,
          projectLinks: [...new Set([...projects.map((item) => item.url || ""), ...current.projectLinks].filter(Boolean))],
          skills: json.data.languages.map((name: string, index: number) => ({ name, level: Math.max(64, 86 - index * 4), evidence: "GitHub 公开项目" })),
          updatedAt: new Date().toISOString(),
        });
        const repaired = {
          ...merged,
          mediaAssets: merged.mediaAssets.map((asset) => {
            const rebound = beforeProjectIds.get(asset.id) !== asset.projectId;
            return rebound || shouldRegenerateNarrative(asset.narrativeBeats)
              ? { ...asset, analysisStatus: "draft" as const, narrativeBeats: buildLocalMediaNarrative(asset, merged) }
              : asset;
          }),
        };
        profileRef.current = repaired;
        saveProfile(repaired);
        return repaired;
      });
      setImportState("done");
      setMessage(`已合并 ${incoming.length} 个项目并保留原素材绑定，读取到 ${json.data.languages.length} 项技术`);
    } catch (error) {
      setImportState("error");
      setMessage(error instanceof Error ? `${error.message}，可继续手动填写` : "导入失败，可继续手动填写");
    }
  };

  const addProjectLink = () => {
    const value = projectInput.trim();
    if (!value) return;
    update((current) => ({
      projectLinks: [...current.projectLinks, value],
      projects: [...current.projects, { ...createEmptyProject(current.projects.length), name: value.split("/").filter(Boolean).pop() || "Project", desc: "", url: value, tech: [], presentationMode: "browser" }],
    }));
    setProjectInput("");
  };

  const readResume = async (file?: File) => {
    if (!file) return;
    setImportState("loading");
    setMessage(`正在提取 ${file.name}…`);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/profile/extract", { method: "POST", body: formData });
      const json = await response.json();
      if (!json.ok) throw new Error(json.error || "文件解析失败");
      update({ resume: json.data.text });
      setImportState("done");
      setMessage(`已从 ${json.data.fileName} 提取 ${json.data.characters} 个字符`);
    } catch (error) {
      setImportState("error");
      setMessage(error instanceof Error ? error.message : "文件解析失败，请粘贴简历文字");
    }
  };

  const addMediaFiles = async (files: FileList | File[], preferredProjectId?: string) => {
    const accepted = Array.from(files).filter((file) => inferMediaKind(file));
    if (!accepted.length) {
      setImportState("error");
      setMessage("请选择 MP4 / WebM / MOV 视频、PNG / JPG / WebP 图片或 PDF 简历");
      return;
    }
    setImportState("loading");
    setMessage(`正在保存 ${accepted.length} 个文件…`);
    try {
      let nextProfile = profile;
      let extractedResume = "";
      for (const file of accepted) {
        if (file.size > 250 * 1024 * 1024) throw new Error(`${file.name} 超过 250 MB，请先压缩后上传`);
        const kind = inferMediaKind(file)!;
        let targetProject = kind === "resume" ? undefined : nextProfile.projects.find((project) => project.id === preferredProjectId) || nextProfile.projects[0];
        if (kind !== "resume" && !targetProject) {
          targetProject = { ...createEmptyProject(0), name: file.name.replace(/\.[^.]+$/, ""), desc: "上传的项目演示素材", presentationMode: kind === "project-video" ? "live" : "browser" };
          nextProfile = { ...nextProfile, projects: [targetProject] };
        }
        const storedAsset = await storeMediaFile(file, kind, { projectId: targetProject?.id });
        let extractedText = "";
        if (kind === "resume" || kind === "project-document") {
          const formData = new FormData();
          formData.append("file", file);
          const response = await fetch("/api/profile/extract", { method: "POST", body: formData });
          const json = await response.json();
          if (json.ok && typeof json.data?.text === "string") extractedText = json.data.text;
        }
        const asset: ProfileMediaAsset = {
          ...storedAsset,
          extractedText: extractedText || undefined,
          analysisStatus: "draft",
          narrativeBeats: buildLocalMediaNarrative({ ...storedAsset, extractedText: extractedText || undefined }, nextProfile),
        };
        const projects = nextProfile.projects.map((project) => project.id === targetProject?.id ? {
          ...project,
          mediaAssetIds: [...new Set([...project.mediaAssetIds, asset.id])],
          mediaAssetId: project.mediaAssetId || asset.id,
          mediaType: project.mediaType || mediaTypeForKind(kind),
          presentationMode: kind === "project-video" ? "live" as const : project.presentationMode,
        } : project);
        nextProfile = { ...nextProfile, projects, mediaAssets: [...nextProfile.mediaAssets, asset], updatedAt: new Date().toISOString() };
        if (kind === "resume" && extractedText) extractedResume = extractedText;
      }
      if (extractedResume) nextProfile = { ...nextProfile, resume: extractedResume };
      profileRef.current = nextProfile;
      setProfile(nextProfile);
      saveProfile(nextProfile);
      setImportState("done");
      setMessage(`已保存 ${accepted.length} 个文件，并自动生成首版叙事。补充评论后可重新分析画面。`);
    } catch (error) {
      setImportState("error");
      setMessage(error instanceof Error ? error.message : "媒体保存失败");
    }
  };

  const handleMediaInput = (event: ChangeEvent<HTMLInputElement>, preferredProjectId?: string) => {
    const input = event.currentTarget;
    const files = input.files ? Array.from(input.files) : [];
    if (!files.length) return;
    void addMediaFiles(files, preferredProjectId).finally(() => { input.value = ""; });
  };

  const handleResumeInput = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    void readResume(file).finally(() => { input.value = ""; });
  };

  const updateMediaAsset = (assetId: string, patch: Partial<ProfileMediaAsset>, refreshNarrative = false) => {
    setProfile((current) => {
      const mediaAssets = current.mediaAssets.map((item) => {
        if (item.id !== assetId) return item;
        const updated = { ...item, ...patch };
        return refreshNarrative ? { ...updated, analysisStatus: "draft" as const, narrativeBeats: buildLocalMediaNarrative(updated, { ...current, mediaAssets: current.mediaAssets.map((entry) => entry.id === assetId ? updated : entry) }) } : updated;
      });
      const next = { ...current, mediaAssets, updatedAt: new Date().toISOString() };
      saveProfile(next);
      profileRef.current = next;
      return next;
    });
  };

  const updateNarrativeBeat = (assetId: string, beatIndex: number, patch: { title?: string; body?: string }) => {
    setProfile((current) => {
      const mediaAssets = current.mediaAssets.map((item) => {
        if (item.id !== assetId) return item;
        const source = item.narrativeBeats.length ? item.narrativeBeats : buildLocalMediaNarrative(item, current);
        return {
          ...item,
          analysisStatus: "draft" as const,
          narrativeBeats: source.map((beat, index) => index === beatIndex ? { ...beat, ...patch } : beat),
        };
      });
      const next = { ...current, mediaAssets, updatedAt: new Date().toISOString() };
      saveProfile(next);
      profileRef.current = next;
      return next;
    });
  };

  const assignMedia = (assetId: string, projectId: string) => {
    setProfile((current) => {
      const asset = current.mediaAssets.find((item) => item.id === assetId);
      if (!asset || asset.kind === "resume") return current;
      const mediaAssets = current.mediaAssets.map((item) => item.id === assetId ? { ...item, projectId: projectId || undefined } : item);
      const assetMap = new Map(mediaAssets.map((item) => [item.id, item]));
      const projects = current.projects.map((project) => {
        const withoutAsset = project.mediaAssetIds.filter((id) => id !== assetId);
        const mediaAssetIds = project.id === projectId ? [...withoutAsset, assetId] : withoutAsset;
        const firstAsset = mediaAssetIds.map((id) => assetMap.get(id)).find(Boolean);
        return {
          ...project,
          mediaAssetIds,
          mediaAssetId: mediaAssetIds[0],
          mediaType: firstAsset ? mediaTypeForKind(firstAsset.kind) : project.mediaUrl ? project.mediaType : undefined,
          presentationMode: project.id === projectId && asset.kind === "project-video" ? "live" as const : project.presentationMode,
        };
      });
      const next = { ...current, projects, mediaAssets, updatedAt: new Date().toISOString() };
      const refreshedAssets = next.mediaAssets.map((item) => item.id === assetId ? { ...item, analysisStatus: "draft" as const, narrativeBeats: buildLocalMediaNarrative(item, next) } : item);
      const refreshed = { ...next, mediaAssets: refreshedAssets };
      saveProfile(refreshed);
      profileRef.current = refreshed;
      return refreshed;
    });
  };

  const generateNarrative = async (assetId: string, analyzeFrames = true) => {
    const currentProfile = profileRef.current;
    const asset = currentProfile.mediaAssets.find((item) => item.id === assetId);
    if (!asset) return;
    setAnalyzingId(assetId);
    setMessage(analyzeFrames ? `正在读取 ${asset.name} 的代表画面…` : "正在更新叙事草稿…");
    let beats = buildLocalMediaNarrative(asset, currentProfile);
    let status: ProfileMediaAsset["analysisStatus"] = "draft";
    try {
      if (analyzeFrames && (asset.kind === "project-video" || asset.kind === "project-image")) {
        const blob = await getMediaBlob(asset.id);
        if (!blob) throw new Error("本地素材不存在，请重新上传");
        const frames = await extractMediaFrames(blob, asset.kind === "project-video" ? 4 : 1);
        const project = currentProfile.projects.find((item) => item.id === asset.projectId);
        const experience = currentProfile.experiences.find((item) => item.id === asset.experienceId);
        const response = await fetch("/api/media/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assetName: asset.name,
            purpose: asset.purpose,
            comment: asset.comment,
            project,
            experience,
            profile: {
              name: currentProfile.name,
              title: currentProfile.title,
              bio: currentProfile.bio,
              narrative: currentProfile.narrative,
              resume: currentProfile.resume.slice(0, 6000),
              metrics: currentProfile.metrics,
              skills: currentProfile.skills,
            },
            frames,
          }),
        });
        const json = await response.json();
        if (!response.ok || !json.ok) throw new Error(json.error || "视觉分析暂时不可用");
        const analyzed = normalizeNarrativeBeats(json.data?.beats);
        if (analyzed.length) {
          beats = analyzed;
          status = "analyzed";
        }
      }
      updateMediaAsset(assetId, { narrativeBeats: beats, analysisStatus: status });
      setImportState("done");
      setMessage(status === "analyzed" ? "已根据代表画面、评论与绑定经历生成六段叙事" : "已根据评论、项目与经历更新本地叙事草稿");
    } catch (error) {
      updateMediaAsset(assetId, { narrativeBeats: beats, analysisStatus: "draft" });
      setImportState("done");
      setMessage(`${error instanceof Error ? error.message : "视觉分析暂时不可用"}，已保留可编辑的本地叙事草稿`);
    } finally {
      setAnalyzingId("");
    }
  };

  const removeMedia = async (assetId: string) => {
    await deleteMediaFile(assetId).catch(() => undefined);
    setProfile((current) => {
      const next = {
        ...current,
        mediaAssets: current.mediaAssets.filter((item) => item.id !== assetId),
        projects: current.projects.map((project) => {
          const mediaAssetIds = project.mediaAssetIds.filter((id) => id !== assetId);
          const firstAsset = current.mediaAssets.find((item) => item.id === mediaAssetIds[0]);
          return { ...project, mediaAssetIds, mediaAssetId: mediaAssetIds[0], mediaType: firstAsset ? mediaTypeForKind(firstAsset.kind) : project.mediaUrl ? project.mediaType : undefined };
        }),
        updatedAt: new Date().toISOString(),
      };
      saveProfile(next);
      profileRef.current = next;
      return next;
    });
  };

  const replaceItem = <T extends { id: string }>(items: T[], id: string, patch: Partial<T>) => items.map((item) => item.id === id ? { ...item, ...patch } : item);
  const updateProject = (id: string, patch: Partial<CreatorProject>) => update((current) => ({ projects: replaceItem(current.projects, id, patch) }));

  const commitProfile = (recipe: (current: UserProfile) => UserProfile) => setProfile((current) => {
    const next = { ...recipe(current), updatedAt: new Date().toISOString() };
    saveProfile(next);
    profileRef.current = next;
    return next;
  });
  const addExperience = () => commitProfile((current) => ({ ...current, experiences: [...current.experiences, { id: uid("experience"), organization: "", role: "", period: "", summary: "", highlights: [] }] }));
  const addEducation = () => commitProfile((current) => ({ ...current, education: [...current.education, { id: uid("education"), school: "", degree: "", field: "", period: "" }] }));
  const addAward = () => commitProfile((current) => ({ ...current, awards: [...current.awards, { id: uid("award"), title: "", issuer: "", date: "" }] }));
  const addMetric = () => commitProfile((current) => ({ ...current, metrics: [...current.metrics, { id: uid("metric"), label: "", value: "" }] }));
  const addPaper = () => commitProfile((current) => ({ ...current, papers: [...current.papers, { title: "", url: "" }] }));
  const addSkill = () => commitProfile((current) => ({ ...current, skills: [...current.skills, { name: "", level: 75, evidence: "" }] }));
  const addProject = () => commitProfile((current) => ({ ...current, projects: [...current.projects, createEmptyProject(current.projects.length)] }));

  const finish = () => {
    const next = normalizeProfile({
      ...profile,
      name: profile.name.trim() || "Creator",
      title: profile.title.trim() || "AI Creator",
      bio: profile.bio.trim() || "正在构建下一件可以运行的作品。",
      narrative: profile.narrative.trim() || profile.bio.trim(),
      updatedAt: new Date().toISOString(),
    });
    saveProfile(next);
    router.push("/video");
  };

  return (
    <main className="studio-page onboarding-page ingest-page min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <div className="ingest-ambient" aria-hidden="true">
        <span className="ingest-ambient-orb ingest-ambient-orb-one" />
        <span className="ingest-ambient-orb ingest-ambient-orb-two" />
        <span className="ingest-ambient-orb ingest-ambient-orb-three" />
        <span className="ingest-ambient-ring ingest-ambient-ring-one" />
        <span className="ingest-ambient-ring ingest-ambient-ring-two" />
      </div>
      <LightRays className="onboarding-light-rays" tone="jade" />
      <div className="studio-frame-lines" aria-hidden="true"><span>01</span><i /><span>04</span></div>
      <div className="relative z-[2] mx-auto max-w-7xl">
        <motion.header className="studio-header ingest-header flex flex-wrap items-center justify-between gap-5 pb-5" initial={reduced ? false : { opacity: 0, y: -72 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 150, damping: 19, delay: reduced ? 0 : 0.04 }}>
          <div className="studio-title-lockup"><p className="studio-kicker">CREATOR STORY ENGINE / 01</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">让每份真实素材，进入你的个人影片</h1><p className="mt-2 text-sm">导入资料、标记经历、选择视觉世界，再由 Remotion 按当前用户数据现场编排。</p><span aria-hidden="true">开场</span></div>
          <div className="ingest-header-actions"><span><i />当前档案自动隔离保存</span><Link className="studio-button secondary" href="/city/neon"><MapIcon size={16} />返回广场</Link><Link className="studio-button secondary" href="/profile">查看主页</Link></div>
        </motion.header>

        <motion.div className="ingest-source-rail" initial={reduced ? false : { opacity: 0, y: -36 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduced ? 0 : .1 }}>
          <div><span>INPUT SOURCES</span><strong>任意创作者素材</strong></div>
          {sourceRail.map(({ label, icon: SourceIcon }, index) => <div key={label}><SourceIcon size={16} /><span>{String(index + 1).padStart(2, "0")}</span><b>{label}</b></div>)}
          <div className="ingest-source-output"><WandSparkles size={17} /><b>REMOTION</b><span>动态故事板</span></div>
        </motion.div>

        <motion.nav className="studio-steps ingest-steps my-6 grid grid-cols-2 gap-2 lg:grid-cols-4" style={{ "--studio-progress": `${step * 25}%` } as CSSProperties} aria-label="档案创建步骤" initial={reduced ? false : { opacity: 0, y: -62 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 160, damping: 19, delay: reduced ? 0 : 0.12 }}>
          {steps.map((item) => { const StepIcon = item.icon; return <button key={item.id} type="button" onClick={() => setStep(item.id)} className={step === item.id ? "active" : ""}><StepIcon size={18} /><span className="text-xs">0{item.id}</span><span>{item.title}</span></button>; })}
        </motion.nav>

        <AnimatePresence>{message && <motion.p initial={reduced ? false : { opacity: 0, y: -28 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} transition={{ type: "spring", stiffness: 180, damping: 20 }} className={`ingest-status mb-4 ${importState === "error" ? "error" : "success"}`}><Sparkles size={16} />{message}</motion.p>}</AnimatePresence>

        <motion.section className="studio-card studio-workbench p-5 sm:p-7" initial={reduced ? false : { opacity: 0, y: -54, scale: 0.992 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 145, damping: 18, delay: reduced ? 0 : 0.2 }}>
          <motion.div key={step} initial={reduced ? false : { opacity: 0, y: -38 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 190, damping: 22 }}>
          {step === 1 && <div className="space-y-8">
            <section className="video-theme-panel" aria-labelledby="video-theme-title">
              <div className="theme-panel-heading"><span><Palette size={17} /> VISUAL WORLD</span><div><h2 id="video-theme-title">先决定成片的背景世界</h2><p>这不是播放器皮肤。选择会写入用户档案，并直接改变每个 Remotion 场景的底色、网格、强调色与转场。</p></div></div>
              <div className="video-theme-grid">
                {themeOptions.map((theme, index) => <motion.button type="button" key={theme.id} className={profile.videoTheme === theme.id ? "active" : ""} onClick={() => update({ videoTheme: theme.id })} whileHover={reduced ? undefined : { y: -5 }} whileTap={reduced ? undefined : { scale: .985 }}>
                  <span className="theme-preview" style={{ "--theme-base": theme.colors[0], "--theme-accent": theme.colors[1], "--theme-second": theme.colors[2] } as CSSProperties}><i /><i /><i /><b>{theme.mark}</b><em>0{index + 1}</em></span>
                  <span className="theme-copy"><strong>{theme.label}</strong><small>{theme.caption}</small></span>
                  <span className="theme-check">{profile.videoTheme === theme.id ? "已选" : "选择"}</span>
                </motion.button>)}
              </div>
            </section>
            <section className="studio-media-vault featured" aria-labelledby="media-vault-title">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="studio-kicker">REMOTION MEDIA INGEST</p><h2 id="media-vault-title" className="mt-1 text-xl font-bold">上传你希望出现在影片里的视频、图片与文档</h2><p className="mt-2 max-w-3xl text-sm leading-6">每份素材都会形成独立叙事卡。系统读取媒体信息并抽取代表画面，你的评论决定它对应哪段经历、强调哪个瞬间。</p></div>
                <div className="flex flex-wrap gap-2 text-xs text-[#697386]"><span className="studio-pill"><Video size={14} /> 实机 / 路演</span><span className="studio-pill"><ImageIcon size={14} /> 照片 / 截图</span><span className="studio-pill"><FileText size={14} /> PDF / 简历</span></div>
              </div>
              <label
                className={`studio-dropzone mt-5 ${dragActive ? "active" : ""}`}
                onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setDragActive(false)}
                onDrop={(event) => { event.preventDefault(); setDragActive(false); void addMediaFiles(event.dataTransfer.files); }}
              >
                <UploadCloud size={28} />
                 <span><strong>拖入你的产品录屏、路演视频、作品照片、简历或研究文档</strong><small>一次可选择多个文件 · 单个最大 250 MB · 素材保存在当前浏览器并用于现场渲染</small></span>
                <span className="studio-button primary">选择素材</span>
                <input className="sr-only" type="file" multiple accept="video/mp4,video/webm,video/quicktime,image/png,image/jpeg,image/webp,application/pdf,.pdf" disabled={importState === "loading"} onChange={handleMediaInput} />
               </label>
              <div className="ingest-pipeline" aria-label="素材处理流程">
                {["上传", "读取元数据", "画面分析", "叙事编排", "Remotion 预览"].map((label, index) => <div className={profile.mediaAssets.length && index < 2 ? "ready" : index === 0 ? "active" : ""} key={label}><span>{index === 2 ? <ScanLine size={14} /> : index === 3 ? <WandSparkles size={14} /> : String(index + 1).padStart(2, "0")}</span><b>{label}</b>{index < 4 && <i />}</div>)}
              </div>
              {profile.mediaAssets.length > 0 && <div className="studio-media-list mt-5">
                {profile.mediaAssets.map((asset) => <article className="media-editor" key={asset.id}>
                  <div className="media-editor-head">
                    <span className="media-kind">{asset.kind === "project-video" ? <Video size={18} /> : asset.kind === "project-image" ? <ImageIcon size={18} /> : <FileText size={18} />}</span>
                    <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{asset.name}</strong><small className="flex flex-wrap items-center gap-x-2 gap-y-1">{formatMediaSize(asset.size)}{asset.durationInSeconds && <><span>·</span><span className="inline-flex items-center gap-1"><Clock3 size={12} />{asset.durationInSeconds.toFixed(1)}s</span></>}{asset.width && asset.height && <><span>·</span><span>{asset.width} × {asset.height}</span></>}</small></span>
                    <span className={`analysis-badge ${asset.analysisStatus}`}>{asset.analysisStatus === "analyzed" ? "视觉分析" : asset.analysisStatus === "draft" ? "叙事草稿" : "待分析"}</span>
                    <button className="studio-icon-button" type="button" title="删除素材" aria-label={`删除 ${asset.name}`} onClick={() => void removeMedia(asset.id)}><Trash2 size={16} /></button>
                  </div>

                  <div className="media-editor-grid">
                    <label>素材用途<select className="studio-select mt-2" value={asset.purpose} onChange={(event) => updateMediaAsset(asset.id, { purpose: event.target.value as ProfileMediaPurpose }, true)}>{Object.entries(mediaPurposeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                    {asset.kind !== "resume" && <label>对应项目<select className="studio-select mt-2" value={asset.projectId || ""} onChange={(event) => assignMedia(asset.id, event.target.value)}><option value="">暂不绑定项目</option>{profile.projects.map((project) => <option value={project.id} key={project.id}>{project.name || "未命名项目"}</option>)}</select></label>}
                    <label>对应经历<select className="studio-select mt-2" value={asset.experienceId || ""} onChange={(event) => updateMediaAsset(asset.id, { experienceId: event.target.value || undefined }, true)}><option value="">暂不绑定经历</option>{profile.experiences.map((experience) => <option value={experience.id} key={experience.id}>{[experience.organization, experience.role].filter(Boolean).join(" · ") || "未命名经历"}</option>)}</select></label>
                  </div>

                  <label className="media-comment"><span><MessageSquareText size={15} />这段素材讲什么，它对应你哪次经历？</span><small>推荐按“问题 / 我负责 / 行动 / 重点看 / 结果 / 复盘”填写；信息越具体，Motion 越贴合。</small><textarea className="studio-input mt-2 min-h-24 resize-y" value={asset.comment} onChange={(event) => updateMediaAsset(asset.id, { comment: event.target.value })} onBlur={() => void generateNarrative(asset.id, false)} placeholder={"问题：要解决什么真实需求\n我负责：你的角色与边界\n行动：用了什么方法\n重点看：00:12 的哪次操作\n结果：数字、反馈或明确产出\n复盘：这次经历沉淀的方法"} /></label>

                  <div className="media-story-strip">
                    {(asset.narrativeBeats.length ? asset.narrativeBeats : buildLocalMediaNarrative(asset, profile)).map((beat, index) => <div key={`${beat.phase}-${index}`}><span>{String(index + 1).padStart(2, "0")} · {narrativePhaseLabels[beat.phase]}</span><input aria-label={`${narrativePhaseLabels[beat.phase]}标题`} value={beat.title} onChange={(event) => updateNarrativeBeat(asset.id, index, { title: event.target.value })} /><textarea aria-label={`${narrativePhaseLabels[beat.phase]}正文`} value={beat.body} onChange={(event) => updateNarrativeBeat(asset.id, index, { body: event.target.value })} /></div>)}
                  </div>

                  <div className="media-editor-actions"><p>右侧素材负责证明，左侧 Motion 按“问题 → 行动 → 证据 → 结果”编排。缺少事实时会明确标记待补充，不会虚构成果。</p><button className="studio-button secondary" type="button" disabled={analyzingId === asset.id} onClick={() => void generateNarrative(asset.id, asset.kind === "project-video" || asset.kind === "project-image")}>{analyzingId === asset.id ? <LoaderCircle className="animate-spin" size={16} /> : <Sparkles size={16} />}{asset.kind === "project-video" || asset.kind === "project-image" ? "分析画面并重写叙事" : "根据评论重写叙事"}</button></div>
                </article>)}
              </div>}
              {!profile.mediaAssets.length && <div className="media-empty-state"><Sparkles size={18} /><span>上传后将在这里出现“素材 → 经历 → 六段叙事”的导演卡片。</span></div>}
            </section>
            <div className="ingest-info-grid grid gap-8 xl:grid-cols-2">
            <div className="space-y-5">
              <div><p className="font-mono text-xs font-black text-[#236b5b]">SOURCE / GITHUB</p><h2 className="mt-2 text-xl font-black">先连接公开作品</h2><div className="mt-4 flex flex-col gap-3 sm:flex-row"><input className="pixel-input" value={profile.githubUsername} onChange={(event) => update({ githubUsername: event.target.value })} placeholder="用户名或 GitHub 主页" /><button className="pixel-button jade shrink-0 px-5" type="button" disabled={importState === "loading" || !profile.githubUsername} onClick={importGithub}>{importState === "loading" ? "读取中…" : "读取 GitHub"}</button></div></div>
              <div><p className="font-mono text-xs font-black text-[#236b5b]">SOURCE / PROJECT</p><div className="mt-3 flex flex-col gap-3 sm:flex-row"><input className="pixel-input" value={projectInput} onChange={(event) => setProjectInput(event.target.value)} placeholder="仓库、产品主页或 Demo 链接" /><button className="pixel-button shrink-0 px-5" type="button" onClick={addProjectLink}>添加项目</button></div></div>
              <Field label="姓名" value={profile.name} onChange={(name) => update({ name })} placeholder="你的名字" />
              <Field label="身份标签" value={profile.title} onChange={(title) => update({ title })} placeholder="AI 工程师 / 产品创作者 / 研究者" />
              <Field label="一句话介绍" value={profile.bio} onChange={(bio) => update({ bio })} placeholder="你正在解决什么问题？" />
            </div>
            <div className="space-y-5">
              <Field label="个人叙述" value={profile.narrative} onChange={(narrative) => update({ narrative })} placeholder="你擅长什么、相信什么、正在构建什么？" multiline />
              <Field label="简历文字或公开链接" value={profile.resume} onChange={(resume) => update({ resume })} placeholder="粘贴简历关键内容" multiline />
              <label className="studio-button secondary inline-flex cursor-pointer items-center gap-2"><UploadCloud size={17} />{importState === "loading" ? "解析中…" : "仅提取简历文字"}<input className="sr-only" type="file" accept=".txt,.md,.pdf,.docx" disabled={importState === "loading"} onChange={handleResumeInput} /></label>
              <Field label="成绩单 / 结果补充" value={profile.transcript} onChange={(transcript) => update({ transcript })} placeholder="例如：核心课程 GPA 3.8/4.0" multiline />
              <Field label="希望遇见的人" value={profile.lookingFor} onChange={(lookingFor) => update({ lookingFor })} placeholder="合作方向、角色或特征" multiline />
            </div>
            </div>
          </div>}

          {step === 2 && <div className="grid gap-8 xl:grid-cols-2">
            <div><div className="flex items-end justify-between gap-3"><div><p className="font-mono text-xs font-black text-[#d94b3f]">EXPERIENCE</p><h2 className="mt-1 text-xl font-black">工作与实践经历</h2></div><button className="pixel-button px-4 text-sm" type="button" onClick={addExperience}>+ 添加经历</button></div><div className="mt-4 space-y-4">{profile.experiences.map((item: CreatorExperience) => <article className="border-[3px] border-[#18231f] bg-[#dff5f2] p-4" key={item.id}><div className="flex items-start gap-3"><div className="grid flex-1 gap-3 sm:grid-cols-2"><Field label="组织" value={item.organization} onChange={(organization) => update({ experiences: replaceItem(profile.experiences, item.id, { organization }) })} /><Field label="角色" value={item.role} onChange={(role) => update({ experiences: replaceItem(profile.experiences, item.id, { role }) })} /><Field label="时间" value={item.period} onChange={(period) => update({ experiences: replaceItem(profile.experiences, item.id, { period }) })} placeholder="2024 - 至今" /><Field label="成果关键词" value={item.highlights.join("，")} onChange={(value) => update({ experiences: replaceItem(profile.experiences, item.id, { highlights: splitList(value) }) })} /></div><RemoveButton label="删除经历" onClick={() => update({ experiences: profile.experiences.filter((entry) => entry.id !== item.id) })} /></div><div className="mt-3"><Field label="工作概述" value={item.summary} onChange={(summary) => update({ experiences: replaceItem(profile.experiences, item.id, { summary }) })} multiline /></div></article>)}{!profile.experiences.length && <p className="border-[3px] border-dashed border-[#607068] bg-white p-5 text-sm text-[#607068]">添加第一段经历，Remotion 会自动生成轨迹场景。</p>}</div></div>
            <div><div className="flex items-end justify-between gap-3"><div><p className="font-mono text-xs font-black text-[#236b5b]">EDUCATION</p><h2 className="mt-1 text-xl font-black">教育与学习成果</h2></div><button className="pixel-button px-4 text-sm" type="button" onClick={addEducation}>+ 添加</button></div><div className="mt-4 space-y-4">{profile.education.map((item: CreatorEducation) => <article className="border-[3px] border-[#18231f] bg-[#fff9df] p-4" key={item.id}><div className="flex items-start gap-3"><div className="grid flex-1 gap-3 sm:grid-cols-2"><Field label="学校" value={item.school} onChange={(school) => update({ education: replaceItem(profile.education, item.id, { school }) })} /><Field label="学位" value={item.degree} onChange={(degree) => update({ education: replaceItem(profile.education, item.id, { degree }) })} /><Field label="专业" value={item.field} onChange={(field) => update({ education: replaceItem(profile.education, item.id, { field }) })} /><Field label="时间" value={item.period} onChange={(period) => update({ education: replaceItem(profile.education, item.id, { period }) })} /><Field label="成绩 / 荣誉" value={item.result || ""} onChange={(result) => update({ education: replaceItem(profile.education, item.id, { result }) })} /></div><RemoveButton label="删除教育经历" onClick={() => update({ education: profile.education.filter((entry) => entry.id !== item.id) })} /></div></article>)}{!profile.education.length && <p className="border-[3px] border-dashed border-[#607068] bg-white p-5 text-sm text-[#607068]">教育信息会与实践经历共同编入时间线。</p>}</div></div>
          </div>}

          {step === 3 && <div className="space-y-9">
            <div className="grid gap-8 xl:grid-cols-2">
              <div><div className="flex items-end justify-between"><div><p className="font-mono text-xs font-black text-[#d94b3f]">METRICS</p><h2 className="mt-1 text-xl font-black">数字结果</h2></div><button className="pixel-button px-4 text-sm" type="button" onClick={addMetric}>+ 添加指标</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{profile.metrics.map((item: CreatorMetric) => <article className="border-[3px] border-[#18231f] bg-[#dff5f2] p-3" key={item.id}><div className="flex gap-2"><div className="grid flex-1 gap-2"><Field label="数值" value={item.value} onChange={(value) => update({ metrics: replaceItem(profile.metrics, item.id, { value }) })} placeholder="60% / 12+ / 3.8" /><Field label="指标" value={item.label} onChange={(label) => update({ metrics: replaceItem(profile.metrics, item.id, { label }) })} /><Field label="语境" value={item.context || ""} onChange={(context) => update({ metrics: replaceItem(profile.metrics, item.id, { context }) })} /></div><RemoveButton label="删除指标" onClick={() => update({ metrics: profile.metrics.filter((entry) => entry.id !== item.id) })} /></div></article>)}</div></div>
              <div><div className="flex items-end justify-between"><div><p className="font-mono text-xs font-black text-[#236b5b]">AWARDS</p><h2 className="mt-1 text-xl font-black">奖项与认证</h2></div><button className="pixel-button px-4 text-sm" type="button" onClick={addAward}>+ 添加</button></div><div className="mt-4 space-y-3">{profile.awards.map((item: CreatorAward) => <article className="border-[3px] border-[#18231f] bg-[#fff9df] p-3" key={item.id}><div className="flex gap-2"><div className="grid flex-1 gap-2 sm:grid-cols-3"><Field label="奖项" value={item.title} onChange={(title) => update({ awards: replaceItem(profile.awards, item.id, { title }) })} /><Field label="颁发方" value={item.issuer} onChange={(issuer) => update({ awards: replaceItem(profile.awards, item.id, { issuer }) })} /><Field label="时间" value={item.date} onChange={(date) => update({ awards: replaceItem(profile.awards, item.id, { date }) })} /></div><RemoveButton label="删除奖项" onClick={() => update({ awards: profile.awards.filter((entry) => entry.id !== item.id) })} /></div></article>)}</div></div>
            </div>
            <div className="grid gap-8 xl:grid-cols-2">
              <div><div className="flex items-end justify-between"><div><p className="font-mono text-xs font-black text-[#7256a8]">RESEARCH</p><h2 className="mt-1 text-xl font-black">论文与研究</h2></div><button className="pixel-button px-4 text-sm" type="button" onClick={addPaper}>+ 添加论文</button></div><div className="mt-4 space-y-3">{profile.papers.map((paper, index) => <article className="border-[3px] border-[#18231f] bg-white p-3" key={`${index}-${paper.title}`}><div className="flex gap-2"><div className="grid flex-1 gap-2"><Field label="标题" value={paper.title} onChange={(title) => update({ papers: profile.papers.map((item, itemIndex) => itemIndex === index ? { ...item, title } : item) })} /><div className="grid gap-2 sm:grid-cols-2"><Field label="链接" value={paper.url} onChange={(url) => update({ papers: profile.papers.map((item, itemIndex) => itemIndex === index ? { ...item, url } : item) })} /><Field label="期刊 / 会议" value={paper.venue || ""} onChange={(venue) => update({ papers: profile.papers.map((item, itemIndex) => itemIndex === index ? { ...item, venue } : item) })} /></div><Field label="你的贡献" value={paper.contribution || ""} onChange={(contribution) => update({ papers: profile.papers.map((item, itemIndex) => itemIndex === index ? { ...item, contribution } : item) })} /></div><RemoveButton label="删除论文" onClick={() => update({ papers: profile.papers.filter((_, itemIndex) => itemIndex !== index) })} /></div></article>)}</div></div>
              <div><div className="flex items-end justify-between"><div><p className="font-mono text-xs font-black text-[#ed7c3b]">SKILL EVIDENCE</p><h2 className="mt-1 text-xl font-black">技能与证据</h2></div><button className="pixel-button px-4 text-sm" type="button" onClick={addSkill}>+ 添加技能</button></div><div className="mt-4 space-y-3">{profile.skills.map((skill, index) => <article className="border-[3px] border-[#18231f] bg-white p-3" key={`${index}-${skill.name}`}><div className="flex gap-2"><div className="grid flex-1 gap-2 sm:grid-cols-[1fr_110px_1.4fr]"><Field label="技能" value={skill.name} onChange={(name) => update({ skills: profile.skills.map((item, itemIndex) => itemIndex === index ? { ...item, name } : item) })} /><label className="text-sm font-black">等级<input className="pixel-input mt-2" type="number" min="0" max="100" value={skill.level} onChange={(event) => update({ skills: profile.skills.map((item, itemIndex) => itemIndex === index ? { ...item, level: Number(event.target.value) } : item) })} /></label><Field label="能力证据" value={skill.evidence || ""} onChange={(evidence) => update({ skills: profile.skills.map((item, itemIndex) => itemIndex === index ? { ...item, evidence } : item) })} /></div><RemoveButton label="删除技能" onClick={() => update({ skills: profile.skills.filter((_, itemIndex) => itemIndex !== index) })} /></div></article>)}</div></div>
            </div>
          </div>}

          {step === 4 && <div className="grid gap-8 xl:grid-cols-[1fr_310px]">
            <div><div className="flex items-end justify-between"><div><p className="font-mono text-xs font-black text-[#d94b3f]">PROJECT DIRECTOR</p><h2 className="mt-1 text-xl font-black">决定每个项目怎样出场</h2></div><button className="pixel-button px-4 text-sm" type="button" onClick={addProject}>+ 添加项目</button></div>
              <div className="mt-4 space-y-5">{profile.projects.map((project) => <article className="border-[3px] border-[#18231f] bg-white p-4 shadow-[4px_4px_0_#18231f]" key={project.id}><div className="flex items-start gap-3"><div className="grid flex-1 gap-3 sm:grid-cols-2"><Field label="项目名" value={project.name} onChange={(name) => updateProject(project.id, { name })} /><Field label="项目链接" value={project.url || ""} onChange={(url) => updateProject(project.id, { url })} /><Field label="你的角色" value={project.role || ""} onChange={(role) => updateProject(project.id, { role })} /><Field label="影响 / 结果" value={project.impact || ""} onChange={(impact) => updateProject(project.id, { impact })} /></div><RemoveButton label="删除项目" onClick={() => update({ projects: profile.projects.filter((entry) => entry.id !== project.id) })} /></div><div className="project-media-rail"><span><Video size={15} />已绑定 {profile.mediaAssets.filter((asset) => asset.projectId === project.id).length} 份本地素材</span><label className="studio-button secondary cursor-pointer"><UploadCloud size={15} />上传到此项目<input className="sr-only" type="file" multiple accept="video/mp4,video/webm,video/quicktime,image/png,image/jpeg,image/webp,application/pdf,.pdf" onChange={(event) => handleMediaInput(event, project.id)} /></label></div><div className="mt-3"><Field label="项目说明" value={project.desc} onChange={(desc) => updateProject(project.id, { desc })} multiline /></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="技术栈（逗号分隔）" value={project.tech.join("，")} onChange={(value) => updateProject(project.id, { tech: splitList(value) })} /><Field label="亮点（逗号分隔）" value={project.highlights.join("，")} onChange={(value) => updateProject(project.id, { highlights: splitList(value) })} /><Field label="架构节点（逗号分隔）" value={project.architecture.join("，")} onChange={(value) => updateProject(project.id, { architecture: splitList(value) })} /><Field label="流程步骤（逗号分隔）" value={project.workflow.join("，")} onChange={(value) => updateProject(project.id, { workflow: splitList(value) })} /></div><div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="text-sm font-black">呈现方式<select className="pixel-input mt-2" value={project.presentationMode} onChange={(event) => updateProject(project.id, { presentationMode: event.target.value as CreatorProject["presentationMode"] })}><option value="auto">自动选择</option><option value="live">实机视频</option><option value="browser">浏览器演示</option><option value="architecture">架构图</option><option value="workflow">流程图</option></select></label><label className="text-sm font-black">媒体类型<select className="pixel-input mt-2" value={project.mediaType || ""} onChange={(event) => updateProject(project.id, { mediaType: event.target.value === "video" || event.target.value === "image" || event.target.value === "document" ? event.target.value : undefined })}><option value="">无媒体</option><option value="video">视频</option><option value="image">图片</option><option value="document">文档</option></select></label><Field label="外部媒体 URL" value={project.mediaUrl || ""} onChange={(mediaUrl) => updateProject(project.id, { mediaUrl })} placeholder="公开访问的 MP4 或图片（可选）" /></div></article>)}{!profile.projects.length && <p className="border-[3px] border-dashed border-[#607068] bg-white p-6 text-sm text-[#607068]">添加项目后，可指定实机、浏览器、架构或流程呈现；留在“自动选择”也能稳定生成。</p>}</div>
            </div>
            <aside className="xl:sticky xl:top-6 xl:self-start"><div className="border-[3px] border-[#18231f] bg-[#fff9df] p-5 shadow-[5px_5px_0_#18231f]"><p className="font-mono text-xs font-black text-[#236b5b]">SOURCE COVERAGE</p><h3 className="mt-2 text-lg font-black">故事板资料覆盖</h3><div className="mt-4 grid grid-cols-2 gap-2">{coverage.map(([label, value]) => <div className="border-[3px] border-[#18231f] bg-white p-3 text-center" key={label}><div className="font-mono text-2xl font-black text-[#d94b3f]">{value}</div><div className="text-xs font-bold text-[#607068]">{label}</div></div>)}</div><p className="mt-4 text-sm leading-6 text-[#607068]">先进入实时 Remotion 预览确认故事板；只有点击“渲染 MP4”后才会逐帧编码成片。</p><button className="pixel-button red mt-5 w-full px-5" type="button" onClick={finish}>进入实时预览 →</button></div></aside>
          </div>}

          </motion.div>
          <div className="ingest-footer-nav mt-8 flex items-center justify-between pt-5"><button className="pixel-button secondary px-4" type="button" disabled={step === 1} onClick={() => setStep((value) => Math.max(1, value - 1))}>← 上一步</button>{step < 4 && <button className="pixel-button jade px-5" type="button" onClick={() => setStep((value) => Math.min(4, value + 1))}>下一步 →</button>}</div>
        </motion.section>
      </div>
    </main>
  );
}
