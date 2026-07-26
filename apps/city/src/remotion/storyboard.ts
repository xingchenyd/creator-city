import { z } from "zod";
import type { CreatorProject, ProfileMediaAsset, UserProfile } from "../features/profile";
import { buildLocalMediaNarrative, findResumeProjectExcerpt, isNarrativePlaceholder, parseNarrativeFacts, parseNarrativeTimestamps, shouldRegenerateNarrative } from "../features/mediaNarrative";

const baseSceneSchema = z.object({
  id: z.string(),
  durationInFrames: z.number().int().positive(),
  eyebrow: z.string(),
  title: z.string(),
  subtitle: z.string(),
  sourceLabel: z.string(),
});

export const identitySceneSchema = baseSceneSchema.extend({
  type: z.literal("identity"),
  name: z.string(),
  role: z.string(),
});

export const timelineSceneSchema = baseSceneSchema.extend({
  type: z.literal("timeline"),
  items: z.array(z.object({
    period: z.string(),
    heading: z.string(),
    meta: z.string(),
    summary: z.string(),
  })),
});

export const evidenceSceneSchema = baseSceneSchema.extend({
  type: z.literal("evidence"),
  metrics: z.array(z.object({ label: z.string(), value: z.string(), context: z.string() })),
  awards: z.array(z.object({ title: z.string(), issuer: z.string(), date: z.string() })),
});

const narrativeBeatSchema = z.object({
  phase: z.enum(["hook", "context", "action", "evidence", "result", "reflection"]),
  title: z.string(),
  body: z.string(),
  visualCue: z.string(),
  layout: z.enum(["fullscreen", "split", "media-full"]),
  visual: z.enum(["kinetic", "network", "workflow", "metric", "compare", "media-focus"]),
  keywords: z.array(z.string()),
});

export const projectSceneSchema = baseSceneSchema.extend({
  type: z.literal("project"),
  projectId: z.string(),
  projectName: z.string(),
  projectUrl: z.string(),
  role: z.string(),
  impact: z.string(),
  tech: z.array(z.string()),
  highlights: z.array(z.string()),
  presentation: z.enum(["live", "browser", "architecture", "workflow"]),
  mediaUrl: z.string(),
  mediaType: z.enum(["video", "image", "document"]).optional(),
  accent: z.string(),
  secondary: z.string(),
  mediaClips: z.array(z.object({
    assetId: z.string(),
    name: z.string(),
    mediaUrl: z.string(),
    mediaType: z.enum(["video", "image", "document"]),
    purpose: z.string(),
    comment: z.string(),
    excerpt: z.string(),
    durationInSeconds: z.number(),
    narrativeBeats: z.array(narrativeBeatSchema),
  })),
  storyBeats: z.array(narrativeBeatSchema.extend({
    mediaIndex: z.number().int().nonnegative().optional(),
    trimStartInSeconds: z.number().nonnegative().optional(),
    trimDurationInSeconds: z.number().positive().optional(),
  })),
  architecture: z.array(z.string()),
  workflow: z.array(z.string()),
});

export const researchSceneSchema = baseSceneSchema.extend({
  type: z.literal("research"),
  papers: z.array(z.object({ title: z.string(), venue: z.string(), contribution: z.string() })),
});

export const skillsSceneSchema = baseSceneSchema.extend({
  type: z.literal("skills"),
  skills: z.array(z.object({ name: z.string(), level: z.number(), evidence: z.string() })),
});

export const closingSceneSchema = baseSceneSchema.extend({
  type: z.literal("closing"),
  name: z.string(),
  lookingFor: z.string(),
  links: z.array(z.string()),
});

export const creatorSceneSchema = z.discriminatedUnion("type", [
  identitySceneSchema,
  timelineSceneSchema,
  evidenceSceneSchema,
  projectSceneSchema,
  researchSceneSchema,
  skillsSceneSchema,
  closingSceneSchema,
]);

