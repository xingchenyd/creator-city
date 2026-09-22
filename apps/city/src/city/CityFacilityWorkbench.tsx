"use client";

import { Player } from "@remotion/player";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Coins,
  Copy,
  ExternalLink,
  Globe2,
  GitFork as Github,
  LoaderCircle,
  MapPin,
  Play,
  RefreshCw,
  Radio,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Timer,
  Trophy,
  Upload,
  UsersRound,
  X,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import {
  competitions,
  creatorMatches,
  hallTeamSignals,
  initialDevTasks,
  newsFallback,
  type CityHackathonEvent,
  type CityNewsItem,
  type DevTask,
} from "@/data/cityFacilities";
import { LiveModels, LiveSkills } from "@/city/LiveCatalogs";
import { CITY_NPCS } from "@/city/config/npcs";
import { projectsMuseum } from "@/data/mockData";
import { publicProfiles } from "@/data/publicProfiles";
import { loadProfile } from "@/features/profile";
import { usePersistentState } from "@/features/usePersistentState";
import { discoverMatches, escalateToHuman, preChat } from "@/services/agentNetwork";
import type { AgentInteraction, AgentProfile, SceneObjectDef, SceneObjectId } from "@/features/types";
import { CreatorIntro, type CreatorIntroProps } from "@/remotion/CreatorIntro";
import { buildCreatorStoryboard, getStoryboardDuration } from "@/remotion/storyboard";

type Props = { facility: SceneObjectDef; onClose: () => void };

const facilityMeta: Record<SceneObjectId, { icon: string; eyebrow: string; status: string; mark: string; ticker: string }> = {
  studio: { icon: "/pixel-icons/play.png", eyebrow: "REMOTION PROFILE STUDIO", status: "视频界面可打开", mark: "映", ticker: "PROFILE · STORY · MOTION · MEDIA · VIDEO" },
  homepage: { icon: "/pixel-icons/upload-file.png", eyebrow: "STATIC PERSONAL HOMEPAGE", status: "静态档案可查看", mark: "档", ticker: "PROFILE · EXPERIENCE · PROJECT · EVIDENCE · HOMEPAGE" },
  bulletin: { icon: "/pixel-icons/newspaper.png", eyebrow: "LIVE SIGNAL WALL", status: "公开源已接入", mark: "报", ticker: "AI · CODING · AGENT · GITHUB · LIVE SIGNAL" },
  leaderboard: { icon: "/pixel-icons/chart-up.png", eyebrow: "MODEL ARENA", status: "OpenRouter 目录", mark: "榜", ticker: "REASONING · CODING · PRICE · SPEED · CONTEXT" },
  skillgarden: { icon: "/pixel-icons/plant-pot.png", eyebrow: "WORKFLOW GARDEN", status: "GitHub 每日热榜", mark: "技", ticker: "SKILL · WORKFLOW · TOOL · INSTALL · PRACTICE" },
  "table-dev": { icon: "/pixel-icons/terminal.png", eyebrow: "BUILD & TEST DESK", status: "悬赏工作台在线", mark: "验", ticker: "BUILD · TEST · REWARD · EVIDENCE · REVIEW" },
  "table-social": { icon: "/pixel-icons/handshake-trim.png", eyebrow: "CREATOR MATCH", status: "匹配条件可编辑", mark: "遇", ticker: "PROFILE · EVIDENCE · MATCH · INVITE · MEET" },
  agentroundtable: { icon: "/pixel-icons/robot.png", eyebrow: "CHAT DEBATE HALL", status: "辩论群聊已接入", mark: "议", ticker: "AGENT · TOPIC · ARGUMENT · EVIDENCE · VERDICT" },
  hackathon: { icon: "/pixel-icons/team-trim.png", eyebrow: "HACKATHON HUB", status: "国内 / 国际赛事", mark: "赛", ticker: "UPCOMING · REGISTER · BUILD · SHIP · DEMO DAY" },
  agenthub: { icon: "/pixel-icons/play.png", eyebrow: "CREATOR FILM ARCHIVE", status: "Remotion 播放器在线", mark: "映", ticker: "CREATOR · FILM · PROJECT · STORY · SIGNAL" },
};

const formatDate = (value: string) => {
  if (!value) return "持续更新";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("zh-CN");
};

