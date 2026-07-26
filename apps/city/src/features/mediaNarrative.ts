import type {
  MediaNarrativeBeat,
  NarrativeBeatLayout,
  NarrativeBeatPhase,
  NarrativeMotionVisual,
  ProfileMediaAsset,
  ProfileMediaPurpose,
  UserProfile,
} from "./profile";

export const narrativePhaseLabels: Record<NarrativeBeatPhase, string> = {
  hook: "开场钩子",
  context: "问题背景",
  action: "关键行动",
  evidence: "画面证据",
  result: "结果落点",
  reflection: "个人思考",
};

export const mediaPurposeLabels: Record<ProfileMediaPurpose, string> = {
  demo: "实机演示",
  pitch: "路演讲解",
  evidence: "结果证明",
  process: "过程记录",
  photo: "照片 / 截图",
  document: "论文 / 文档",
  resume: "简历",
};

const legacyNarrativePatterns = [
  /先看它把什么做成了/,
  /核心构建，是我推进的主线/,
  /完整交付链路/,
  /从想法变成了可以演示、验证和继续迭代的作品/,
  /待补充/,
  /尚未提供/,
  /请补充/,
  /仍需补充/,
  /no description/i,
];

export const isNarrativePlaceholder = (value: string | undefined) => !value?.trim()
  || legacyNarrativePatterns.some((pattern) => pattern.test(value));

export const shouldRegenerateNarrative = (beats: MediaNarrativeBeat[]) => {
  if (beats.length < 4) return true;
  if (beats.some((beat) => legacyNarrativePatterns.some((pattern) => pattern.test(`${beat.title} ${beat.body}`)))) return true;
  const phaseOrder: NarrativeBeatPhase[] = ["hook", "context", "action", "evidence", "result", "reflection"];
  const phasePositions = beats.map((beat) => phaseOrder.indexOf(beat.phase));
  if (phasePositions.some((position, index) => position < 0 || (index > 0 && position <= phasePositions[index - 1]))) return true;
  const bodies = beats.map((beat) => beat.body.replace(/[\s，。；、]/g, "").slice(0, 48)).filter(Boolean);
  if (new Set(bodies).size < Math.ceil(bodies.length * 0.7)) return true;
  return false;
};

const compact = (value: string | undefined, fallback: string, length = 76) => {
  const normalized = (value || "").replace(/\s+/g, " ").trim() || fallback;
  return normalized.length > length ? `${normalized.slice(0, length - 1)}…` : normalized;
};

const cleanKeywords = (...groups: Array<Array<string | undefined> | string | undefined>) => {
  const values = groups.flatMap((group) => Array.isArray(group) ? group : [group]);
  return [...new Set(values.flatMap((value) => {
    const normalized = (value || "").replace(/\s+/g, " ").trim();
    if (!normalized) return [];
    const metrics = normalized.match(/\d+(?:\.\d+)?(?:\s*(?:→|%|倍|万|k|K))?/g) || [];
    const phrases = normalized.split(/[，。；、|/：:·×]/).map((item) => item.trim()).filter((item) => item.length >= 2 && item.length <= 18);
    return [...phrases.slice(0, 2), ...metrics.slice(0, 1)];
  }))].slice(0, 5);
};

const visualForPhase = (phase: NarrativeBeatPhase, source: string): NarrativeMotionVisual => {
  if (phase === "hook" || phase === "reflection") return "kinetic";
  if (phase === "action") return "workflow";
  if (phase === "evidence") return "media-focus";
  if (phase === "result" && /\d|提升|增长|降低|达到|获得|完成/.test(source)) return "metric";
  if (/对比|实验|改进|前后|分类|模型|研究/.test(source)) return "compare";
  return "network";
};

const layoutForPhase = (phase: NarrativeBeatPhase): NarrativeBeatLayout =>
  phase === "hook" || phase === "reflection" ? "fullscreen" : "split";

export type NarrativeFacts = Partial<Record<"problem" | "role" | "action" | "evidence" | "result" | "reflection", string>>;

export type NarrativeTimestamp = {
  seconds: number;
  label: string;
};

