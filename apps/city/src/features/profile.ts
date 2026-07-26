/**
 * Portable creator profile used by onboarding, the storyboard builder and the
 * public profile. The browser store is an MVP persistence layer only.
 */

import { isGuestSession, loadSession } from "./session";
import { supabase } from "../lib/supabase";

export const PROFILE_VERSION = 6 as const;
export const STORAGE_KEY = "creator-city-profile";

export type AvatarTone = "jade" | "red" | "blue" | "gold";
export type VideoTheme = "beijing-night" | "paper-archive" | "signal-lab" | "gallery-white";
export type PresentationMode = "auto" | "live" | "browser" | "architecture" | "workflow";
export type ProjectMediaType = "video" | "image" | "document";
export type ProjectOwnership = "owned" | "reference";
export type ProfileMediaKind = "resume" | "project-video" | "project-image" | "project-document";
export type ProfileMediaPurpose = "demo" | "pitch" | "evidence" | "process" | "photo" | "document" | "resume";
export type MediaAnalysisStatus = "pending" | "draft" | "analyzed" | "failed";
export type NarrativeBeatPhase = "hook" | "context" | "action" | "evidence" | "result" | "reflection";
export type NarrativeBeatLayout = "fullscreen" | "split" | "media-full";
export type NarrativeMotionVisual = "kinetic" | "network" | "workflow" | "metric" | "compare" | "media-focus";

export type MediaNarrativeBeat = {
  phase: NarrativeBeatPhase;
  title: string;
  body: string;
  visualCue: string;
  layout: NarrativeBeatLayout;
  visual: NarrativeMotionVisual;
  keywords: string[];
};

export type ProfileMediaAsset = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: ProfileMediaKind;
  purpose: ProfileMediaPurpose;
  createdAt: string;
  projectId?: string;
  experienceId?: string;
  comment: string;
  extractedText?: string;
  durationInSeconds?: number;
  width?: number;
  height?: number;
  analysisStatus: MediaAnalysisStatus;
  narrativeBeats: MediaNarrativeBeat[];
  runtimeUrl?: string;
  runtimeStatus?: "ready" | "missing" | "error";
  runtimeError?: string;
};

export type CreatorProject = {
  id: string;
  name: string;
  desc: string;
  url?: string;
  tech: string[];
  role?: string;
  impact?: string;
  highlights: string[];
  presentationMode: PresentationMode;
  mediaUrl?: string;
  mediaType?: ProjectMediaType;
  mediaAssetId?: string;
  mediaAssetIds: string[];
  architecture: string[];
  workflow: string[];
  ownership: ProjectOwnership;
  sourceOwner?: string;
};

export type CreatorExperience = {
  id: string;
  organization: string;
  role: string;
  period: string;
  summary: string;
  highlights: string[];
};

export type CreatorEducation = {
  id: string;
  school: string;
  degree: string;
  field: string;
  period: string;
  result?: string;
};

export type CreatorAward = {
  id: string;
  title: string;
  issuer: string;
  date: string;
  detail?: string;
};

export type CreatorMetric = {
  id: string;
  label: string;
  value: string;
  context?: string;
};

export type CreatorPaper = {
  title: string;
  url: string;
  venue?: string;
  contribution?: string;
};

export type UserProfile = {
  version: typeof PROFILE_VERSION;
  id: string;
  name: string;
  title: string;
  bio: string;
  githubUsername: string;
  projectLinks: string[];
  papers: CreatorPaper[];
  resume: string;
  transcript: string;
  narrative: string;
  lookingFor: string;
  skills: { name: string; level: number; evidence?: string }[];
  projects: CreatorProject[];
  experiences: CreatorExperience[];
  education: CreatorEducation[];
  awards: CreatorAward[];
  metrics: CreatorMetric[];
  mediaAssets: ProfileMediaAsset[];
  createdAt: string;
  updatedAt: string;
  avatarTone: AvatarTone;
  videoTheme: VideoTheme;
};