function NewsWorkbench() {
  const [items, setItems] = useState<CityNewsItem[]>(newsFallback);
  const [filter, setFilter] = useState<"ALL" | CityNewsItem["category"]>("ALL");
  const [fetchedAt, setFetchedAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/news", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.ok || !Array.isArray(result.data)) throw new Error("资讯源暂时不可用");
      setItems(result.data);
      setFetchedAt(result.fetchedAt || new Date().toISOString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "资讯源暂时不可用");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const visible = useMemo(() => filter === "ALL" ? items : items.filter((item) => item.category === filter), [filter, items]);

  return <div className="city-bench-news">
    <div className="city-bench-toolbar">
      <div className="city-bench-tabs" aria-label="资讯分类">{(["ALL", "AI", "CODING", "AGENT", "GITHUB"] as const).map((item) => <button type="button" className={filter === item ? "active" : ""} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div>
      <button className="city-bench-icon-button" type="button" onClick={() => void load()} disabled={loading} title="刷新公开资讯源"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /><span>{loading ? "刷新中" : "刷新"}</span></button>
    </div>
    <div className="city-bench-source"><span><i />OpenAI RSS · GitHub Blog RSS · GitHub Search API</span><time>{fetchedAt ? `更新于 ${new Date(fetchedAt).toLocaleString("zh-CN")}` : "正在读取公开源"}</time></div>
    {error && <p className="city-bench-notice">{error}，当前展示最近一次可用快照。</p>}
    <section className="city-news-list" aria-live="polite">{visible.map((item, index) => <article key={item.id}>
      <span className="city-news-index">{String(index + 1).padStart(2, "0")}</span>
      <div><p><b>{item.category}</b>{item.source} · {formatDate(item.publishedAt)}</p><h3>{item.title}</h3><span>{item.summary || "打开来源查看完整内容。"}</span></div>
      <a href={item.url} target="_blank" rel="noreferrer" title="打开原始来源"><ArrowUpRight size={18} /></a>
    </article>)}</section>
  </div>;
}

function GalleryWorkbench() {
  const [activeId, setActiveId] = useState(publicProfiles[0].id);
  const [view, setView] = useState<"film" | "projects">("film");
  const active = publicProfiles.find((profile) => profile.id === activeId) || publicProfiles[0];
  const storyboard = useMemo(() => buildCreatorStoryboard(active), [active]);
  const props: CreatorIntroProps = { storyboard };

  return <div className="city-gallery-bench">
    <div className="city-bench-toolbar"><div className="city-bench-tabs"><button type="button" className={view === "film" ? "active" : ""} onClick={() => setView("film")}><Play size={14} />主页影片</button><button type="button" className={view === "projects" ? "active" : ""} onClick={() => setView("projects")}><ClipboardCheck size={14} />项目档案</button></div><span>{publicProfiles.length} 位公开创作者 / 团队</span></div>
    <nav className="city-gallery-rail">{publicProfiles.map((profile, index) => <button type="button" className={active.id === profile.id ? "active" : ""} onClick={() => setActiveId(profile.id)} key={profile.id}><span>{String(index + 1).padStart(2, "0")}</span><b>{profile.name}</b><small>{profile.title}</small></button>)}</nav>
    {view === "film" ? <section className="city-gallery-screen"><div><Player component={CreatorIntro} inputProps={props} durationInFrames={getStoryboardDuration(storyboard)} fps={storyboard.fps} compositionWidth={1280} compositionHeight={720} controls loop style={{ width: "100%", aspectRatio: "16 / 9" }} /></div><aside><p>NOW SCREENING</p><h3>{active.name}</h3><strong>{active.title}</strong><span>{active.bio}</span><dl>{active.metrics.slice(0, 3).map((metric) => <div key={metric.id}><dt>{metric.label}</dt><dd>{metric.value}</dd><small>{metric.context}</small></div>)}</dl><a href={`https://github.com/${active.githubUsername}`} target="_blank" rel="noreferrer"><Github size={15} />{active.githubUsername}<ArrowUpRight size={14} /></a></aside></section> : <section className="city-gallery-projects">{active.projects.map((project, index) => <article key={project.id}><span>{String(index + 1).padStart(2, "0")}</span><div><small>{project.role}</small><h3>{project.name}</h3><p>{project.desc}</p><div>{project.tech.map((tech) => <b key={tech}>{tech}</b>)}</div></div><a href={project.url} target="_blank" rel="noreferrer" title="打开项目来源"><ArrowUpRight size={18} /></a></article>)}</section>}
    <p className="city-bench-footnote">档案只引用公开 GitHub 信息；qybaihe、OpenHands、browser-use 与 Creator City 无隶属或合作背书关系。</p>
  </div>;
}

function StudioWorkbench() {
  const [hasProfile, setHasProfile] = useState(false);
  useEffect(() => { setHasProfile(Boolean(loadProfile())); }, []);
  return <div className="city-studio-bench">
    <motion.section className="city-studio-stage" initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .45 }}>
      <div className="city-studio-lens" aria-hidden="true"><i /><i /><i /><span>36s</span></div>
      <div><p>LIVE REMOTION PIPELINE</p><h3>任何履历，都先变成有证据的故事</h3><span>项目视频、路演、图片、PDF 与 GitHub 会按“问题—行动—证据—结果—复盘”重新编排，不播放统一底片。</span></div>
      <b><Radio size={13} />USER-SPECIFIC RENDER</b>
    </motion.section>
    <section className="city-studio-flow">
      <article><span>01</span><img src="/pixel-icons/upload-file.png" alt="" /><div><b>输入与绑定</b><p>上传项目素材，并说明它对应哪段经历与哪一个时间点。</p></div></article>
      <article><span>02</span><img src="/pixel-icons/sparkle-star.png" alt="" /><div><b>叙事与分镜</b><p>从事实中提取命题、职责、行动和可核验结果，再决定 Motion 节拍。</p></div></article>
      <article><span>03</span><img src="/pixel-icons/play.png" alt="" /><div><b>现场生成</b><p>左侧 Motion、右侧真实素材协同演示，Remotion 按当前用户数据渲染。</p></div></article>
    </section>
    <footer className="city-studio-actions">
      <a className={!hasProfile ? "primary" : ""} href="/onboarding">{hasProfile ? "编辑个人简历" : "创建个人简历"}</a>
      {hasProfile && <a href="/profile">查看个人主页</a>}
      {hasProfile && <a className="primary" href="/video"><Play size={15} />打开主页影片工作台</a>}
    </footer>
  </div>;
}

function AgentRoundtableWorkbench() {
  const agents = CITY_NPCS.filter((agent) => agent.id !== "tea-steward").slice(0, 7);
  const [focusedId, setFocusedId] = useState(agents[0]?.id || "");
  const focused = agents.find((agent) => agent.id === focusedId) || agents[0];
  return <div className="city-agent-roundtable-bench">
    <section className="city-agent-orbit-board">
      <div className="city-agent-orbit-core"><img src="/pixel-icons/robot.png" alt="" /><b>AGENT BUS</b><span>接口层</span></div>
      {agents.map((agent, index) => <button type="button" className={agent.id === focused?.id ? "active" : ""} style={{ "--agent-index": index } as CSSProperties} onClick={() => setFocusedId(agent.id)} key={agent.id}><i /><b>{agent.nameCn}</b><span>{agent.role}</span></button>)}
    </section>
    {focused && <motion.aside key={focused.id} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }}>
      <p><Radio size={12} />CREATOR COUNCIL / READY</p><h3>{focused.nameCn}</h3><strong>{focused.role}</strong><span>{focused.desc}</span>
      <dl><div><dt>当前状态</dt><dd>多角色讨论引擎在线</dd></div><div><dt>讨论方式</dt><dd>立场 · 质询 · 收敛 · 纪要</dd></div><div><dt>控制权</dt><dd>用户选择成员并发起议题</dd></div></dl>
      <div>{focused.dialogue.map((line) => <blockquote key={line}>{line}</blockquote>)}</div>
      <a className="city-roundtable-enter" href={process.env.NEXT_PUBLIC_CHAT_DEBATE_URL || "/chat-debate/"}><Sparkles size={15} />带着该角色进入创作议事厅<ArrowUpRight size={15} /></a>
      <small><ShieldCheck size={13} />AI 观点用于辅助思考；无模型密钥时会明确提示不可用，不生成伪结果。</small>
    </motion.aside>}
  </div>;
}