const factLabels: Array<{ key: keyof NarrativeFacts; pattern: RegExp }> = [
  { key: "problem", pattern: /^(问题|背景|目标|挑战|需求|为什么)/ },
  { key: "role", pattern: /^(我负责|本人负责|角色|职责|分工)/ },
  { key: "action", pattern: /^(行动|方法|实现|做法|过程|方案|怎么做)/ },
  { key: "evidence", pattern: /^(证据|画面|重点看|镜头|演示|时间点)/ },
  { key: "result", pattern: /^(结果|成果|影响|数据|指标|产出)/ },
  { key: "reflection", pattern: /^(复盘|思考|方法论|下一步|收获)/ },
];

const trimFact = (value: string) => value
  .replace(/^[\s：:，,。；;是为-]+/, "")
  .replace(/[\s。；;]+$/, "")
  .trim();

const assignFact = (facts: NarrativeFacts, label: string, value: string) => {
  const match = factLabels.find((item) => item.pattern.test(label.trim()));
  const normalized = trimFact(match?.key === "role"
    ? value.split(/\s+(?=围绕|将|通过|完成|搭建|构建|负责)/)[0]
    : value);
  if (match && normalized && !facts[match.key]) facts[match.key] = normalized;
};

export const parseNarrativeFacts = (comment: string): NarrativeFacts => {
  const facts: NarrativeFacts = {};
  const clauses = comment
    .split(/\r?\n|[。！？；;|｜]/)
    .map((item) => item.trim())
    .filter(Boolean);

  for (const clause of clauses) {
    const labeled = clause.match(/^([^：:]{1,12})[：:]\s*(.+)$/);
    if (labeled) {
      assignFact(facts, labeled[1], labeled[2]);
      const definition = factLabels.find((item) => item.pattern.test(labeled[1].trim()));
      if (definition?.key === "role") {
        const boundary = labeled[2].search(/\s+(?=围绕|将|通过|完成|搭建|构建|负责)/);
        if (boundary >= 0) {
          const trailingFacts = parseNarrativeFacts(labeled[2].slice(boundary).trim());
          for (const [key, value] of Object.entries(trailingFacts) as Array<[keyof NarrativeFacts, string]>) {
            if (!facts[key] && value) facts[key] = value;
          }
        }
      }
      continue;
    }

    const aroundSubject = clause.match(/围绕[“"]([^”"]+)[”"]/);
    if (aroundSubject?.[1] && !facts.problem) facts.problem = trimFact(aroundSubject[1]);

    const inlineRules: Array<{ key: keyof NarrativeFacts; pattern: RegExp }> = [
      { key: "evidence", pattern: /(重点看|画面显示|镜头展示|演示了)/ },
      { key: "result", pattern: /(最终|结果是|成果是|带来了|提升到|降低到|获得了|项目获|获奖|获得|完成了)/ },
      { key: "role", pattern: /(我负责|本人负责|我的职责是|我担任)/ },
      { key: "action", pattern: /(^负责|我通过|我使用|我设计|我实现|我搭建|我完成|我把|将.+(?:抽象为|转化为)|围绕.+设计)/ },
      { key: "problem", pattern: /(要解决|为了|目标是|挑战是|问题是)/ },
      { key: "reflection", pattern: /(我学到|我意识到|这让我|下一步)/ },
    ];
    const match = inlineRules.find((item) => item.pattern.test(clause));
    if (match && !facts[match.key]) {
      const startPattern = match.key === "problem"
        ? /(要解决|为了|目标是|挑战是|问题是|围绕)/
        : match.key === "action"
          ? /(^负责|我通过|我使用|我设计|我实现|我搭建|我完成|我把|将|围绕)/
          : match.key === "result"
            ? /(最终|结果是|成果是|带来了|提升到|降低到|获得了|项目获|获奖|获得|完成了)/
            : null;
      const start = startPattern ? clause.search(startPattern) : -1;
      facts[match.key] = trimFact(start >= 0 ? clause.slice(start) : clause);
    }
  }

  return facts;
};

const timestampToSeconds = (value: string) => {
  const parts = value.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + parts[1];
};

export const parseNarrativeTimestamps = (comment: string): NarrativeTimestamp[] => {
  const moments: NarrativeTimestamp[] = [];
  const lines = comment.split(/\r?\n|[；;]/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    const matches = [...line.matchAll(/((?:\d{1,2}:)?\d{1,2}:\d{2})(?:\s*[—–-]?\s*)([^，。；;]*)/g)];
    for (const match of matches) {
      const seconds = timestampToSeconds(match[1]);
      const label = trimFact(match[2]
        .replace(/^(?:的|处|时|这里|画面|镜头|重点看)\s*/, "")
        .replace(/^(?:问题|背景|目标|挑战|需求|我负责|角色|职责|行动|方法|结果|复盘)[：:]\s*/, ""));
      if (!moments.some((moment) => Math.abs(moment.seconds - seconds) < 0.1)) {
        moments.push({ seconds, label });
      }
    }
  }
  return moments;
};

export const findResumeProjectExcerpt = (resume: string, subject: string, projectUrl = "") => {
  if (!resume.trim()) return "";
  const slug = projectUrl.replace(/[?#].*$/, "").replace(/\/+$/, "").split("/").filter(Boolean).pop()?.replace(/\.git$/i, "") || "";
  const aliases = [subject, slug]
    .flatMap((value) => [value, ...value.split(/[^a-z0-9\u4e00-\u9fff]+/i)])
    .map((value) => value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, ""))
    .filter((value, index, values) => value.length >= 4 && values.indexOf(value) === index);
  if (!aliases.length) return "";
  const chunks = resume.split(/\r?\n|(?<=[。！？；])/).map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean);
  const index = chunks.findIndex((chunk) => {
    const normalized = chunk.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
    return aliases.some((alias) => normalized.includes(alias));
  });
  if (index < 0) return "";
  const excerpt = chunks.slice(index, Math.min(chunks.length, index + 5)).join(" ");
  return excerpt.length > 520 ? `${excerpt.slice(0, 519)}…` : excerpt;
};

const factualMetricFor = (subject: string, profile: UserProfile) => {
  const normalizedSubject = subject.toLowerCase();
  const metric = profile.metrics.find((item) => {
    const source = `${item.label} ${item.context || ""}`.toLowerCase();
    return item.value.trim() && normalizedSubject.length >= 2 && source.includes(normalizedSubject);
  });
  if (!metric) return "";
  return [metric.value, metric.label, metric.context].filter(Boolean).join(" · ");
};

export function buildLocalMediaNarrative(asset: ProfileMediaAsset, profile: UserProfile): MediaNarrativeBeat[] {
  const project = profile.projects.find((item) => item.id === asset.projectId);
  const experience = profile.experiences.find((item) => item.id === asset.experienceId);
  const subject = project?.name || experience?.organization || asset.name.replace(/\.[^.]+$/, "") || "这段经历";
  const purpose = mediaPurposeLabels[asset.purpose];
  const comment = asset.comment.trim();
  const facts = parseNarrativeFacts(comment);
  const resumeExcerpt = project ? findResumeProjectExcerpt(profile.resume, project.name, project.url) : "";
  const resumeFacts = parseNarrativeFacts(resumeExcerpt);
  const projectDescription = isNarrativePlaceholder(project?.desc) ? "" : project?.desc || "";
  const problem = facts.problem || resumeFacts.problem || projectDescription || experience?.summary || "";
  const role = facts.role || project?.role || experience?.role || resumeFacts.role || "";
  const action = facts.action
    || resumeFacts.action
    || (project?.workflow.length ? project.workflow.join(" → ") : "")
    || project?.highlights[0]
    || experience?.highlights[0]
    || "";
  const matchedMetric = factualMetricFor(subject, profile);
  const result = facts.result || resumeFacts.result || project?.impact || matchedMetric || "";
  const timestamp = comment.match(/\d{1,2}:\d{2}(?::\d{2})?/)?.[0] || "";
  const evidence = facts.evidence || (!Object.keys(facts).length ? comment : "") || (asset.kind === "project-video"
    ? `${purpose}呈现 ${subject} 的真实界面与连续操作过程。`
    : asset.kind === "project-document"
      ? compact(asset.extractedText, `${subject} 的文档页面构成项目证据。`, 96)
      : `图片保留了 ${subject} 的真实界面或现场状态。`);
  const reflection = facts.reflection || resumeFacts.reflection || "";
  const sharedKeywords = cleanKeywords(
    subject,
    project?.tech,
    project?.highlights,
    experience?.highlights,
    problem,
    role,
    action,
    result,
    facts.evidence,
  );

  const beat = (phase: NarrativeBeatPhase, title: string, body: string, visualCue: string, keywords: Array<string | undefined>): MediaNarrativeBeat => ({
    phase,
    title,
    body,
    visualCue,
    layout: layoutForPhase(phase),
    visual: visualForPhase(phase, `${title} ${body}`),
    keywords: cleanKeywords(keywords, sharedKeywords),
  });

  const beats: MediaNarrativeBeat[] = [beat(
      "hook",
      compact(`${subject} · 先看真实作品`, "先让作品说话", 32),
      compact(
        result
          ? `${purpose}先呈现结果：${result}`
          : problem
            ? `${purpose}将从问题背景进入 ${subject} 的真实实现与画面证据。`
            : `下面用${purpose}介绍 ${subject}。`,
        "先看到真实作品，再理解过程。",
        92,
      ),
      "项目名与真实关键词分层进入，先建立命题，再把视线引向用户素材",
      [subject, result],
    )];
  if (problem) beats.push(beat(
      "context",
      compact(`为什么要做 ${subject}`, "问题从哪里开始", 32),
      compact(problem, "", 96),
      "左侧只使用已提供的问题、对象与约束生成关系图；右侧开始播放真实素材",
      [problem, subject],
    ));
  if (role || action) beats.push(beat(
      "action",
      compact(role ? `我负责：${role}` : "关键实现路径", "我负责的关键动作", 32),
      compact([role && `职责：${role}`, action && `推进：${action}`].filter(Boolean).join("；"), "", 96),
      "左侧按用户填写的职责、方法和流程依次推进，不补写未发生的工作",
      [role, action],
    ));
  beats.push(beat(
      "evidence",
      compact(timestamp ? `重点看 ${timestamp}` : `${purpose}中的证据`, "证据就在画面里", 32),
      compact(evidence, `${purpose}保留了项目的真实状态。`, 104),
      "右侧保留真实素材主体，左侧根据评论中的时间点与事实生成取景框和证据标签",
      [purpose, timestamp, facts.evidence],
    ));
  if (result) beats.push(beat(
      "result",
      compact(`${subject} 的可核验结果`, "结果如何被验证", 32),
      compact(result, "", 96),
      "只有存在真实数字或明确成果时才生成大数字与对比；否则显示待补充状态",
      [result, project?.impact],
    ));
  if (reflection) beats.push(beat(
      "reflection",
      compact(`从 ${subject} 沉淀的方法`, "这段经历留下什么", 32),
      compact(reflection, "", 96),
      "真实素材暂退，已提供的方法论关键词重新组合，并自然衔接下一段经历",
      [subject, reflection],
    ));
  return beats.filter((item) => !isNarrativePlaceholder(item.title) && !isNarrativePlaceholder(item.body));
}
export function normalizeNarrativeBeats(value: unknown): MediaNarrativeBeat[] {
  if (!Array.isArray(value)) return [];
  const phases: NarrativeBeatPhase[] = ["hook", "context", "action", "evidence", "result", "reflection"];
  const visuals: NarrativeMotionVisual[] = ["kinetic", "network", "workflow", "metric", "compare", "media-focus"];
  const layouts: NarrativeBeatLayout[] = ["fullscreen", "split", "media-full"];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    const phase = typeof raw.phase === "string" && phases.includes(raw.phase as NarrativeBeatPhase) ? raw.phase as NarrativeBeatPhase : phases[index] || "action";
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    const body = typeof raw.body === "string" ? raw.body.trim() : "";
    const visualCue = typeof raw.visualCue === "string" ? raw.visualCue.trim() : "";
    const visual = typeof raw.visual === "string" && visuals.includes(raw.visual as NarrativeMotionVisual) ? raw.visual as NarrativeMotionVisual : visualForPhase(phase, `${title} ${body}`);
    const requestedLayout = typeof raw.layout === "string" && layouts.includes(raw.layout as NarrativeBeatLayout) ? raw.layout as NarrativeBeatLayout : layoutForPhase(phase);
    const layout = phase === "hook" || phase === "reflection" ? "fullscreen" : requestedLayout;
    const keywords = Array.isArray(raw.keywords) ? raw.keywords.filter((keyword): keyword is string => typeof keyword === "string" && keyword.trim().length > 0).slice(0, 5) : cleanKeywords(title, body);
    return title || body ? [{ phase, title, body, visualCue, visual, layout, keywords }] : [];
  }).slice(0, 6);
}
