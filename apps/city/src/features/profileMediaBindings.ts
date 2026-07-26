import type { CreatorProject, ProfileMediaAsset, ProjectMediaType, UserProfile } from "./profile";

const genericTokens = new Set([
  "project",
  "video",
  "demo",
  "recording",
  "screen",
  "录屏",
  "演示",
  "项目",
  "素材",
]);

const normalizeText = (value: string | undefined) => (value || "")
  .toLowerCase()
  .replace(/https?:\/\//g, " ")
  .replace(/github\.com\//g, " ")
  .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const compactText = (value: string | undefined) => normalizeText(value).replace(/\s+/g, "");

const repoSlug = (value: string | undefined) => {
  const clean = (value || "").replace(/[?#].*$/, "").replace(/\/+$/, "");
  return clean.split("/").filter(Boolean).pop()?.replace(/\.git$/i, "") || "";
};

const projectAliases = (project: CreatorProject) => {
  const values = [project.name, repoSlug(project.url)];
  return [...new Set(values.flatMap((value) => {
    const normalized = normalizeText(value);
    const compact = compactText(value);
    const tokens = normalized.split(" ").filter((token) => token.length >= 3 && !genericTokens.has(token));
    return [normalized, compact, ...tokens].filter((item) => item.length >= 3);
  }))];
};

const assetSearchText = (asset: ProfileMediaAsset) => normalizeText([
  asset.name,
  asset.comment,
  asset.extractedText,
  ...asset.narrativeBeats.flatMap((beat) => [beat.title, beat.body, beat.visualCue, ...beat.keywords]),
].filter(Boolean).join(" "));

const bindingScore = (asset: ProfileMediaAsset, project: CreatorProject) => {
  const haystack = assetSearchText(asset);
  const compactHaystack = haystack.replace(/\s+/g, "");
  let score = 0;
  for (const alias of projectAliases(project)) {
    const compactAlias = alias.replace(/\s+/g, "");
    if (alias.length >= 4 && haystack.includes(alias)) score = Math.max(score, 120 + Math.min(30, alias.length));
    if (compactAlias.length >= 4 && compactHaystack.includes(compactAlias)) score = Math.max(score, 135 + Math.min(30, compactAlias.length));
    for (const token of alias.split(" ")) {
      if (token.length >= 4 && haystack.includes(token)) score += 18;
    }
  }
  if (project.ownership === "owned") score += 2;
  return score;
};

const mediaTypeForAsset = (asset: ProfileMediaAsset | undefined): ProjectMediaType | undefined => {
  if (asset?.kind === "project-video") return "video";
  if (asset?.kind === "project-image") return "image";
  if (asset?.kind === "project-document") return "document";
  return undefined;
};

/**
 * Repairs media bindings after projects were re-imported with different IDs.
 * Existing explicit bindings win; otherwise filenames, comments and narrative
 * text are matched against the current project name and repository slug.
 */
export function repairProfileMediaBindings(profile: UserProfile): UserProfile {
  const projectIds = new Set(profile.projects.map((project) => project.id));
  const assetIds = new Set(profile.mediaAssets.map((asset) => asset.id));
  const projectByAsset = new Map<string, CreatorProject>();

  for (const project of profile.projects) {
    for (const assetId of project.mediaAssetIds) {
      if (assetIds.has(assetId) && !projectByAsset.has(assetId)) projectByAsset.set(assetId, project);
    }
    if (project.mediaAssetId && assetIds.has(project.mediaAssetId) && !projectByAsset.has(project.mediaAssetId)) {
      projectByAsset.set(project.mediaAssetId, project);
    }
  }

  const mediaAssets = profile.mediaAssets.map((asset) => {
    if (asset.kind === "resume") return asset;
    const direct = asset.projectId && projectIds.has(asset.projectId)
      ? profile.projects.find((project) => project.id === asset.projectId)
      : undefined;
    const reverse = projectByAsset.get(asset.id);
    const ranked = direct || reverse || profile.projects
      .map((project) => ({ project, score: bindingScore(asset, project) }))
      .sort((left, right) => right.score - left.score)[0];
    const target = "project" in (ranked || {})
      ? (ranked as { project: CreatorProject; score: number }).score >= 42
        ? (ranked as { project: CreatorProject }).project
        : undefined
      : ranked as CreatorProject | undefined;
    return target && asset.projectId !== target.id ? { ...asset, projectId: target.id } : asset;
  });

  const assetMap = new Map(mediaAssets.map((asset) => [asset.id, asset]));
  const projects = profile.projects.map((project) => {
    const boundAssets = mediaAssets
      .filter((asset) => asset.kind !== "resume" && asset.projectId === project.id)
      .sort((left, right) => (left.kind === "project-video" ? 0 : 1) - (right.kind === "project-video" ? 0 : 1));
    const preservedIds = [...project.mediaAssetIds, project.mediaAssetId || ""]
      .filter((id, index, values) => id && assetMap.has(id) && values.indexOf(id) === index);
    const mediaAssetIds = [...new Set([...boundAssets.map((asset) => asset.id), ...preservedIds])];
    const firstAsset = mediaAssetIds.map((id) => assetMap.get(id)).find((asset) => asset?.kind === "project-video")
      || mediaAssetIds.map((id) => assetMap.get(id)).find(Boolean);
    const mediaType = mediaTypeForAsset(firstAsset);
    return {
      ...project,
      mediaAssetIds,
      mediaAssetId: firstAsset?.id,
      mediaType: mediaType || (project.mediaUrl ? project.mediaType : undefined),
      presentationMode: boundAssets.some((asset) => asset.kind === "project-video") ? "live" as const : project.presentationMode,
    };
  });

  return { ...profile, projects, mediaAssets };
}

export const normalizedProjectKey = (project: Pick<CreatorProject, "name" | "url">) =>
  compactText(repoSlug(project.url)) || compactText(project.name);