const text = (value: unknown) => typeof value === "string" ? value : "";
const textList = (value: unknown) => Array.isArray(value) ? value.map(text).filter(Boolean) : [];
const recordList = (value: unknown) => Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
const makeId = (prefix: string, index = 0) => `${prefix}-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 6)}`;
const narrativeVisuals: NarrativeMotionVisual[] = ["kinetic", "network", "workflow", "metric", "compare", "media-focus"];
const narrativeLayouts: NarrativeBeatLayout[] = ["fullscreen", "split", "media-full"];

const fallbackVisualForPhase = (phase: NarrativeBeatPhase): NarrativeMotionVisual => ({
  hook: "kinetic",
  context: "network",
  action: "workflow",
  evidence: "media-focus",
  result: "metric",
  reflection: "kinetic",
} satisfies Record<NarrativeBeatPhase, NarrativeMotionVisual>)[phase];

const fallbackLayoutForPhase = (phase: NarrativeBeatPhase): NarrativeBeatLayout =>
  phase === "hook" || phase === "reflection" ? "fullscreen" : "split";

export function normalizeProfile(input: unknown): UserProfile {
  const fallback = createEmptyProfile();
  if (!input || typeof input !== "object") return fallback;
  const raw = input as Record<string, unknown>;

  const projects = recordList(raw.projects).map((project, index): CreatorProject => {
    const requestedMode = text(project.presentationMode);
    const presentationMode: PresentationMode = ["auto", "live", "browser", "architecture", "workflow"].includes(requestedMode)
      ? requestedMode as PresentationMode
      : "auto";
    const mediaType = text(project.mediaType);
    const legacyMediaAssetId = text(project.mediaAssetId);
    const mediaAssetIds = [...new Set([...textList(project.mediaAssetIds), legacyMediaAssetId].filter(Boolean))];
    return {
      id: text(project.id) || makeId("project", index),
      name: text(project.name),
      desc: text(project.desc),
      url: text(project.url) || undefined,
      tech: textList(project.tech),
      role: text(project.role) || undefined,
      impact: text(project.impact) || undefined,
      highlights: textList(project.highlights),
      presentationMode,
      mediaUrl: text(project.mediaUrl) || undefined,
      mediaType: mediaType === "video" || mediaType === "image" || mediaType === "document" ? mediaType : undefined,
      mediaAssetId: mediaAssetIds[0] || undefined,
      mediaAssetIds,
      architecture: textList(project.architecture),
      workflow: textList(project.workflow),
      ownership: text(project.ownership) === "reference" ? "reference" : "owned",
      sourceOwner: text(project.sourceOwner) || undefined,
    };
  });

  return {
    ...fallback,
    version: PROFILE_VERSION,
    id: text(raw.id) || fallback.id,
    name: text(raw.name),
    title: text(raw.title),
    bio: text(raw.bio),
    githubUsername: text(raw.githubUsername),
    projectLinks: textList(raw.projectLinks),
    resume: text(raw.resume),
    transcript: text(raw.transcript),
    narrative: text(raw.narrative),
    lookingFor: text(raw.lookingFor),
    avatarTone: ["jade", "red", "blue", "gold"].includes(text(raw.avatarTone)) ? text(raw.avatarTone) as AvatarTone : "jade",
    videoTheme: ["beijing-night", "paper-archive", "signal-lab", "gallery-white"].includes(text(raw.videoTheme))
      ? text(raw.videoTheme) as VideoTheme
      : "beijing-night",
    papers: recordList(raw.papers).map((paper) => ({
      title: text(paper.title),
      url: text(paper.url),
      venue: text(paper.venue) || undefined,
      contribution: text(paper.contribution) || undefined,
    })),
    skills: recordList(raw.skills).map((skill) => ({
      name: text(skill.name),
      level: Math.min(100, Math.max(0, Number(skill.level) || 0)),
      evidence: text(skill.evidence) || undefined,
    })),
    projects,
    experiences: recordList(raw.experiences).map((item, index) => ({
      id: text(item.id) || makeId("experience", index),
      organization: text(item.organization),
      role: text(item.role),
      period: text(item.period),
      summary: text(item.summary),
      highlights: textList(item.highlights),
    })),
    education: recordList(raw.education).map((item, index) => ({
      id: text(item.id) || makeId("education", index),
      school: text(item.school),
      degree: text(item.degree),
      field: text(item.field),
      period: text(item.period),
      result: text(item.result) || undefined,
    })),
    awards: recordList(raw.awards).map((item, index) => ({
      id: text(item.id) || makeId("award", index),
      title: text(item.title),
      issuer: text(item.issuer),
      date: text(item.date),
      detail: text(item.detail) || undefined,
    })),
    metrics: recordList(raw.metrics).map((item, index) => ({
      id: text(item.id) || makeId("metric", index),
      label: text(item.label),
      value: text(item.value),
      context: text(item.context) || undefined,
    })),
    mediaAssets: recordList(raw.mediaAssets).map((item, index) => {
      const kind = text(item.kind);
      const purpose = text(item.purpose);
      const analysisStatus = text(item.analysisStatus);
      return {
        id: text(item.id) || makeId("media", index),
        name: text(item.name) || `Media ${index + 1}`,
        mimeType: text(item.mimeType) || "application/octet-stream",
        size: Math.max(0, Number(item.size) || 0),
        kind: (["resume", "project-video", "project-image", "project-document"].includes(kind) ? kind : "project-image") as ProfileMediaKind,
        purpose: (["demo", "pitch", "evidence", "process", "photo", "document", "resume"].includes(purpose)
          ? purpose
          : kind === "resume" ? "resume" : kind === "project-video" ? "demo" : kind === "project-image" ? "photo" : "document") as ProfileMediaPurpose,
        createdAt: text(item.createdAt) || new Date().toISOString(),
        projectId: text(item.projectId) || undefined,
        experienceId: text(item.experienceId) || undefined,
        comment: text(item.comment),
        extractedText: text(item.extractedText) || undefined,
        durationInSeconds: Number(item.durationInSeconds) > 0 ? Number(item.durationInSeconds) : undefined,
        width: Number(item.width) > 0 ? Number(item.width) : undefined,
        height: Number(item.height) > 0 ? Number(item.height) : undefined,
        analysisStatus: (["pending", "draft", "analyzed", "failed"].includes(analysisStatus) ? analysisStatus : "pending") as MediaAnalysisStatus,
        narrativeBeats: recordList(item.narrativeBeats).map((beat) => {
          const phase = (["hook", "context", "action", "evidence", "result", "reflection"].includes(text(beat.phase)) ? text(beat.phase) : "action") as NarrativeBeatPhase;
          const visual = text(beat.visual);
          const layout = text(beat.layout);
          return {
            phase,
            title: text(beat.title),
            body: text(beat.body),
            visualCue: text(beat.visualCue),
            visual: narrativeVisuals.includes(visual as NarrativeMotionVisual) ? visual as NarrativeMotionVisual : fallbackVisualForPhase(phase),
            layout: narrativeLayouts.includes(layout as NarrativeBeatLayout) ? layout as NarrativeBeatLayout : fallbackLayoutForPhase(phase),
            keywords: textList(beat.keywords).slice(0, 5),
          };
        }).filter((beat) => beat.title || beat.body),
      };
    }),
    createdAt: text(raw.createdAt) || fallback.createdAt,
    updatedAt: text(raw.updatedAt) || fallback.updatedAt,
  };
}