function DevWorkbench() {
  const [tasks, setTasks] = usePersistentState<DevTask[]>("creator-city:dev-tasks:v1", initialDevTasks);
  const [claimed, setClaimed] = usePersistentState<number[]>("creator-city:claimed-tasks:v1", []);
  const [proofs, setProofs] = usePersistentState<Record<number, string>>("creator-city:task-proofs:v1", {});
  const [submitted, setSubmitted] = usePersistentState<number[]>("creator-city:submitted-tasks:v1", []);
  const [showRules, setShowRules] = useState(false);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [reward, setReward] = useState(100);
  const [money, setMoney] = useState(0);
  const [published, setPublished] = useState("");

  const publish = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !detail.trim()) return;
    const task: DevTask = { id: Math.max(0, ...tasks.map((item) => item.id)) + 1, title: title.trim(), repo: "xingchenyd/creator-city", type: "NEW", reward, money: money ? `¥${money}` : "", acceptance: detail.split(/\n|；|;/).map((item) => item.trim()).filter(Boolean), stack: ["待补充"], owner: "星辰", due: "待协商" };
    setTasks((current) => [task, ...current]);
    setPublished(task.title);
    setTitle("");
    setDetail("");
  };

  return <div className="city-dev-bench">
    <div className="city-bench-toolbar"><span><img src="/pixel-icons/terminal.png" alt="" />领取、证据文件名与发布状态已在本机持久保存</span><button type="button" onClick={() => setShowRules((current) => !current)}><ShieldCheck size={15} />{showRules ? "收起规则" : "验收规则"}</button></div>
    {showRules && <div className="city-dev-rules"><b>验收原则</b><span>任务必须写明环境、交付物和判定条件；积分与红包只在发布者确认后结算，初版不产生真实支付。</span></div>}
    <div className="city-dev-layout">
      <section className="city-dev-lane"><h3>待领取 <span>{tasks.filter((task) => !claimed.includes(task.id)).length}</span></h3>{tasks.filter((task) => !claimed.includes(task.id)).map((task) => <article key={task.id}><header><span>{task.type}</span><b><Coins size={13} />{task.reward} 积分 {task.money}</b></header><h4>{task.title}</h4><a href={`https://github.com/${task.repo}`} target="_blank" rel="noreferrer"><Github size={13} />{task.repo}</a><dl>{task.acceptance.map((item) => <dd key={item}><CheckCircle2 size={11} />{item}</dd>)}</dl><footer><span><Clock3 size={12} />{task.due}</span><button type="button" onClick={() => setClaimed((current) => current.includes(task.id) ? current : [...current, task.id])}>领取任务</button></footer></article>)}</section>
      <section className="city-dev-lane active"><h3>我的工作台 <span>{claimed.length}</span></h3>{claimed.length ? tasks.filter((task) => claimed.includes(task.id)).map((task) => <article key={task.id}><header><span>{submitted.includes(task.id) ? "SUBMITTED" : "IN PROGRESS"}</span><b>{task.reward} 积分</b></header><h4>{task.title}</h4><label className="city-proof-upload"><Upload size={15} /><span>{proofs[task.id] || "选择截图、日志或说明文件"}</span><input type="file" accept="image/*,.txt,.md,.log,.pdf" onChange={(event) => setProofs((current) => ({ ...current, [task.id]: event.target.files?.[0]?.name || "" }))} /></label><button type="button" className="submit-proof" disabled={!proofs[task.id] || submitted.includes(task.id)} onClick={() => setSubmitted((current) => [...current, task.id])}>{submitted.includes(task.id) ? <><Check size={14} />已提交验收</> : "提交验收证据"}</button></article>) : <div className="city-empty-state"><img src="/pixel-icons/code.png" alt="" /><b>还没有领取任务</b><span>从左侧选择一个验收条件明确的任务。</span></div>}</section>
      <form className="city-dev-publish" onSubmit={publish}><img src="/pixel-icons/gift.png" alt="" /><h3>发布悬赏</h3><label>任务标题<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：移动端上传流程回归" /></label><label>验收标准<textarea value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="每行一条可核验的交付标准" /></label><div><label>积分<input type="number" min="0" value={reward} onChange={(event) => setReward(Number(event.target.value))} /></label><label>红包 ¥<input type="number" min="0" value={money} onChange={(event) => setMoney(Number(event.target.value))} /></label></div><button type="submit" disabled={!title.trim() || !detail.trim()}>发布到开发桌</button>{published && <p><CheckCircle2 size={13} />“{published}”已进入待领取区</p>}</form>
    </div>
  </div>;
}

