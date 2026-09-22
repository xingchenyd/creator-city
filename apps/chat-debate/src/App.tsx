import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  ArrowLeft,
  Award,
  Bot,
  Check,
  CircleAlert,
  Clipboard,
  Download,
  Home,
  Info,
  LoaderCircle,
  MessageCircleMore,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Send,
  Settings2,
  Sparkles,
  UserRoundPlus,
  Users,
  X,
} from "lucide-react";
import { AgentAvatar } from "@/components/AgentAvatar";
import { ProfileWizard } from "@/components/ProfileWizard";
import { profileToAgent, roundtableAgents, sampleProfile, sampleProfiles } from "@/data/agents";
import { ensureCloudSessionFromUrl, isGuestMode } from "@/lib/auth";
import { compileProfile } from "@/lib/profileCompiler";
import { buildOriginalTurnSchedule, type ScheduledTurn } from "@/lib/turnSchedule";
import { appendCloudMessages, createCloudDebate, deleteCloudProfile, loadCloudProfiles, recordCloudUsage, saveCloudProfile, updateCloudDebateRuntime } from "@/services/persistence";
import { generateDiscussionVerdict, generatePhase, generateScheduledBatch } from "@/services/roundtable";
import type {
  Agent,
  AgentRuntimeState,
  ChatMessage,
  DiscussionVerdict,
  PersonalAgentProfile,
  ProfileDraft,
  RoundtablePhase,
} from "@/types";