export function loadProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const storage = isGuestSession() ? sessionStorage : localStorage;
    const storageKey = getProfileStorageKey();
    const legacy = isGuestSession() || storageKey === STORAGE_KEY ? null : localStorage.getItem(STORAGE_KEY);
    const raw = storage.getItem(storageKey) || legacy;
    if (!raw) return null;
    if (legacy && !storage.getItem(storageKey)) {
      localStorage.setItem(storageKey, legacy);
      localStorage.removeItem(STORAGE_KEY);
    }
    let normalized = normalizeProfile(JSON.parse(raw));
    const isUntouchedLegacyDemo = normalized.id === "demo-creator" && (
      normalized.projects.some((project) => project.id === "project-radar")
      || normalized.education.some((item) => item.school === "北京创意科技大学")
    );
    if (isUntouchedLegacyDemo) {
      const builtin = createBuiltinProfile();
      storage.setItem(storageKey, JSON.stringify(builtin));
      return builtin;
    }
    const hasLegacyIdentity = normalized.id === "builtin-yu-dongyachi" || normalized.name === "林墨" || normalized.name === "于董雅池";
    if (hasLegacyIdentity) {
      normalized = {
        ...normalized,
        id: normalized.id === "builtin-yu-dongyachi" ? "builtin-xingchen" : normalized.id,
        name: "星辰",
        updatedAt: new Date().toISOString(),
      };
    }
    storage.setItem(storageKey, JSON.stringify(normalized));
    return normalized;
  } catch {
    return null;
  }
}