export const creatorStoryboardSchema = z.object({
  version: z.literal(1),
  title: z.string(),
  fps: z.number().int().positive(),
  visualTheme: z.enum(["beijing-night", "paper-archive", "signal-lab", "gallery-white"]),
  scenes: z.array(creatorSceneSchema),
});

export type CreatorScene = z.infer<typeof creatorSceneSchema>;
export type CreatorStoryboard = z.infer<typeof creatorStoryboardSchema>;
export type ProjectScene = z.infer<typeof projectSceneSchema>;

export const getStoryboardDuration = (storyboard: CreatorStoryboard) =>
  storyboard.scenes.reduce((total, scene) => total + scene.durationInFrames, 0);

const MAX_SHOWCASE_SCENES = 2;

const hasVideoMedia = (project: CreatorProject) => Boolean(project.mediaUrl && project.mediaType === "video");

function resolvePresentation(project: CreatorProject): ProjectScene["presentation"] {
  if (project.presentationMode === "live" && hasVideoMedia(project)) return "live";
  if (project.presentationMode !== "auto" && project.presentationMode !== "live") return project.presentationMode;
  if (hasVideoMedia(project)) return "live";
  if (project.architecture.length >= 2) return "architecture";
  if (project.workflow.length >= 2) return "workflow";
  return "browser";
}
const themePalettes = [
  { accent: "#f25f52", secondary: "#78d7c2" },
  { accent: "#f1c75b", secondary: "#69b8de" },
  { accent: "#ff7b54", secondary: "#91d3c4" },
  { accent: "#df5f7d", secondary: "#78c9b0" },
] as const;

const hashText = (value: string) => Array.from(value).reduce((total, character) => ((total * 31) + (character.codePointAt(0) || 0)) >>> 0, 7);

function resolveProjectTheme(project: CreatorProject) {
  return themePalettes[hashText(`${project.name}|${project.tech.join("|")}|${project.desc}`) % themePalettes.length];
}

function fallbackProjectAsset(project: CreatorProject): ProfileMediaAsset {
  return {
    id: `story-${project.id}`,
    name: project.name || "Project",
    mimeType: project.mediaType === "video" ? "video/mp4" : project.mediaType === "image" ? "image/webp" : "application/pdf",
    size: 0,
    kind: project.mediaType === "video" ? "project-video" : project.mediaType === "image" ? "project-image" : "project-document",
    purpose: project.mediaType === "video" ? "demo" : project.mediaType === "image" ? "photo" : "document",
    createdAt: new Date(0).toISOString(),
    projectId: project.id,
    comment: project.desc,
    analysisStatus: "draft",
    narrativeBeats: [],
  };
}