const STORAGE_KEY = "agent-group-chat.personal-profiles.v1";
const CREATOR_CITY_URL = import.meta.env.VITE_CREATOR_CITY_URL || "/city/neon";
export function App() {
  const [savedProfiles, setSavedProfiles] = useState<PersonalAgentProfile[]>(loadProfiles);
  const personalAgents = useMemo(
    () => [...sampleProfiles.map(profileToAgent), ...savedProfiles.map(profileToAgent)],
    [savedProfiles],
  );
  const allAgents = useMemo(() => [...personalAgents, ...roundtableAgents], [personalAgents]);
  const [selectedIds, setSelectedIds] = useState<string[]>([
    "product-editor", "evidence-researcher", "experience-designer", "systems-builder",
  ]);
  const [topicDraft, setTopicDraft] = useState("");
  const [activeTopic, setActiveTopic] = useState("");
  const [view, setView] = useState<"setup" | "chat">("setup");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [profileAgentId, setProfileAgentId] = useState("");
  const [mobileMembersOpen, setMobileMembersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.localStorage.getItem("creator-council:reduced-motion") === "1");
  const [comfortableText, setComfortableText] = useState(() => window.localStorage.getItem("creator-council:comfortable-text") !== "0");
  const [serviceStatus, setServiceStatus] = useState<{ configured: boolean; model: string } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [runtime, setRuntime] = useState<Record<string, AgentRuntimeState>>({});
  const [schedule, setSchedule] = useState<ScheduledTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAgentId, setLoadingAgentId] = useState("");
  const [error, setError] = useState("");
  const [model, setModel] = useState("");
  const [composer, setComposer] = useState("");
  const [replyTargetId, setReplyTargetId] = useState("");
  const [autoRunning, setAutoRunning] = useState(false);
  const [verdict, setVerdict] = useState<DiscussionVerdict | null>(null);
  const [verdictLoading, setVerdictLoading] = useState(false);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const generationLockRef = useRef(false);
  const verdictLockRef = useRef(false);
  const sessionIdRef = useRef(0);
  const failedUserReplyRef = useRef<FailedUserReply | null>(null);
  const urlHydratedRef = useRef(false);
  const debateIdRef = useRef<string | null>(null);

  const selectedAgents = useMemo(
    () => selectedIds.map((id) => allAgents.find((agent) => agent.id === id)).filter((agent): agent is Agent => Boolean(agent)),
    [allAgents, selectedIds],
  );
  const turnCount = messages.filter((message) => message.scheduledIndex !== undefined).length;
  const activePhase = schedule[Math.max(0, turnCount - 1)]?.phase ?? null;
  const profileAgent = allAgents.find((agent) => agent.id === profileAgentId);

  useEffect(() => {
    void ensureCloudSessionFromUrl().then(() => loadCloudProfiles()).then((profiles) => {
      if (!profiles.length) return;
      setSavedProfiles((current) => {
        const merged = [...current];
        for (const profile of profiles) {
          if (!merged.some((item) => item.id === profile.id)) merged.push(profile);
        }
        profileStorage().setItem(STORAGE_KEY, JSON.stringify(merged));
        return merged;
      });
    });
  }, []);

  useEffect(() => {
    fetch("/api/health").then((response) => response.json()).then((health) => {
      setServiceStatus({ configured: Boolean(health.ai_configured), model: String(health.model || "") });
    }).catch(() => setServiceStatus(null));
  }, []);

  useEffect(() => {
    window.localStorage.setItem("creator-council:reduced-motion", reducedMotion ? "1" : "0");
    window.localStorage.setItem("creator-council:comfortable-text", comfortableText ? "1" : "0");
  }, [comfortableText, reducedMotion]);

  useEffect(() => {
    if (urlHydratedRef.current) return;
    urlHydratedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const requestedIds = (params.get("participants") || "")
      .split(",")
      .map((value) => value.trim())
      .filter((id) => allAgents.some((agent) => agent.id === id));
    const uniqueIds = [...new Set(requestedIds)].slice(0, 6);
    if (uniqueIds.length >= 2) setSelectedIds(uniqueIds);
    const requestedProfile = params.get("profile") || "";
    if (allAgents.some((agent) => agent.id === requestedProfile)) setProfileAgentId(requestedProfile);
  }, [allAgents]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, loading, verdict, verdictLoading]);

  useEffect(() => {
    if (!replyTargetId && selectedAgents[0]) setReplyTargetId(selectedAgents[0].id);
  }, [replyTargetId, selectedAgents]);

  const toggleAgent = (id: string) => {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.length > 2 ? current.filter((value) => value !== id) : current;
      return current.length < 6 ? [...current, id] : current;
    });
  };

  const saveProfile = (draft: ProfileDraft) => {
    const profile = compileProfile(draft);
    const next = [...savedProfiles, profile];
    setSavedProfiles(next);
    profileStorage().setItem(STORAGE_KEY, JSON.stringify(next));
    void saveCloudProfile(profile);
    setSelectedIds((current) => [...current.filter((id) => id !== sampleProfile.id), profile.id].slice(0, 6));
    setReplyTargetId(profile.id);
    setWizardOpen(false);
  };

  const removeProfile = (id: string) => {
    const next = savedProfiles.filter((profile) => profile.id !== id);
    setSavedProfiles(next);
    profileStorage().setItem(STORAGE_KEY, JSON.stringify(next));
    void deleteCloudProfile(id);
    setSelectedIds((current) => current.filter((value) => value !== id));
  };

  const startChat = async () => {
    const topic = topicDraft.trim();
    if (!topic || selectedAgents.length < 2 || selectedAgents.length > 6 || generationLockRef.current) return;
    const originalSchedule = buildOriginalTurnSchedule(selectedAgents);
    const systemMessage: ChatMessage = {
      id: crypto.randomUUID(),
      speakerId: "moderator",
      speakerName: "议事记录员",
      role: "system",
      text: `创作议事厅已开启 · 议题：${topic}`,
      createdAt: new Date().toISOString(),
    };
    sessionIdRef.current += 1;
    debateIdRef.current = null;
    generationLockRef.current = false;
    failedUserReplyRef.current = null;
    setActiveTopic(topic);
    setMessages([systemMessage]);
    setRuntime({});
    setSchedule(originalSchedule);
    setError("");
    setLoading(false);
    setLoadingAgentId("");
    setAutoRunning(false);
    setVerdict(null);
    setVerdictLoading(false);
    setView("chat");
    debateIdRef.current = await createCloudDebate({
      topic,
      agents: selectedAgents,
      runtime: {},
      messages: [systemMessage],
    });
    setAutoRunning(true);
  };

  const nextTurns = useCallback(async () => {
    if (generationLockRef.current || turnCount >= schedule.length) return;
    const sessionId = sessionIdRef.current;
    const batch = schedule.slice(turnCount, turnCount + 1);
    if (!batch.length) return;
    generationLockRef.current = true;
    failedUserReplyRef.current = null;
    setError("");
    setLoadingAgentId(batch[0]?.agent.id ?? "");
    setLoading(true);
    try {
      const output = await generateScheduledBatch({
        topic: activeTopic,
        schedule: batch,
        allAgents: selectedAgents,
        runtime,
        messages,
      });
      if (sessionIdRef.current !== sessionId) return;
      setMessages((current) => {
        void appendCloudMessages(debateIdRef.current, output.messages, current.length);
        return [...current, ...output.messages];
      });
      setRuntime(output.runtime);
      setModel(output.model);
      void updateCloudDebateRuntime(debateIdRef.current, output.runtime);
      void recordCloudUsage({ debateId: debateIdRef.current, action: "roundtable_reply", model: output.model });
    } catch (reason) {
      if (sessionIdRef.current !== sessionId) return;
      setError(errorMessage(reason));
      setAutoRunning(false);
    } finally {
      if (sessionIdRef.current === sessionId) {
        generationLockRef.current = false;
        setLoading(false);
        setLoadingAgentId("");
      }
    }
  }, [activeTopic, messages, runtime, schedule, selectedAgents, turnCount]);

  const runUserReply = useCallback(async (input: FailedUserReply) => {
    if (generationLockRef.current) return;
    const sessionId = sessionIdRef.current;
    generationLockRef.current = true;
    setError("");
    setLoadingAgentId(input.target.id);
    setLoading(true);
    try {
      const output = await generatePhase({
        topic: input.topic,
        phase: input.phase,
        agents: input.agents,
        runtime: input.runtime,
        messages: input.messages,
        userTurn: {
          id: input.userMessage.id,
          text: input.userMessage.text,
          targetAgentId: input.target.id,
          targetAgentName: input.target.name,
        },
      });
      if (sessionIdRef.current !== sessionId) return;
      setMessages((current) => {
        void appendCloudMessages(debateIdRef.current, output.messages, current.length);
        return [...current, ...output.messages];
      });
      const nextRuntime = { ...input.runtime, ...output.runtime };
      setRuntime(nextRuntime);
      setModel(output.model);
      void updateCloudDebateRuntime(debateIdRef.current, nextRuntime);
      void recordCloudUsage({ debateId: debateIdRef.current, action: "roundtable_user_reply", model: output.model });
      failedUserReplyRef.current = null;
    } catch (reason) {
      if (sessionIdRef.current !== sessionId) return;
      failedUserReplyRef.current = input;
      setError(errorMessage(reason));
      setAutoRunning(false);
    } finally {
      if (sessionIdRef.current === sessionId) {
        generationLockRef.current = false;
        setLoading(false);
        setLoadingAgentId("");
      }
    }
  }, []);

  const sendUserMessage = () => {
    const text = composer.trim();
    const target = selectedAgents.find((agent) => agent.id === replyTargetId) ?? selectedAgents[0];
    if (!text || !target || generationLockRef.current) return;
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      speakerId: "user",
      speakerName: "你",
      role: "user",
      text,
      targetName: target.name,
      createdAt: new Date().toISOString(),
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    void appendCloudMessages(debateIdRef.current, [userMessage], messages.length);
    setVerdict(null);
    setComposer("");
    const request: FailedUserReply = {
      topic: activeTopic,
      phase: activePhase === "closing" ? "closing" : "rebuttal",
      agents: selectedAgents,
      runtime,
      messages: nextMessages,
      userMessage,
      target,
    };
    void runUserReply(request);
  };

  const retryFailedMessage = () => {
    setAutoRunning(true);
    const failedUserReply = failedUserReplyRef.current;
    if (failedUserReply) {
      void runUserReply(failedUserReply);
      return;
    }
    void nextTurns();
  };

  useEffect(() => {
    if (
      view !== "chat"
      || !autoRunning
      || loading
      || error
      || composer.trim()
      || turnCount >= schedule.length
    ) return;
    const timer = window.setTimeout(() => void nextTurns(), 600);
    return () => window.clearTimeout(timer);
  }, [autoRunning, composer, error, loading, nextTurns, schedule.length, turnCount, view]);

  useEffect(() => {
    if (view === "chat" && schedule.length > 0 && turnCount >= schedule.length) {
      setAutoRunning(false);
    }
  }, [schedule.length, turnCount, view]);

  const generateVerdict = useCallback(async () => {
    if (verdictLockRef.current || loading || verdict || turnCount < schedule.length || schedule.length === 0) return;
    const sessionId = sessionIdRef.current;
    verdictLockRef.current = true;
    setVerdictLoading(true);
    try {
      const result = await generateDiscussionVerdict({
        topic: activeTopic,
        agents: selectedAgents,
        messages,
      });
      if (sessionIdRef.current !== sessionId) return;
      setVerdict(result);
      if (result.model) setModel(result.model);
      void recordCloudUsage({ debateId: debateIdRef.current, action: "discussion_verdict", model: result.model });
    } catch {
      if (sessionIdRef.current === sessionId) {
        await new Promise((resolve) => window.setTimeout(resolve, 900));
      }
    } finally {
      if (sessionIdRef.current === sessionId) setVerdictLoading(false);
      verdictLockRef.current = false;
    }
  }, [activeTopic, loading, messages, schedule.length, selectedAgents, turnCount, verdict]);

  useEffect(() => {
    if (view !== "chat" || loading || verdict || verdictLoading || turnCount < schedule.length || schedule.length === 0) return;
    const timer = window.setTimeout(() => void generateVerdict(), 500);
    return () => window.clearTimeout(timer);
  }, [generateVerdict, loading, schedule.length, turnCount, verdict, verdictLoading, view]);

  const resetChat = () => {
    sessionIdRef.current += 1;
    debateIdRef.current = null;
    generationLockRef.current = false;
    verdictLockRef.current = false;
    failedUserReplyRef.current = null;
    setView("setup");
    setMessages([]);
    setRuntime({});
    setSchedule([]);
    setActiveTopic("");
    setError("");
    setModel("");
    setComposer("");
    setLoading(false);
    setLoadingAgentId("");
    setAutoRunning(false);
    setVerdict(null);
    setVerdictLoading(false);
  };

  const discussionMarkdown = () => {
    const transcript = messages.filter((message) => message.role !== "system").map((message) => `### ${message.speakerName}\n\n${displayMessageText(message.text)}`).join("\n\n");
    const conclusion = verdict ? `\n\n## 议事结论\n\n${verdict.conclusion}\n\n### 共识\n${verdict.consensus.map((item) => `- ${item}`).join("\n")}\n\n### 分歧\n${verdict.disagreements.map((item) => `- ${item}`).join("\n")}` : "";
    return `# 创作议事厅纪要\n\n**议题：** ${activeTopic || topicDraft || "未命名议题"}\n\n${transcript}${conclusion}\n`;
  };

  const downloadMinutes = () => {
    const blob = new Blob([discussionMarkdown()], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `creator-council-${new Date().toISOString().slice(0, 10)}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMoreOpen(false);
  };

  const copyConclusion = async () => {
    await navigator.clipboard.writeText(verdict?.conclusion || discussionMarkdown());
    setMoreOpen(false);
  };

  return (
    <div className={`app-viewport ${reducedMotion ? "reduce-motion" : ""} ${comfortableText ? "comfortable-text" : "compact-text"}`}>
      <div className="app-shell">
        <aside className="rail">
          <img src={`${import.meta.env.BASE_URL}assets/brand/app-icon.png`} className="brand-mark" alt="创作议事厅" />
          <span className="rail-button is-active" title="创作议事厅" aria-current="page"><MessageCircleMore size={21} /></span>
          <button className="rail-button" title="创建个人 Agent" onClick={() => setWizardOpen(true)}><UserRoundPlus size={21} /></button>
          <span className="rail-spacer" />
          <a className="rail-button" title="返回 Creator City" href={CREATOR_CITY_URL}><Home size={20} /></a>
          <button className="rail-button" title="设置" onClick={() => setSettingsOpen(true)}><Settings2 size={20} /></button>
        </aside>

        <aside className="conversation-sidebar">
          <div className="sidebar-title"><span>消息</span><button className="icon-button dark" title="新群聊" onClick={resetChat}><Plus size={18} /></button></div>
          <div className="conversation-item is-active" aria-current="page">
            <div className="conversation-avatar"><Users size={20} /></div>
            <div><strong>创作议事厅</strong><span>{view === "chat" ? activeTopic : "新议题"}</span></div>
            <time>{view === "chat" ? "刚刚" : ""}</time>
          </div>
          <div className="sidebar-section-title">个人 Agent</div>
          {personalAgents.map((agent) => (
            <div className="mini-agent" key={agent.id}>
              <AgentAvatar agent={agent} size={34} />
              <div><strong>{agent.name}</strong><span>{agent.role}</span></div>
              {savedProfiles.some((profile) => profile.id === agent.id) && <button title="删除" onClick={() => removeProfile(agent.id)}><X size={14} /></button>}
            </div>
          ))}
          <button className="add-agent-row" onClick={() => setWizardOpen(true)}><Plus size={16} />创建个人 Agent</button>
        </aside>

        <main className="chat-panel">
          <header className="chat-header">
            <button className="mobile-only icon-button" title="返回" onClick={resetChat}><ArrowLeft size={20} /></button>
            <div className="chat-heading">
              <h1>创作议事厅 <span>({selectedAgents.length})</span></h1>
              <p>{view === "chat" ? "多角色讨论进行中" : "选择议事成员与创作命题"}</p>
            </div>
            <div className="header-actions">
              <a className="icon-button city-return-button" title="返回 Creator City" href={CREATOR_CITY_URL}><Home size={18} /></a>
              <button className="icon-button" title="创建个人 Agent" onClick={() => setWizardOpen(true)}><UserRoundPlus size={19} /></button>
              <button className="icon-button mobile-only" title="群成员" onClick={() => setMobileMembersOpen(true)}><Users size={19} /></button>
              {view === "chat" && !error && turnCount < schedule.length && (
                <button
                  className={`icon-button auto-toggle ${autoRunning ? "is-running" : ""}`}
                  title={autoRunning ? "暂停自动讨论" : "继续自动讨论"}
                  onClick={() => setAutoRunning((value) => !value)}
                >
                  {autoRunning ? <Pause size={18} /> : <Play size={18} />}
                </button>
              )}
              {view === "chat" && <button className="icon-button" title="重新开始" onClick={resetChat}><RotateCcw size={18} /></button>}
              <button className="icon-button" title="更多" onClick={() => setMoreOpen((value) => !value)}><MoreHorizontal size={20} /></button>
              {moreOpen && <div className="header-menu"><button type="button" disabled={view !== "chat"} onClick={downloadMinutes}><Download size={15} />导出 Markdown 纪要</button><button type="button" disabled={view !== "chat"} onClick={() => void copyConclusion()}><Clipboard size={15} />复制讨论结论</button></div>}
            </div>
          </header>

          {view === "setup" ? (
            <SetupPanel
              personalAgents={personalAgents}
              roundtableAgents={roundtableAgents}
              selectedIds={selectedIds}
              topic={topicDraft}
              onTopicChange={setTopicDraft}
              onToggle={toggleAgent}
              onCreate={() => setWizardOpen(true)}
              onStart={startChat}
            />
          ) : (
            <>
              <div className="topic-strip"><span>{activeTopic}</span><button title="群成员" onClick={() => setMobileMembersOpen(true)}><Users size={15} />{selectedAgents.length}</button></div>
              <section className="messages" aria-label="群聊消息">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} agents={selectedAgents} />
                ))}
                {loading && <TypingRow agent={selectedAgents.find((agent) => agent.id === loadingAgentId) ?? selectedAgents[0]} />}
                {error && <div className="error-row"><CircleAlert size={16} /><span>{error}</span><button onClick={retryFailedMessage}>重试</button></div>}
                {verdictLoading && <VerdictLoadingRow />}
                {verdict && <DiscussionVerdictCard verdict={verdict} />}
                <div ref={messageEndRef} />
              </section>

              <div className="composer">
                <select value={replyTargetId} onChange={(event) => setReplyTargetId(event.target.value)} aria-label="选择回应 Agent">
                  {selectedAgents.map((agent) => <option key={agent.id} value={agent.id}>@{agent.name}</option>)}
                </select>
                <textarea
                  value={composer}
                  onChange={(event) => setComposer(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendUserMessage();
                    }
                  }}
                  placeholder="发送消息"
                  rows={1}
                />
                <button className="send-button" title="发送" disabled={!composer.trim() || loading} onClick={sendUserMessage}><Send size={18} /></button>
              </div>
            </>
          )}
        </main>

        <MemberPanel agents={selectedAgents} model={model} topic={view === "chat" ? activeTopic : topicDraft} serviceStatus={serviceStatus} />
      </div>

      {wizardOpen && <ProfileWizard onClose={() => setWizardOpen(false)} onSave={saveProfile} />}
      {settingsOpen && <div className="sheet-backdrop council-settings-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSettingsOpen(false)}><section className="council-settings" aria-label="议事厅设置"><header><div><small>CREATOR COUNCIL</small><h2>阅读与服务设置</h2></div><button className="icon-button" onClick={() => setSettingsOpen(false)}><X size={19} /></button></header><div><label><span><strong>舒适字号</strong><small>提高界面辅助文字与标签的可读性</small></span><input type="checkbox" checked={comfortableText} onChange={(event) => setComfortableText(event.target.checked)} /></label><label><span><strong>减少动态效果</strong><small>关闭气泡、弹层与状态动画</small></span><input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} /></label><article className={serviceStatus?.configured ? "ready" : "warning"}><Bot size={18} /><div><strong>AI 对话服务</strong><p>{serviceStatus === null ? "无法读取服务状态" : serviceStatus.configured ? `${serviceStatus.model} 已配置` : "未配置模型密钥；发起讨论时会明确报错，不会伪造回复"}</p></div></article></div></section></div>}
      {profileAgent && <AgentProfileSheet agent={profileAgent} selected={selectedIds.includes(profileAgent.id)} onClose={() => setProfileAgentId("")} onSelect={() => setSelectedIds((current) => current.includes(profileAgent.id) ? current : current.length < 6 ? [...current, profileAgent.id] : current)} />}
      {mobileMembersOpen && (
        <div className="mobile-members-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setMobileMembersOpen(false)}>
          <div className="mobile-members-sheet">
            <header><strong>议事成员 ({selectedAgents.length})</strong><button className="icon-button" onClick={() => setMobileMembersOpen(false)}><X size={18} /></button></header>
            <MemberList agents={selectedAgents} />
          </div>
        </div>
      )}
    </div>
  );
}

function AgentProfileSheet({ agent, selected, onClose, onSelect }: { agent: Agent; selected: boolean; onClose: () => void; onSelect: () => void }) {
  const profile = agent.profile;
  const priorities = profile?.runtime.attentionPriorities ?? [];
  const principles = profile?.portrait?.values.principles ?? [];
  return (
    <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="agent-profile-sheet" aria-label={`${agent.name} 的人物档案`}>
        <header className="agent-profile-header">
          <AgentAvatar agent={agent} size={58} />
          <div><small>{profile ? "PERSONAL AGENT PROFILE" : "BUILT-IN AGENT PERSONA"}</small><h2>{agent.name}</h2><p>{profile?.identity.headline || agent.role}</p></div>
          <button className="icon-button" type="button" onClick={onClose} title="关闭"><X size={19} /></button>
        </header>
        <div className="agent-profile-body">
          <section><strong>角色</strong><p>{agent.role}</p></section>
          <section><strong>核心判断</strong><p>{agent.coreBelief}</p></section>
          <section><strong>表达方式</strong><p>{agent.speechStyle}</p></section>
          <section><strong>辩论方式</strong><p>{agent.debateStyle}</p></section>
          {principles.length > 0 && <section><strong>重要原则</strong><ul>{principles.slice(0, 5).map((item) => <li key={item}>{item}</li>)}</ul></section>}
          {priorities.length > 0 && <section><strong>关注重点</strong><ul>{priorities.slice(0, 6).map((item) => <li key={item}>{item}</li>)}</ul></section>}
          {profile && <section><strong>代理边界</strong><p>{profile.runtime.groundingPolicy}</p><p>{profile.runtime.safetyNotes}</p></section>}
        </div>
        <footer className="agent-profile-footer">
          <span>{profile?.disclaimer.shortLabel || "原项目预制人物 Persona"}</span>
          <button type="button" disabled={selected} onClick={onSelect}>{selected ? "已在辩论席" : "加入辩论"}</button>
        </footer>
      </section>
    </div>
  );
}

function SetupPanel({
  personalAgents,
  roundtableAgents: publicAgents,
  selectedIds,
  topic,
  onTopicChange,
  onToggle,
  onCreate,
  onStart,
}: {
  personalAgents: Agent[];
  roundtableAgents: Agent[];
  selectedIds: string[];
  topic: string;
  onTopicChange: (value: string) => void;
  onToggle: (id: string) => void;
  onCreate: () => void;
  onStart: () => void;
}) {
  const topicPresets = [
    "黑客松项目应该优先追求技术深度，还是可演示的完整闭环？",
    "Creator City 下一轮最该优先建设赛事、协作还是个人主页能力？",
    "AI 创作工具应该默认公开过程，还是只交付最终结果？",
    "一个开源创作者社区如何兼顾增长、作品质量与成员隐私？",
  ];
  return (
    <div className="setup-scroll">
      <section className="council-intro"><div><small>CREATOR CITY · COUNCIL ROOM</small><h2>让不同专业视角，替你的创作决策找出盲区</h2><p>选择 2–6 位角色。系统会依次完成立场陈述、交叉质询、观点收敛和结构化纪要。</p></div><ol><li><b>01</b>定义具体命题</li><li><b>02</b>多角色质询</li><li><b>03</b>沉淀行动结论</li></ol></section>
      <section className="setup-section">
        <div className="section-heading"><div><span>我的 Agent</span><small>已选 {selectedIds.length} 位 · 可选 2–6 位</small></div><button onClick={onCreate}><UserRoundPlus size={16} />创建</button></div>
        <div className="agent-selector-grid">
          {personalAgents.map((agent) => <AgentChoice key={agent.id} agent={agent} selected={selectedIds.includes(agent.id)} onClick={() => onToggle(agent.id)} />)}
          <button className="agent-choice create-choice" onClick={onCreate}><span><Plus size={21} /></span><strong>新的我</strong><small>填写问卷</small></button>
        </div>
      </section>
      <section className="setup-section">
        <div className="section-heading"><div><span>创作顾问席</span><small>虚构角色 · 覆盖产品、证据、体验、工程、增长、伦理与演示</small></div></div>
        <div className="agent-selector-grid">
          {publicAgents.map((agent) => <AgentChoice key={agent.id} agent={agent} selected={selectedIds.includes(agent.id)} onClick={() => onToggle(agent.id)} />)}
        </div>
      </section>
      <section className="setup-section topic-compose">
        <div className="section-heading"><div><span>讨论议题</span><small>越具体，结论越可行动</small></div></div>
        <div className="topic-presets">{topicPresets.map((preset) => <button type="button" className={topic === preset ? "active" : ""} onClick={() => onTopicChange(preset)} key={preset}>{preset}</button>)}</div>
        <textarea value={topic} onChange={(event) => onTopicChange(event.target.value)} placeholder="输入一个需要做出取舍的创作问题，例如：首个版本应该先证明用户价值，还是先展示技术上限？" />
        <div className="start-row"><span>本次议事成员 · {selectedIds.length} 位</span><button className="primary-button" disabled={selectedIds.length < 2 || selectedIds.length > 6 || !topic.trim()} onClick={onStart}><Sparkles size={17} />开始议事</button></div>
      </section>
    </div>
  );
}

function AgentChoice({ agent, selected, onClick }: { agent: Agent; selected: boolean; onClick: () => void }) {
  return (
    <button className={`agent-choice ${selected ? "is-selected" : ""}`} onClick={onClick} aria-pressed={selected}>
      <AgentAvatar agent={agent} size={48} />
      <strong>{agent.name}</strong>
      <small>{agent.role}</small>
      <i>{selected && <Check size={12} />}</i>
    </button>
  );
}

function MessageBubble({ message, agents }: { message: ChatMessage; agents: Agent[] }) {
  if (message.role === "system") return <div className="system-message">{message.text}</div>;
  if (message.role === "user") {
    return (
      <article className="message-row is-user">
        <div className="message-content"><div className="message-name">你 · 回复 {message.targetName}</div><div className="bubble user-bubble">{message.text}</div></div>
        <div className="user-avatar">你</div>
      </article>
    );
  }
  const agent = agents.find((item) => item.id === message.speakerId) ?? {
    id: message.speakerId,
    name: message.speakerName,
    role: "Agent",
    kind: "personal" as const,
    coreBelief: "",
    speechStyle: "",
    debateStyle: "",
    accent: "#777",
  };
  return (
    <article className="message-row">
      <AgentAvatar agent={agent} size={44} />
      <div className="message-content">
        <div className="message-name">{message.speakerName} · {agent.role}</div>
        <div className="bubble agent-bubble">
          <p>{displayMessageText(message.text)}</p>
          {message.targetName && <footer>
            {message.targetName && <span>回复 {message.targetName}</span>}
          </footer>}
        </div>
      </div>
    </article>
  );
}

function TypingRow({ agent }: { agent?: Agent }) {
  if (!agent) return null;
  return <article className="message-row"><AgentAvatar agent={agent} speaking size={44} /><div className="message-content"><div className="message-name">{agent.name}</div><div className="bubble agent-bubble typing"><i /><i /><i /></div></div></article>;
}

function VerdictLoadingRow() {
  return (
    <div className="verdict-loading" role="status">
      <LoaderCircle size={15} />
      <span>正在整理讨论结论…</span>
    </div>
  );
}

function DiscussionVerdictCard({ verdict }: { verdict: DiscussionVerdict }) {
  return (
    <section className="verdict-card" aria-label="讨论结论">
      <header>
        <div><Check size={16} /><strong>讨论结论</strong></div>
        <span><Award size={13} />{verdict.winnerAgentName} 的观点最有说服力</span>
      </header>
      <p className="verdict-conclusion">{verdict.conclusion}</p>
      <div className="verdict-columns">
        <div>
          <strong>共同判断</strong>
          <ul>{verdict.consensus.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div>
          <strong>仍有分歧</strong>
          <ul>{verdict.disagreements.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      </div>
      <p className="winner-reason">{verdict.winnerReason}</p>
      <details className="judge-details">
        <summary>查看裁判评分</summary>
        <div className="judge-score-list">
          {verdict.scores.map((score, index) => (
            <div className="judge-score" key={score.agentId}>
              <span>{index + 1}</span>
              <div><strong>{score.agentName}</strong><small>{score.comment}</small></div>
              <div className="score-meter"><i style={{ width: `${Math.round(score.overallScore * 100)}%` }} /></div>
              <em>{Math.round(score.overallScore * 100)}</em>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}

function MemberPanel({ agents, model, topic, serviceStatus }: { agents: Agent[]; model: string; topic: string; serviceStatus: { configured: boolean; model: string } | null }) {
  return (
    <aside className="member-panel">
      <div className="member-panel-heading"><strong>议事信息</strong><Info size={17} /></div>
      <div className="member-topic"><span>讨论议题</span><p>{topic || "尚未填写"}</p></div>
      <div className="member-panel-label">议事成员 · {agents.length}</div>
      <MemberList agents={agents} />
      <div className="core-status"><Bot size={16} /><div><strong>对话服务</strong><span>{model ? `${model} · 已连接` : serviceStatus?.configured ? `${serviceStatus.model} · 就绪` : serviceStatus ? "未配置模型密钥" : "状态检查中"}</span></div><i className={model || serviceStatus?.configured ? "online" : serviceStatus ? "warning" : ""} /></div>
    </aside>
  );
}

function MemberList({ agents }: { agents: Agent[] }) {
  return <div className="member-list">{agents.map((agent) => <div key={agent.id} className="member-row"><AgentAvatar agent={agent} size={38} /><div><strong>{agent.name}</strong><span>{agent.role}</span></div><em>{agent.kind === "personal" ? "个人" : "内置"}</em></div>)}</div>;
}

function loadProfiles(): PersonalAgentProfile[] {
  try {
    const value = profileStorage().getItem(STORAGE_KEY);
    return value ? JSON.parse(value) as PersonalAgentProfile[] : [];
  } catch {
    return [];
  }
}

function profileStorage(): Storage {
  return isGuestMode() ? window.sessionStorage : window.localStorage;
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "议事内容生成失败，请重试。";
}

function displayMessageText(text: string): string {
  return text
    .replace(/\[[\w.-]+\]/gu, "")
    .replace(/〔\s*\d+\s*〕/gu, "")
    .replace(/(?:来源|结论|引用)\s*\d+\s*[、，,:：;；]?/gu, "")
    .replace(/\s+([，。！？；：])/gu, "$1")
    .trim();
}

interface FailedUserReply {
  topic: string;
  phase: RoundtablePhase;
  agents: Agent[];
  runtime: Record<string, AgentRuntimeState>;
  messages: ChatMessage[];
  userMessage: ChatMessage;
  target: Agent;
}