export function saveProfile(profile: UserProfile): void {
  if (typeof window === "undefined") return;
  const normalized = normalizeProfile(profile);
  const storage = isGuestSession() ? sessionStorage : localStorage;
  storage.setItem(getProfileStorageKey(), JSON.stringify(normalized));
  if (!isGuestSession()) void saveProfileToCloud(normalized);
}

export async function loadCloudProfile(): Promise<UserProfile | null> {
  if (isGuestSession()) return loadProfile();
  if (!supabase) return loadProfile();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return loadProfile();

  const { data, error } = await supabase
    .from("profiles")
    .select("profile_json")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.profile_json) return loadProfile();
  const normalized = normalizeProfile(data.profile_json);
  if (typeof window !== "undefined") {
    localStorage.setItem(getProfileStorageKey(), JSON.stringify(normalized));
  }
  return normalized;
}

export async function saveProfileToCloud(profile: UserProfile): Promise<void> {
  if (isGuestSession()) return;
  if (!supabase) return;
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;
  const normalized = normalizeProfile(profile);
  const { error } = await supabase.from("profiles").upsert({
    user_id: userId,
    profile_json: normalized,
    display_name: normalized.name || null,
    avatar_url: normalized.mediaAssets.find((asset) => asset.purpose === "photo")?.runtimeUrl || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) console.warn("Failed to save Supabase profile", error.message);
}

function getProfileStorageKey() {
  if (isGuestSession()) return `${STORAGE_KEY}:guest`;
  const email = loadSession()?.email.trim().toLowerCase();
  return email ? `${STORAGE_KEY}:${encodeURIComponent(email)}` : STORAGE_KEY;
}

export function createEmptyProject(seed = 0): CreatorProject {
  return {
    id: makeId("project", seed),
    name: "",
    desc: "",
    tech: [],
    highlights: [],
    presentationMode: "auto",
    mediaAssetIds: [],
    architecture: [],
    workflow: [],
    ownership: "owned",
  };
}

export function createEmptyProfile(): UserProfile {
  const now = new Date().toISOString();
  return {
    version: PROFILE_VERSION,
    id: makeId("user"),
    name: "",
    title: "",
    bio: "",
    githubUsername: "",
    projectLinks: [],
    papers: [],
    resume: "",
    transcript: "",
    narrative: "",
    lookingFor: "",
    skills: [],
    projects: [],
    experiences: [],
    education: [],
    awards: [],
    metrics: [],
    mediaAssets: [],
    avatarTone: "jade",
    videoTheme: "beijing-night",
    createdAt: now,
    updatedAt: now,
  };
}

export function createBuiltinProfile(): UserProfile {
  const now = new Date().toISOString();
  return normalizeProfile({
    version: PROFILE_VERSION,
    id: "builtin-xingchen",
    name: "星辰",
    title: "数据分析 × AI 产品 × 商业分析",
    bio: "把数据、模型与复杂业务语境，转化为可以演示、验证和传播的产品叙事。",
    githubUsername: "xingchenyd",
    projectLinks: [
      "https://github.com/xingchenyd/creator-city",
      "https://github.com/xingchenyd/colorbook",
      "https://github.com/xingchenyd/scrap-loop",
      "https://github.com/xingchenyd/yd-academic-ppt",
      "https://github.com/xingchenyd/report-writing",
      "https://github.com/xingchenyd/xingchen-video-download",
    ],
    resume: "中南大学信息管理与信息系统专业本科在读，参与数据科学与商业分析卓越人才培养。擅长数据分析、AI 产品设计、商业建模和可视化表达，并持续把研究与创意做成可运行的作品。",
    transcript: "加权成绩 87/100；运筹学 93，高等数学 92，Python 91，博弈论 91，数据库 88；CET-4 558，CET-6 484。",
    narrative: "我习惯先拆解真实问题，再用数据、模型和产品原型建立一条可验证的路径。从城市文化叙事、环保回收游戏，到遥感图像零样本分类，我希望每项工作既有清晰的方法，也能被用户真实体验。",
    lookingFor: "AI 应用、数据产品、文化教育创意工具和黑客松方向的合作伙伴。",
    avatarTone: "jade",
    skills: [
      { name: "Python / SQL / R", level: 91, evidence: "数据采集、清洗、查询与分析" },
      { name: "AI 产品设计", level: 90, evidence: "从需求、原型到路演演示" },
      { name: "NLP 与文本分析", level: 86, evidence: "TF-IDF、情感与主题分析" },
      { name: "PyTorch / CLIP", level: 84, evidence: "遥感图像零样本分类实验" },
      { name: "商业分析", level: 88, evidence: "业务建模、实验设计与报告" },
      { name: "Remotion", level: 82, evidence: "数据驱动的个人主页视频" },
      { name: "Java", level: 76, evidence: "编程与系统基础" },
    ],
    metrics: [
      { id: "metric-score", label: "加权成绩", value: "87/100", context: "信息管理与信息系统" },
      { id: "metric-clip", label: "CLIP 实验提升", value: "0.3714 → 0.6714", context: "Vanilla 到 safe gated" },
      { id: "metric-repos", label: "公开 GitHub 仓库", value: "6", context: "github.com/xingchenyd" },
      { id: "metric-cet", label: "英语成绩", value: "558 / 484", context: "CET-4 / CET-6" },
    ],
    awards: [
      { id: "award-colorbook", title: "AI+文旅单元奖", issuer: "ColorBook『此地有回声』", date: "2026.05", detail: "负责产品策划、数据组织与城市叙事设计" },
    ],
    experiences: [
      { id: "exp-rail", organization: "轨道交通产业研究", role: "产业链与专利分析支持", period: "2026.07", summary: "围绕轨道交通业务链条组织企业、技术与专利信息，为研究判断提供结构化证据。", highlights: ["产业链梳理", "专利信息支持", "结构化研究输出"] },
      { id: "exp-clip", organization: "遥感图像研究", role: "CLIP 零样本分类改进", period: "2026.06", summary: "通过 Prompt Ensemble 与 safe gated 策略，将实验指标由 0.3714 提升至 0.6714。", highlights: ["PyTorch / CLIP", "Prompt Ensemble 0.6571", "safe gated 0.6714"] },
      { id: "exp-weibo", organization: "微博舆情分析", role: "数据采集与文本分析", period: "2026.04", summary: "完成微博数据采集、清洗，并使用关键词、情感与主题方法形成舆情分析。", highlights: ["爬虫与数据清洗", "TF-IDF", "情感与主题分析"] },
    ],
    education: [
      { id: "edu-csu", school: "中南大学", degree: "本科在读", field: "信息管理与信息系统（数据 / 优化方向）", period: "2024.09 - 2028.07", result: "数据科学与商业分析卓越人才培养；加权成绩 87/100" },
    ],
    papers: [
      { title: "基于 CLIP 的遥感图像零样本分类改进", url: "", venue: "实验研究 · 2026.06", contribution: "比较 Vanilla CLIP、Prompt Ensemble 与 safe gated 策略，最佳指标达到 0.6714。" },
    ],
    projects: [
      {
        id: "project-creator-city",
        name: "Creator City",
        desc: "以北京创作者社区为世界观，把简历、GitHub、实机视频和描述性资料编排成 Remotion 个人主页，并连接像素城市探索场景。",
        url: "https://github.com/xingchenyd/creator-city",
        tech: ["Next.js", "Remotion", "TypeScript", "GSAP", "IndexedDB"],
        role: "产品设计 / 全栈构建 / 视频叙事",
        impact: "建立从多源资料输入、媒体叙事到可分享个人主页的完整原型",
        highlights: ["结构化 Storyboard", "真实素材叙事", "北京像素社区", "Remotion Player"],
        presentationMode: "architecture",
        mediaAssetIds: [],
        architecture: ["简历 / GitHub / 媒体", "Creator Profile", "Narrative Storyboard", "Remotion Player", "Creator City"],
        workflow: ["导入资料", "关联证据", "生成分镜", "预览与发布"],
        ownership: "owned",
      },
      {
        id: "project-colorbook",
        name: "ColorBook · 此地有回声",
        desc: "面向北京与天津城市探索的桌游式产品，用本地叙事、地点卡牌和现实任务把文化内容转化为可参与的体验。",
        url: "https://github.com/xingchenyd/colorbook",
        tech: ["城市数据", "产品设计", "叙事设计", "Web Prototype"],
        role: "产品策划 / 数据组织 / 叙事设计",
        impact: "获得 AI+文旅单元奖，并完成从文化资料到可演示产品的转化",
        highlights: ["北京天津双城探索", "本地故事卡牌", "现实任务", "路演叙事"],
        presentationMode: "browser",
        mediaUrl: "/assets/builtin/colorbook-board.webp",
        mediaType: "image",
        mediaAssetIds: [],
        architecture: ["城市地点数据", "叙事卡牌", "任务系统", "探索反馈"],
        workflow: ["选择地点", "抽取故事", "完成任务", "留下城市记忆"],
        ownership: "owned",
      },
      {
        id: "project-scrap-loop",
        name: "Scrap Loop · 废品轮回",
        desc: "以环保回收为主题的像素 RPG，通过角色探索、物品分类与循环机制，把回收知识变成可玩的系统。",
        url: "https://github.com/xingchenyd/scrap-loop",
        tech: ["Pixel RPG", "Game Design", "Web", "Environmental Education"],
        role: "项目管理 / 产品设计 / Demo 构建",
        impact: "完成可直接游玩的环保主题网页游戏原型",
        highlights: ["像素探索", "回收循环", "教育叙事", "可部署 Demo"],
        presentationMode: "workflow",
        mediaAssetIds: [],
        architecture: ["地图与角色", "物品系统", "分类规则", "循环反馈"],
        workflow: ["探索地图", "发现废品", "完成分类", "解锁循环"],
        ownership: "owned",
      },
      {
        id: "project-academic-ppt",
        name: "yd-academic-ppt",
        desc: "用于学术与正式汇报的可复用 Codex Skill，将主题、材料和结构要求转化为规范化演示文稿。",
        url: "https://github.com/xingchenyd/yd-academic-ppt",
        tech: ["Codex Skill", "Presentation", "Prompt Design"],
        role: "技能设计 / 工作流封装",
        impact: "沉淀可复用的学术汇报生成流程",
        highlights: ["结构化输入", "版式规则", "可复用工作流"],
        presentationMode: "workflow",
        mediaAssetIds: [],
        architecture: [],
        workflow: ["读取材料", "建立提纲", "生成页面", "检查交付"],
        ownership: "owned",
      },
      {
        id: "project-report-writing",
        name: "report-writing",
        desc: "面向课程论文与正式报告的 LaTeX 写作技能，覆盖资料组织、学术版式、引用和可编译交付。",
        url: "https://github.com/xingchenyd/report-writing",
        tech: ["LaTeX", "Codex Skill", "Academic Writing"],
        role: "技能设计 / 模板工程",
        impact: "将报告写作流程固化为可检查、可编译的交付链路",
        highlights: ["学术模板", "结构检查", "PDF 编译"],
        presentationMode: "workflow",
        mediaAssetIds: [],
        architecture: [],
        workflow: ["整理证据", "写作正文", "规范引用", "编译检查"],
        ownership: "owned",
      },
      {
        id: "project-video-download",
        name: "xingchen-video-download",
        desc: "基于 FastAPI 的多平台视频解析与下载服务，为后续的项目素材采集和视频叙事提供工具能力。",
        url: "https://github.com/xingchenyd/xingchen-video-download",
        tech: ["FastAPI", "Python", "Media Pipeline", "API"],
        role: "后端开发 / 工具构建",
        impact: "形成可接入创作工作流的视频解析服务",
        highlights: ["多平台解析", "API 服务", "素材管线"],
        presentationMode: "architecture",
        mediaAssetIds: [],
        architecture: ["平台链接", "解析 API", "媒体信息", "下载输出"],
        workflow: ["提交链接", "解析资源", "选择格式", "生成下载"],
        ownership: "owned",
      },
      {
        id: "reference-mooncut",
        name: "MoonCut · 口播视频工作台",
        desc: "qybaihe 的开源 AI 口播视频工作台。本项目仅将其 TypeScript、Vue、Electron、SwiftUI、Remotion 与 FFmpeg 协作架构作为个人主页视频工作流参考，非本人作品。",
        url: "https://github.com/qybaihe/mooncut",
        tech: ["Remotion", "FFmpeg", "Vue", "Electron", "SwiftUI"],
        role: "架构参考（qybaihe，非本人项目）",
        impact: "参考其素材组织、时间线编排与跨端视频生产思路",
        highlights: ["AI 口播工作台", "多端架构", "Remotion 时间线", "Apache-2.0"],
        presentationMode: "browser",
        mediaUrl: "/assets/builtin/mooncut-home.png",
        mediaType: "image",
        mediaAssetIds: [],
        architecture: ["素材工作台", "AI 编排", "Remotion", "FFmpeg", "多端输出"],
        workflow: ["导入素材", "生成脚本", "编排时间线", "渲染成片"],
        ownership: "reference",
        sourceOwner: "qybaihe",
      },
      {
        id: "reference-roundtable",
        name: "Chat Debate · 辩论群聊",
        desc: "Creator City 中的多角色辩论群聊，保留原 Chat Debate 的角色化观点、调度与讨论体验。",
        url: "https://github.com/nankainankai/CREATOR-CITY",
        tech: ["SwiftUI", "React", "FastAPI", "PostgreSQL", "Remotion"],
        role: "Creator City 核心功能",
        impact: "把城市人物档案与原版多角色辩论链路连接起来",
        highlights: ["微信式群聊", "多视角讨论", "角色化表达", "个人 Agent"],
        presentationMode: "browser",
        mediaUrl: "/assets/builtin/pixel-roundtable-showcase.jpg",
        mediaType: "image",
        mediaAssetIds: [],
        architecture: ["像素空间", "角色身份", "讨论议题", "观点汇总", "视频输出"],
        workflow: ["进入群聊", "选择角色", "展开讨论", "沉淀观点"],
        ownership: "owned",
        sourceOwner: undefined,
      },
    ],
    createdAt: now,
    updatedAt: now,
  });
}

/** @deprecated Use createBuiltinProfile() for the shipped first-run profile. */
export function createDemoProfile(): UserProfile {
  return createBuiltinProfile();
}