function buildProjectStoryBeats(
  project: CreatorProject,
  profile: UserProfile,
  mediaClips: ProjectScene["mediaClips"],
): ProjectScene["storyBeats"] {
  type StoryBeat = ProjectScene["storyBeats"][number];
  const clean = (value: string | undefined) => (value || "").replace(/\s+/g, " ").trim();
  const meaningful = (value: string | undefined) => isNarrativePlaceholder(value) ? "" : clean(value);
  const shorten = (value: string, length = 104) => value.length > length ? `${value.slice(0, length - 1)}…` : value;
  const comments = mediaClips.map((clip) => clip.comment).filter(Boolean);
  const commentFacts = comments.map(parseNarrativeFacts);
  const resumeExcerpt = findResumeProjectExcerpt(profile.resume, project.name, project.url);
  const resumeFacts = parseNarrativeFacts(resumeExcerpt);
  const firstFact = (key: keyof ReturnType<typeof parseNarrativeFacts>) => meaningful(commentFacts.find((facts) => meaningful(facts[key]))?.[key]);
  const narrativeBeats = mediaClips.flatMap((clip, mediaIndex) => clip.narrativeBeats.map((item) => ({ ...item, mediaIndex })));
  const narrativeFor = (phase: StoryBeat["phase"]) => narrativeBeats.find((item) => item.phase === phase && meaningful(item.body));
  const subject = clean(project.name) || "这个项目";
  const hookNarrative = narrativeFor("hook");
  const contextNarrative = narrativeFor("context");
  const actionNarrative = narrativeFor("action");
  const evidenceNarrative = narrativeFor("evidence");
  const resultNarrative = narrativeFor("result");
  const reflectionNarrative = narrativeFor("reflection");
  const problem = meaningful(contextNarrative?.body) || firstFact("problem") || meaningful(resumeFacts.problem) || meaningful(project.desc);
  const role = firstFact("role") || meaningful(resumeFacts.role) || meaningful(project.role);
  const actionParts = [meaningful(actionNarrative?.body), firstFact("action"), meaningful(resumeFacts.action), ...project.workflow, ...project.highlights]
    .map(clean)
    .filter((value, index, values) => meaningful(value) && values.indexOf(value) === index)
    .slice(0, 3);
  const action = actionParts.join(" → ");
  const result = meaningful(resultNarrative?.body) || firstFact("result") || meaningful(resumeFacts.result) || meaningful(project.impact);
  const reflection = meaningful(reflectionNarrative?.body) || firstFact("reflection") || meaningful(resumeFacts.reflection);
  const explicitEvidence = meaningful(evidenceNarrative?.body) || firstFact("evidence") || meaningful(resumeFacts.evidence);
  const keywords = (...values: Array<string | string[] | undefined>) => [...new Set(values.flatMap((value) => Array.isArray(value) ? value : [value])
    .flatMap((value) => clean(value).split(/[，。；、|/：:·×→]/))
    .map(clean)
    .filter((value) => value.length >= 2 && value.length <= 20))].slice(0, 5);
  const videoIndices = mediaClips.map((clip, index) => clip.mediaType === "video" ? index : -1).filter((index) => index >= 0);
  const mediaIndices = videoIndices.length ? videoIndices : mediaClips.map((_, index) => index);
  const moments = videoIndices.flatMap((mediaIndex) => {
    const clip = mediaClips[mediaIndex];
    const explicit = parseNarrativeTimestamps(clip.comment)
      .filter((moment) => !clip.durationInSeconds || moment.seconds < clip.durationInSeconds)
      .map((moment) => ({ mediaIndex, start: moment.seconds, label: moment.label }));
    if (explicit.length) return explicit;
    const duration = clip.durationInSeconds;
    const ratios = [0.06, 0.4, 0.72];
    return ratios.map((ratio, index) => ({
      mediaIndex,
      start: duration > 0 ? Math.max(0, Math.min(duration - 3.6, duration * ratio)) : index * 3.6,
      label: "",
    }));
  });
  const momentFor = (index: number) => moments[index % Math.max(1, moments.length)];
  const mediaFor = (index: number) => mediaIndices[index % Math.max(1, mediaIndices.length)];
  const withMedia = (beat: StoryBeat, index: number, full = false): StoryBeat => {
    if (!mediaIndices.length) return beat;
    const moment = momentFor(index);
    const mediaIndex = moment?.mediaIndex ?? mediaFor(index);
    const duration = mediaClips[mediaIndex]?.durationInSeconds || 0;
    const start = moment?.start ?? 0;
    return {
      ...beat,
      layout: full && videoIndices.length ? "media-full" : "split",
      mediaIndex,
      trimStartInSeconds: Math.max(0, start),
      trimDurationInSeconds: duration > 0 ? Math.max(2.8, Math.min(4.2, duration - start)) : 3.6,
    };
  };
  const beat = (phase: StoryBeat["phase"], title: string, body: string, visual: StoryBeat["visual"], cue: string, beatKeywords: string[], source?: typeof narrativeBeats[number]): StoryBeat => ({
    phase,
    title: shorten(meaningful(source?.title) || title, 36),
    body: shorten(meaningful(source?.body) || body),
    visualCue: meaningful(source?.visualCue) || cue,
    layout: source?.layout || "fullscreen",
    visual: source?.visual || visual,
    keywords: [...new Set([...(source?.keywords || []), ...beatKeywords])].slice(0, 5).length
      ? [...new Set([...(source?.keywords || []), ...beatKeywords])].slice(0, 5)
      : [subject],
  });

  const hookBody = meaningful(hookNarrative?.body) || (result
    ? `${profile.name || "创作者"}通过 ${subject} 形成了明确成果：${result}。下面从真实项目画面回到过程。`
    : problem
      ? `${profile.name || "创作者"}用真实素材介绍 ${subject}，并从项目背景、个人职责到实机画面依次展开。`
      : `${profile.name || "创作者"}用真实项目画面介绍 ${subject}。`);
  const actionBody = [role ? `职责：${role}` : "", action ? `推进：${action}` : ""].filter(Boolean).join("；");
  const evidenceMoment = momentFor(2);
  const evidenceLabel = meaningful(evidenceMoment?.label) || explicitEvidence;
  const evidenceBody = evidenceLabel
    ? `这段画面重点展示：${evidenceLabel}。`
    : `${subject} 的真实录屏保留了界面状态、操作过程与反馈。`;

  const beats: StoryBeat[] = [beat("hook", `${profile.name || "创作者"} · ${subject}`, hookBody, "kinetic", "建立人物、作品与主题之间的关系。", keywords(profile.name, subject, result), hookNarrative)];
  if (problem) beats.push(withMedia(beat("context", `为什么做 ${subject}`, problem, "network", "左侧交代问题，右侧进入第一段真实素材。", keywords(problem, subject), contextNarrative), 0));
  if (actionBody) beats.push(withMedia(beat("action", role ? `我负责：${role}` : "关键实现路径", actionBody, "workflow", "按已提供的职责与动作组织实现路径。", keywords(role, actionParts, project.tech), actionNarrative), 1));

  const evidenceBeat = withMedia(beat(
    "evidence",
    evidenceMoment ? `重点片段 · ${Math.floor(evidenceMoment.start / 60).toString().padStart(2, "0")}:${Math.floor(evidenceMoment.start % 60).toString().padStart(2, "0")}` : "真实画面证据",
    evidenceBody,
    "media-focus",
    "让真实产品、实机操作或路演片段成为叙事证据。",
    keywords(evidenceLabel, explicitEvidence, subject),
    evidenceNarrative,
  ), 2, true);
  beats.push(evidenceBeat);

  if (mediaIndices.length) {
    const supportingEvidence = [
      { title: `${subject} · 项目全貌`, body: `继续通过真实素材观察 ${subject} 的界面、流程与当前完成状态。` },
      { title: `${subject} · 操作细节`, body: "保留连续操作片段，让交互过程与画面反馈自然完成说明。" },
    ];
    let mediaBeatCount = beats.filter((item) => item.layout !== "fullscreen").length;
    let supportIndex = 0;
    while (mediaBeatCount < 3 && supportIndex < supportingEvidence.length) {
      const support = supportingEvidence[supportIndex];
      beats.push(withMedia(beat("evidence", support.title, support.body, "media-focus", "用更长的真实片段补足文字较少时的画面信息。", keywords(subject, project.tech)), 3 + supportIndex, supportIndex === 1));
      mediaBeatCount += 1;
      supportIndex += 1;
    }
  }

  if (result) beats.push(withMedia(beat("result", `${subject} 的结果`, result, /\d|%|倍|项|人|次/.test(result) ? "metric" : "compare", "用已提供的结果收束项目。", keywords(result, project.highlights), resultNarrative), 4));
  if (reflection) beats.push(beat("reflection", `${subject} 留下的方法`, reflection, "kinetic", "把明确复盘转化为下一段经历的过渡。", keywords(reflection, subject), reflectionNarrative));
  return beats;
}