function SocialWorkbench() {
  const [criteria, setCriteria] = usePersistentState("creator-city:match-criteria:v1", "希望遇见懂 Agent 工程、愿意做开源产品、重视用户体验的人");
  const [agentOn, setAgentOn] = usePersistentState("creator-city:match-listening:v1", false);
  const [proposals, setProposals] = usePersistentState<Record<string, AgentInteraction[]>>("creator-city:meeting-proposals:v1", {});
  const [reviewed, setReviewed] = usePersistentState<string[]>("creator-city:meeting-review:v1", []);
  const [loadingId, setLoadingId] = useState("");
  const [signals, setSignals] = useState<Record<string, { score: number; reason: string }>>({});
  const [profile, setProfile] = useState<ReturnType<typeof loadProfile>>(null);

  const terms = useMemo(() => criteria.split(/[\s、，,。/×]+/).filter((term) => term.length > 1), [criteria]);
  useEffect(() => { setProfile(loadProfile()); }, []);
  const selfAgent: AgentProfile = useMemo(() => ({
    id: profile?.id || "guest-creator",
    ownerId: profile?.id || "guest",
    ownerName: profile?.name || "访客创作者",
    ownerType: "person",
    status: "active",
    skills: profile?.skills.map((skill) => skill.name) || ["产品设计", "内容创作"],
    interests: [...terms, ...(profile?.lookingFor ? profile.lookingFor.split(/[\s、，,。/×]+/) : [])].filter((item) => item.length > 1),
    verified: Boolean(profile?.projects.length),
  }), [profile?.id, profile?.lookingFor, profile?.name, profile?.projects.length, profile?.skills, terms]);
  const profileGithub = profile?.githubUsername.trim().toLowerCase() || "";
  const profileName = profile?.name.trim().toLowerCase() || "";
  const candidateAgents = useMemo<AgentProfile[]>(() => creatorMatches
    .filter((person) => {
      const sameGithub = Boolean(profileGithub) && person.handle.toLowerCase() === profileGithub;
      const sameProfileName = Boolean(profileName) && person.name.trim().toLowerCase() === profileName;
      return !sameGithub && !sameProfileName;
    })
    .map((person) => ({ id: `github:${person.handle}`, ownerId: person.handle, ownerName: person.name, ownerType: person.handle === "browser-use" || person.handle === "OpenHands" ? "enterprise" : "person", status: "active", skills: person.offers, interests: [...person.seeks, ...person.projects], verified: true })), [profileGithub, profileName]);

  useEffect(() => {
    let active = true;
    void discoverMatches(selfAgent, candidateAgents).then((matches) => {
      if (!active) return;
      setSignals(Object.fromEntries(matches.map((match) => [match.targetAgentId.replace("github:", ""), { score: match.matchScore, reason: match.reason }])));
    });
    return () => { active = false; };
  }, [candidateAgents, selfAgent]);

  const ranked = useMemo(() => creatorMatches
    .filter((person) => candidateAgents.some((candidate) => candidate.id === `github:${person.handle}`))
    .map((person) => ({ ...person, liveMatch: signals[person.handle] ? Math.round((signals[person.handle].score + person.match) / 2) : person.match, agentReason: signals[person.handle]?.reason || person.reason }))
    .sort((a, b) => b.liveMatch - a.liveMatch), [candidateAgents, signals]);
  const prepareProposal = async (handle: string) => {
    const target = candidateAgents.find((candidate) => candidate.id === `github:${handle}`);
    if (!target) return;
    setLoadingId(handle);
    const interaction = await preChat(selfAgent, target, 3);
    setProposals((current) => ({ ...current, [handle]: interaction }));
    setLoadingId("");
  };
  const confirmReview = async (handle: string) => {
    const last = proposals[handle]?.at(-1);
    if (!last || !await escalateToHuman(last.id)) return;
    setReviewed((current) => current.includes(handle) ? current : [...current, handle]);
  };

  return <div className="city-social-bench">
    <motion.aside initial={{ opacity: 0, x: -28 }} animate={{ opacity: 1, x: 0 }} transition={{ type: "spring", stiffness: 180, damping: 22 }}>
      <div className="city-social-orbit" aria-hidden="true"><i /><i /><i /></div>
      <img src="/pixel-icons/handshake-trim.png" alt="" />
      <p className="city-social-kicker"><Radio size={12} />MATCH AGENT / LISTENING</p>
      <h3>我想遇见</h3>
      <textarea value={criteria} onChange={(event) => setCriteria(event.target.value)} aria-label="交友匹配条件" />
      <div className="city-criteria-signal"><span>关键词信号</span><div>{terms.slice(0, 6).map((term) => <b key={term}>{term}</b>)}</div></div>
      <label className="city-agent-toggle"><span><b>离线时继续寻找</b><small>只计算匹配并通知，不让 Agent 私自对话</small></span><input type="checkbox" checked={agentOn} onChange={(event) => setAgentOn(event.target.checked)} /></label>
      <AnimatePresence>{agentOn && <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}><Sparkles size={13} />条件已保存在本机；只做匹配，不代替你向外发送消息。</motion.p>}</AnimatePresence>
    </motion.aside>
    <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .08, duration: .45 }}>
      <header><div><Search size={17} /><span><b>推荐会面</b><small>依据公开作品与能力证据实时重排</small></span></div><span>{ranked.length} 位候选</span></header>
      <AnimatePresence mode="popLayout">{ranked.map((person, index) => <motion.article layout key={person.handle} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .06 }} whileHover={{ x: 6 }}>
        <div className="city-match-score"><b>{person.liveMatch}</b><small>MATCH</small><i><em style={{ height: `${person.liveMatch}%` }} /></i></div>
        <div><span>PUBLIC GITHUB PROFILE</span><h3>{person.name}</h3><p>{person.title}</p><div>{person.offers.map((item) => <b key={item}>{item}</b>)}</div><blockquote>{person.agentReason}</blockquote><small>作品证据：{person.projects.join(" / ")}</small>{proposals[person.handle] && <ol className="city-prechat">{proposals[person.handle].map((item) => <li key={item.id}>{item.summary}</li>)}</ol>}</div>
        <footer><a href={`https://github.com/${person.handle}`} target="_blank" rel="noreferrer"><Github size={14} />核验作品</a>{!proposals[person.handle] ? <button type="button" disabled={loadingId === person.handle} onClick={() => void prepareProposal(person.handle)}>{loadingId === person.handle ? <LoaderCircle size={13} className="animate-spin" /> : <Send size={13} />}生成会面提案</button> : <button type="button" className={reviewed.includes(person.handle) ? "confirmed" : ""} onClick={() => void confirmReview(person.handle)}>{reviewed.includes(person.handle) ? <><Check size={13} />待本人确认</> : <><ShieldCheck size={13} />交给本人确认</>}</button>}</footer>
      </motion.article>)}</AnimatePresence>
    </motion.section>
  </div>;
}