function fitStoryboardDuration(scenes: CreatorScene[], fps: number): CreatorScene[] {
  const projectScenes = scenes.filter((scene) => scene.type === "project");
  const targetSeconds = projectScenes.length >= 2 ? 36 : projectScenes.length === 1 ? 32 : 30;
  const targetFrames = targetSeconds * fps;
  const currentFrames = scenes.reduce((total, scene) => total + scene.durationInFrames, 0);
  const scale = targetFrames / Math.max(1, currentFrames);
  const paced = scenes.map((scene) => ({
    ...scene,
    durationInFrames: Math.max((scene.type === "project" ? 7 : 2.4) * fps, Math.round(scene.durationInFrames * scale)),
  }));
  const roundedFrames = paced.reduce((total, scene) => total + scene.durationInFrames, 0);
  const last = paced[paced.length - 1];
  if (last) last.durationInFrames += targetFrames - roundedFrames;
  return paced;
}

export function buildCreatorStoryboard(profile: UserProfile): CreatorStoryboard {
  const fps = 30;
  const experiences = profile.experiences.filter((item) => item.organization || item.role || item.period || item.summary || item.highlights.length);
  const education = profile.education.filter((item) => item.school || item.degree || item.field || item.period || item.result);
  const metrics = profile.metrics.filter((item) => item.label || item.value || item.context);
  const awards = profile.awards.filter((item) => item.title || item.issuer || item.date || item.detail);
  const papers = profile.papers.filter((item) => item.title || item.url || item.venue || item.contribution);
  const skills = profile.skills.filter((item) => item.name || item.evidence);
  const projects = profile.projects.filter((project) => project.name || project.desc || project.url || project.mediaUrl || project.mediaAssetIds.length || project.tech.length || project.highlights.length);
  const scenes: CreatorScene[] = [
    {
      id: "identity",
      type: "identity",
      durationInFrames: Math.round(3.5 * fps),
      eyebrow: "CREATOR SIGNAL / BEIJING",
      title: profile.bio || "把想法变成可以运行的作品",
      subtitle: profile.narrative || profile.resume || "欢迎来到我的数字展厅。",
      sourceLabel: "个人描述",
      name: profile.name || "Creator",
      role: profile.title || "AI Creator",
    },
  ];

  const timelineItems = [
    ...experiences.map((item) => ({
      period: item.period,
      heading: item.role,
      meta: item.organization,
      summary: item.summary || item.highlights.join(" · "),
    })),
    ...education.map((item) => ({
      period: item.period,
      heading: [item.degree, item.field].filter(Boolean).join(" · "),
      meta: item.school,
      summary: item.result || "教育经历",
    })),
  ].filter((item) => item.heading || item.meta).slice(0, 4);

  if (timelineItems.length) {
    scenes.push({
      id: "timeline",
      type: "timeline",
      durationInFrames: 3 * fps,
      eyebrow: "01 / TRAJECTORY",
      title: "我如何走到这里",
      subtitle: "不是职位清单，而是持续积累的能力证据。",
      sourceLabel: "经历 + 教育",
      items: timelineItems,
    });
  }

  if (metrics.length || awards.length) {
    scenes.push({
      id: "evidence",
      type: "evidence",
      durationInFrames: 3 * fps,
      eyebrow: "02 / EVIDENCE",
      title: "让结果先说话",
      subtitle: profile.transcript || "成绩、奖项与可核验的影响。",
      sourceLabel: "成绩 + 奖项",
      metrics: metrics.slice(0, 4).map((item) => ({ label: item.label, value: item.value, context: item.context || "" })),
      awards: awards.slice(0, 3).map((item) => ({ title: item.title, issuer: item.issuer, date: item.date })),
    });
  }

  const experienceMedia = profile.mediaAssets.filter((asset) => !asset.projectId && asset.experienceId && asset.kind !== "resume" && asset.runtimeUrl).slice(0, 1);
  const filmPriority = ["project-creator-city", "project-colorbook", "project-scrap-loop", "reference-mooncut", "reference-roundtable"];
  const prioritizedProjects = projects
    .map((project, sourceIndex) => {
      const assetIds = new Set([...(project.mediaAssetIds || []), project.mediaAssetId || ""].filter(Boolean));
      const hasUploadedMedia = profile.mediaAssets.some((asset) => asset.runtimeUrl && (asset.projectId === project.id || assetIds.has(asset.id)));
      const priorityIndex = filmPriority.indexOf(project.id);
      const score = (hasUploadedMedia ? 1000 : 0)
        + (project.mediaType === "video" ? 180 : project.mediaUrl ? 120 : 0)
        + (project.ownership === "owned" ? 80 : 0)
        + (priorityIndex >= 0 ? 50 - priorityIndex : 0)
        - sourceIndex * .01;
      return { project, score };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, MAX_SHOWCASE_SCENES - experienceMedia.length))
    .map(({ project }) => project);

  prioritizedProjects.forEach((project, index) => {
    let presentation = resolvePresentation(project);
    const projectAssetIds = new Set([...(project.mediaAssetIds || []), project.mediaAssetId || ""].filter(Boolean));
    const mediaClips = profile.mediaAssets
      .filter((asset) => (asset.projectId === project.id || projectAssetIds.has(asset.id)) && asset.kind !== "resume" && asset.runtimeUrl)
      .map((asset) => ({
        assetId: asset.id,
        name: asset.name,
        mediaUrl: asset.runtimeUrl || "",
        mediaType: asset.kind === "project-video" ? "video" as const : asset.kind === "project-image" ? "image" as const : "document" as const,
        purpose: asset.purpose,
        comment: asset.comment,
        excerpt: asset.extractedText || "",
        durationInSeconds: asset.durationInSeconds || 0,
        narrativeBeats: asset.narrativeBeats.length && !shouldRegenerateNarrative(asset.narrativeBeats) ? asset.narrativeBeats : buildLocalMediaNarrative(asset, profile),
      }))
      .sort((left, right) => (left.mediaType === "video" ? 0 : 1) - (right.mediaType === "video" ? 0 : 1));
    if (mediaClips.some((clip) => clip.mediaType === "video")) presentation = "live";
    const storyBeats = buildProjectStoryBeats(project, profile, mediaClips);
    const theme = resolveProjectTheme(project);
    scenes.push({
      id: `project-${project.id || index}`,
      type: "project",
      durationInFrames: Math.round(Math.max(10, Math.min(16, storyBeats.length * 3.05)) * fps),
      eyebrow: `0${scenes.length} / PROJECT`,
      title: project.name || `Project ${index + 1}`,
      subtitle: project.desc || storyBeats[0]?.body || project.name,
      sourceLabel: project.ownership === "reference"
        ? `${project.sourceOwner || "外部作者"} 产品 / 架构参考（非本人项目）`
        : mediaClips.length ? `${mediaClips.length} 份叙事素材` : presentation === "live" ? "实机视频" : presentation === "architecture" ? "架构说明" : presentation === "workflow" ? "流程说明" : "本人 GitHub 项目",
      projectId: project.id,
      projectName: project.name,
      projectUrl: project.url || "",
      role: project.role || "",
      impact: project.impact || "",
      tech: project.tech.slice(0, 5),
      highlights: project.highlights.slice(0, 4),
      presentation,
      mediaUrl: project.mediaUrl || "",
      mediaType: project.mediaType,
      accent: theme.accent,
      secondary: theme.secondary,
      mediaClips,
      storyBeats,
      architecture: project.architecture.slice(0, 5),
      workflow: project.workflow.slice(0, 5),
    });
  });

  experienceMedia.slice(0, Math.max(0, MAX_SHOWCASE_SCENES - prioritizedProjects.length)).forEach((asset, index) => {
    const experience = experiences.find((item) => item.id === asset.experienceId);
    if (!experience) return;
    const mediaType = asset.kind === "project-video" ? "video" as const : asset.kind === "project-image" ? "image" as const : "document" as const;
    const narrativeBeats = asset.narrativeBeats.length && !shouldRegenerateNarrative(asset.narrativeBeats) ? asset.narrativeBeats : buildLocalMediaNarrative(asset, profile);
    const experienceProject: CreatorProject = {
      id: `experience-${experience.id}`,
      name: experience.organization || experience.role,
      desc: experience.summary,
      tech: skills.slice(0, 4).map((skill) => skill.name).filter(Boolean),
      role: experience.role,
      impact: experience.highlights[0] || asset.comment,
      highlights: experience.highlights,
      presentationMode: mediaType === "video" ? "live" : "browser",
      mediaUrl: asset.runtimeUrl,
      mediaType,
      mediaAssetIds: [asset.id],
      architecture: [],
      workflow: [],
      ownership: "owned",
    };
    const mediaClips = [{ assetId: asset.id, name: asset.name, mediaUrl: asset.runtimeUrl || "", mediaType, purpose: asset.purpose, comment: asset.comment, excerpt: asset.extractedText || "", durationInSeconds: asset.durationInSeconds || 0, narrativeBeats }];
    const storyBeats = buildProjectStoryBeats(experienceProject, profile, mediaClips);
    const theme = resolveProjectTheme(experienceProject);
    scenes.push({
      id: `experience-media-${asset.id || index}`,
      type: "project",
      durationInFrames: Math.round(Math.max(10, Math.min(16, storyBeats.length * 3.05)) * fps),
      eyebrow: `0${scenes.length} / EXPERIENCE FILM`,
      title: experience.organization || experience.role || "实践经历",
      subtitle: experience.summary || asset.comment || "一段由真实素材支撑的经历",
      sourceLabel: "经历素材",
      projectId: `experience-${experience.id}`,
      projectName: experience.organization || experience.role,
      projectUrl: "",
      role: experience.role || "",
      impact: experience.highlights[0] || asset.comment || "",
      tech: skills.slice(0, 4).map((skill) => skill.name).filter(Boolean),
      highlights: experience.highlights.slice(0, 4),
      presentation: mediaType === "video" ? "live" : "browser",
      mediaUrl: asset.runtimeUrl || "",
      mediaType,
      accent: theme.accent,
      secondary: theme.secondary,
      mediaClips,
      storyBeats,
      architecture: [],
      workflow: [],
    });
  });

  if (papers.length) {
    scenes.push({
      id: "research",
      type: "research",
      durationInFrames: 3 * fps,
      eyebrow: "RESEARCH / FIELD NOTES",
      title: "研究如何进入产品",
      subtitle: "把问题、方法与贡献压缩为可读的研究卡片。",
      sourceLabel: "论文",
      papers: papers.slice(0, 3).map((paper) => ({
        title: paper.title,
        venue: paper.venue || "Research",
        contribution: paper.contribution || "连接研究发现与下一步产品验证",
      })),
    });
  }

  if (!papers.length && skills.length) {
    scenes.push({
      id: "skills",
      type: "skills",
      durationInFrames: 3 * fps,
      eyebrow: "CAPABILITY / PROOF",
      title: "技能背后有作品",
      subtitle: "能力不仅是一条进度条，也对应具体证据。",
      sourceLabel: "技能",
      skills: skills.slice(0, 6).map((skill) => ({ name: skill.name, level: skill.level, evidence: skill.evidence || "" })),
    });
  }

  scenes.push({
    id: "closing",
    type: "closing",
    durationInFrames: Math.round(3.5 * fps),
    eyebrow: "LET'S BUILD",
    title: "下一件作品，和谁一起完成？",
    subtitle: profile.lookingFor || "欢迎从项目、研究或一个具体问题开始交流。",
    sourceLabel: "合作方向",
    name: profile.name || "Creator",
    lookingFor: profile.lookingFor || "AI 创作工具与开源产品方向的合作者",
    links: [profile.githubUsername ? `github.com/${profile.githubUsername}` : "", ...profile.projectLinks].filter(Boolean).slice(0, 3),
  });

  return creatorStoryboardSchema.parse({
    version: 1,
    title: `${profile.name || "Creator"} / Creator Signal`,
    fps,
    visualTheme: profile.videoTheme,
    scenes: fitStoryboardDuration(scenes, fps),
  });
}