function HackathonHubWorkbench() {
  const [view, setView] = useState<"board" | "teams" | "demos">("board");
  const [events, setEvents] = useState<CityHackathonEvent[]>(competitions);
  const [eventSource, setEventSource] = useState("官方报名入口快照");
  const [fetchedAt, setFetchedAt] = useState("");
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<"ALL" | "DOMESTIC" | "GLOBAL">("DOMESTIC");
  const [mode, setMode] = useState<"ALL" | CityHackathonEvent["mode"]>("ALL");
  const [sort, setSort] = useState<"deadline" | "evidence" | "prize">("deadline");
  const [saved, setSaved] = usePersistentState<string[]>("creator-city:saved-hackathons:v1", []);
  const [applied, setApplied] = usePersistentState<string[]>("creator-city:team-applications:v1", []);
  const [selectedEventId, setSelectedEventId] = useState(competitions[0]?.id || "");
  const [selectedDemo, setSelectedDemo] = useState(projectsMuseum[0].id);
  const [previewedDemo, setPreviewedDemo] = useState("");
  const demo = projectsMuseum.find((project) => project.id === selectedDemo) || projectsMuseum[0];
  const visibleEvents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const grade = { A: 3, B: 2, PORTAL: 1 } as const;
    const prizeValue = (value: string) => Number(value.replace(/[^0-9]/g, "")) || 0;
    return events.filter((event) => (region === "ALL" || event.region === region) && (mode === "ALL" || event.mode === mode) && (!needle || [event.name, event.organizer, event.location, event.summary, ...event.tags].join(" ").toLowerCase().includes(needle))).sort((a, b) => {
      const closed = (event: CityHackathonEvent) => event.status === "已结束" || event.status === "报名已截止";
      if (closed(a) !== closed(b)) return closed(a) ? 1 : -1;
      if (sort === "evidence") return grade[b.evidenceGrade] - grade[a.evidenceGrade];
      if (sort === "prize") return prizeValue(b.prize) - prizeValue(a.prize);
      return (a.deadlineAt ? new Date(a.deadlineAt).getTime() : Number.MAX_SAFE_INTEGER) - (b.deadlineAt ? new Date(b.deadlineAt).getTime() : Number.MAX_SAFE_INTEGER);
    });
  }, [events, region, mode, query, sort]);
  const featured = visibleEvents[0];
  const selectedEvent = visibleEvents.find((event) => event.id === selectedEventId) || visibleEvents[0];
  const countdown = (event: CityHackathonEvent) => {
    if (!event.deadlineAt) return event.deadline;
    const days = Math.ceil((new Date(event.deadlineAt).getTime() - Date.now()) / 86_400_000);
    return days > 0 ? `还剩 ${days} 天` : days === 0 ? "今天截止" : "已过截止时间，请核验官方页";
  };

  useEffect(() => {
    let active = true;
    fetch("/api/hackathons", { cache: "no-store" }).then((response) => response.json()).then((result) => {
      if (!active || !result.ok || !Array.isArray(result.data) || !result.data.length) return;
      setEvents(result.data);
      setEventSource(result.source || "官方报名入口");
      setFetchedAt(result.fetchedAt || "");
    }).catch(() => undefined).finally(() => { if (active) setLoadingEvents(false); });
    return () => { active = false; };
  }, []);

  return <div className="city-hub-bench">
    {featured && <motion.section className="city-hub-command" initial={{ opacity: 0, y: -22 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 180, damping: 22 }}>
      <div className="city-hub-radar" aria-hidden="true"><span /><i /><b><Zap size={22} /></b></div>
      <div className="city-hub-feature"><p><Radio size={12} />EVENT SPOTLIGHT</p><h3>{featured.name}</h3><div><span><CalendarDays size={13} />{featured.date}</span><span><MapPin size={13} />{featured.location}</span></div></div>
      <a href={featured.registrationUrl} target="_blank" rel="noreferrer"><span>查看官方赛事</span><ArrowUpRight size={19} /></a>
      <aside><b>{loadingEvents ? <LoaderCircle size={15} className="animate-spin" /> : <Globe2 size={15} />}{eventSource}</b><small>{fetchedAt ? `更新 ${new Date(fetchedAt).toLocaleDateString("zh-CN")}` : "正在同步赛事源"}</small></aside>
    </motion.section>}
    <div className="city-bench-tabs hub-tabs" role="tablist"><button type="button" className={view === "board" ? "active" : ""} onClick={() => setView("board")}><CalendarDays size={14} />近期赛事</button><button type="button" className={view === "teams" ? "active" : ""} onClick={() => setView("teams")}><UsersRound size={14} />AI 组队</button><button type="button" className={view === "demos" ? "active" : ""} onClick={() => setView("demos")}><Play size={14} />Demo 展示</button></div>
    <AnimatePresence mode="wait">
      {view === "board" && <motion.section key="board" className="city-hackathon-board" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: .28 }}>
        <header className="city-event-board-head"><div><Trophy size={18} /><span><b>赛事雷达 · 官方来源优先</b><small>人工核验快照，不抓取站点；报名资格和时间以官方页为准</small></span></div><a href="https://modelscope.cn/events" target="_blank" rel="noreferrer">探索更多国内赛事<ExternalLink size={13} /></a></header>
        <div className="city-event-filters"><select aria-label="赛事地区" value={region} onChange={(event) => setRegion(event.target.value as typeof region)}><option value="DOMESTIC">中国大陆</option><option value="GLOBAL">国际 / 全球</option><option value="ALL">全部地区</option></select><label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索主题、主办方或地点" /></label><div>{(["ALL", "ONLINE", "HYBRID", "IN PERSON"] as const).map((item) => <button type="button" className={mode === item ? "active" : ""} onClick={() => setMode(item)} key={item}>{item === "ALL" ? "全部形式" : item}</button>)}</div><label><SlidersHorizontal size={14} /><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="deadline">按截止时间</option><option value="evidence">按证据等级</option><option value="prize">按奖金规模</option></select></label></div>
        {selectedEvent && <motion.aside className="city-event-detail" key={selectedEvent.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><div><span>赛事档案 · EVIDENCE {selectedEvent.evidenceGrade}</span><h3>{selectedEvent.name}</h3><p>{selectedEvent.summary}</p></div><dl><div><dt>截止</dt><dd>{selectedEvent.deadline}</dd></div><div><dt>奖金</dt><dd>{selectedEvent.prize}</dd></div><div><dt>参赛资格</dt><dd>{selectedEvent.eligibility}</dd></div><div><dt>最近核验</dt><dd>{selectedEvent.verifiedAt}</dd></div></dl><a href={selectedEvent.registrationUrl} target="_blank" rel="noreferrer">打开官方报名页<ArrowUpRight size={15} /></a></motion.aside>}
        {visibleEvents.length ? <div className="city-competition-grid">{visibleEvents.map((competition, index) => <motion.article className={competition.id === selectedEvent?.id ? "selected" : ""} key={competition.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .055 }} whileHover={{ y: -5 }} onClick={() => setSelectedEventId(competition.id)}>
          <header><span>{String(index + 1).padStart(2, "0")}</span><b><i />{competition.status}</b><button type="button" className={saved.includes(competition.id) ? "saved" : ""} onClick={(event) => { event.stopPropagation(); setSaved((current) => current.includes(competition.id) ? current.filter((id) => id !== competition.id) : [...current, competition.id]); }} title={saved.includes(competition.id) ? "取消收藏" : "收藏赛事"}><Star size={15} fill={saved.includes(competition.id) ? "currentColor" : "none"} /></button></header>
          <p>{competition.organizer} · EVIDENCE {competition.evidenceGrade}</p><h3>{competition.name}</h3><time><Timer size={13} />{countdown(competition)}</time>
          <div className="city-event-route"><span>{competition.mode}</span><b>{competition.location}</b></div>
          <dl className="city-event-facts"><div><dt>DEADLINE</dt><dd>{competition.deadline}</dd></div><div><dt>PRIZE</dt><dd>{competition.prize}</dd></div></dl>
          <div className="city-event-tags">{competition.tags.map((tag) => <small key={tag}>{tag}</small>)}</div>
          <footer><a className="city-event-source" href={competition.sourceUrl} target="_blank" rel="noreferrer" title="查看赛事来源"><Globe2 size={14} />官方源</a><a className="city-event-register" href={competition.registrationUrl} target="_blank" rel="noreferrer">查看赛事详情<ArrowUpRight size={16} /></a></footer>
        </motion.article>)}</div> : <div className="city-empty-state"><Search size={24} /><b>没有符合条件的赛事</b><span>换一个关键词或赛事形式试试。</span></div>}
      </motion.section>}
      {view === "teams" && <motion.section key="teams" className="city-hub-teams" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }}>{hallTeamSignals.map((team, index) => <motion.article initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * .07 }} whileHover={{ x: 5 }} key={team.name}><div><span>TEAM SIGNAL</span><h3>{team.name}</h3><p>当前缺口：<b>{team.need}</b></p><div>{team.stack.map((item) => <small key={item}>{item}</small>)}</div></div><aside><strong>{team.match}%</strong><span>能力匹配</span><button type="button" onClick={() => setApplied((current) => current.includes(team.name) ? current : [...current, team.name])}>{applied.includes(team.name) ? "申请已提交" : "申请加入"}</button></aside></motion.article>)}</motion.section>}
      {view === "demos" && <motion.section key="demos" className="city-demo-layout" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }}><nav>{projectsMuseum.map((project) => <button type="button" className={project.id === demo.id ? "active" : ""} onClick={() => setSelectedDemo(project.id)} key={project.id}><span style={{ backgroundColor: project.cover }} /> <b>{project.title}</b><small>{project.category}</small></button>)}</nav><motion.article key={demo.id} initial={{ opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }}><span>{demo.category} · BY {demo.author}</span><h3>{demo.title}</h3><p>{demo.desc}</p><div>{demo.tech.map((tech) => <b key={tech}>{tech}</b>)}</div><dl><div><dt>项目仓库</dt><dd>{demo.github}</dd></div>{demo.demo && <div><dt>在线 Demo</dt><dd>{demo.demo}</dd></div>}</dl><button type="button" onClick={() => { setPreviewedDemo(demo.id); window.open(`https://${demo.demo || demo.github}`, "_blank", "noopener,noreferrer"); }}><Play size={15} />{previewedDemo === demo.id ? "已打开项目预览" : "打开项目 Demo / 仓库"}</button></motion.article></motion.section>}
    </AnimatePresence>
  </div>;
}

function FacilityContent({ id }: { id: SceneObjectId }) {
  switch (id) {
    case "studio": return <StudioWorkbench />;
    case "homepage": return <StudioWorkbench />;
    case "bulletin": return <NewsWorkbench />;
    case "leaderboard": return <LiveModels />;
    case "skillgarden": return <LiveSkills />;
    case "agenthub": return <GalleryWorkbench />;
    case "table-dev": return <DevWorkbench />;
    case "table-social": return <SocialWorkbench />;
    case "agentroundtable": return <AgentRoundtableWorkbench />;
    case "hackathon": return <HackathonHubWorkbench />;
  }
}

export function CityFacilityWorkbench({ facility, onClose }: Props) {
  const meta = facilityMeta[facility.id];
  const openedAt = useRef(Date.now());
  return <motion.div className="city-workbench-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .28 }} onMouseDown={(event) => { if (event.currentTarget === event.target && Date.now() - openedAt.current > 350) onClose(); }}>
    <motion.section initial={{ opacity: 0, y: 38, scale: .965 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 165, damping: 22 }} className={`city-workbench city-workbench-${facility.id}`} data-testid="city-facility-workbench" data-facility={facility.id} data-mark={meta.mark} role="dialog" aria-modal="true" aria-label={facility.nameCn}>
      <div className="city-workbench-eaves" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></div>
      <header className="city-workbench-header"><div className="city-workbench-icon"><img src={meta.icon} alt="" /></div><div><p>{meta.eyebrow}</p><h2>{facility.nameCn}</h2><span>{facility.desc}</span></div><aside><span><i />{meta.status}</span><button type="button" onClick={onClose} title="返回院落" aria-label="关闭功能区"><X size={20} /></button></aside></header>
      <div className="city-workbench-ticker" aria-hidden="true"><span>{meta.ticker} · {meta.ticker} · {meta.ticker}</span></div>
      <motion.div className="city-workbench-body" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .16, duration: .36 }}><FacilityContent id={facility.id} /></motion.div>
    </motion.section>
  </motion.div>;
}
