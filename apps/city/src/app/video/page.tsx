"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { ArrowDown, ArrowUp, CheckCircle2, Clapperboard, Download, FilePenLine, Layers3, LoaderCircle, Map, RotateCcw, Sparkles, Square } from "lucide-react";
import { CreatorIntro, CreatorIntroSchema, type CreatorIntroProps } from "@/remotion/CreatorIntro";
import { buildCreatorStoryboard, getStoryboardDuration, type CreatorStoryboard } from "@/remotion/storyboard";
import { loadCloudProfile, loadProfile, saveProfile, type UserProfile } from "@/features/profile";
import { resolveProfileMedia } from "@/features/mediaLibrary";
import { repairProfileMediaBindings } from "@/features/profileMediaBindings";
import { LightRays } from "@/components/motion/LightRays";
import { loadSession } from "@/features/session";

const sceneNames: Record<CreatorStoryboard["scenes"][number]["type"], string> = {
  identity: "身份开场",
  timeline: "经历轨迹",
  evidence: "成绩与奖项",
  project: "项目演示",
  research: "论文研究",
  skills: "技能证据",
  closing: "交流邀请",
};

const themeNames: Record<CreatorStoryboard["visualTheme"], string> = {
  "beijing-night": "京城夜幕",
  "paper-archive": "纸上档案",
  "signal-lab": "信号实验室",
  "gallery-white": "先锋展厅",
};

type RenderPhase = "idle" | "checking" | "rendering" | "encoding" | "done" | "error";

const renderPhaseLabels: Record<Exclude<RenderPhase, "error">, string> = {
  idle: "等待导出",
  checking: "检查浏览器编码能力",
  rendering: "逐帧渲染画面",
  encoding: "编码 MP4",
  done: "成片已下载",
};

export default function VideoPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [storyboard, setStoryboard] = useState<CreatorStoryboard | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [renderPhase, setRenderPhase] = useState<RenderPhase>("idle");
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderDetail, setRenderDetail] = useState("实时预览无需编码，所以会立即出现；导出时才会逐帧生成文件。");
  const [mediaIssue, setMediaIssue] = useState("");
  const abortRenderRef = useRef<AbortController | null>(null);
  const playerRef = useRef<PlayerRef>(null);

  useEffect(() => {
    let revoke: (() => void) | undefined;
    let active = true;
    if (!loadSession()) {
      router.replace("/");
      return;
    }
    void loadCloudProfile().then((cloudProfile) => {
      const storedProfile = cloudProfile || loadProfile();
      if (!storedProfile) {
        router.replace("/onboarding");
        return null;
      }
      const baseProfile = repairProfileMediaBindings(storedProfile);
      saveProfile(baseProfile);
      return resolveProfileMedia(baseProfile);
    }).then((resolved) => {
      if (!resolved) return;
      if (!active) { resolved.revoke(); return; }
      revoke = resolved.revoke;
      const nextStoryboard = buildCreatorStoryboard(resolved.profile);
      const videos = resolved.profile.mediaAssets.filter((asset) => asset.kind === "project-video");
      const missing = videos.filter((asset) => asset.runtimeStatus !== "ready" || !asset.runtimeUrl);
      const unbound = videos.filter((asset) => !asset.projectId || !resolved.profile.projects.some((project) => project.id === asset.projectId));
      const usedVideoIds = new Set(nextStoryboard.scenes.flatMap((scene) => scene.type === "project"
        ? scene.mediaClips.filter((clip) => clip.mediaType === "video").map((clip) => clip.assetId)
        : []));
      const unused = videos.filter((asset) => asset.runtimeStatus === "ready" && !usedVideoIds.has(asset.id));
      setMediaIssue(missing.length
        ? `${missing.map((asset) => asset.name).join("、")} 的原文件未能从浏览器媒体库载入。`
        : unbound.length
          ? `${unbound.map((asset) => asset.name).join("、")} 尚未绑定到项目，请返回资料页选择对应项目。`
          : unused.length
            ? `${unused.map((asset) => asset.name).join("、")} 尚未进入当前分镜，请检查项目绑定。`
            : "");
      setProfile(resolved.profile);
      setStoryboard(nextStoryboard);
      setSelectedId(nextStoryboard.scenes[0]?.id || "");
    });
    return () => { active = false; revoke?.(); };
  }, [router]);

  useEffect(() => () => abortRenderRef.current?.abort(), []);

  const duration = storyboard ? getStoryboardDuration(storyboard) : 0;
  const props = useMemo<CreatorIntroProps | null>(() => storyboard ? { storyboard } : null, [storyboard]);
  const selected = storyboard?.scenes.find((scene) => scene.id === selectedId);
  const projectMediaCount = profile?.mediaAssets.filter((asset) => asset.kind !== "resume" && asset.runtimeUrl).length || 0;
  const uploadedVideos = profile?.mediaAssets.filter((asset) => asset.kind === "project-video") || [];

  const selectScene = (id: string) => {
    if (!storyboard) return;
    const index = storyboard.scenes.findIndex((scene) => scene.id === id);
    if (index < 0) return;
    const startFrame = storyboard.scenes.slice(0, index).reduce((total, scene) => total + scene.durationInFrames, 0);
    setSelectedId(id);
    playerRef.current?.seekTo(startFrame);
    playerRef.current?.play();
  };

  const moveScene = (id: string, direction: -1 | 1) => {
    if (!storyboard) return;
    const index = storyboard.scenes.findIndex((scene) => scene.id === id);
    const target = index + direction;
    if (index <= 0 || target <= 0 || target >= storyboard.scenes.length - 1) return;
    const scenes = [...storyboard.scenes];
    [scenes[index], scenes[target]] = [scenes[target], scenes[index]];
    setStoryboard({ ...storyboard, scenes });
  };

  const resetStoryboard = () => {
    if (!profile) return;
    const next = buildCreatorStoryboard(profile);
    setStoryboard(next);
    setSelectedId(next.scenes[0]?.id || "");
    playerRef.current?.seekTo(0);
  };

  const renderMp4 = async () => {
    if (!props || !storyboard || !duration || renderPhase === "checking" || renderPhase === "rendering" || renderPhase === "encoding") return;
    if (mediaIssue) {
      setRenderPhase("error");
      setRenderDetail(`已阻止生成无实机素材的成片：${mediaIssue}`);
      return;
    }
    setRenderPhase("checking");
    setRenderProgress(0);
    setRenderDetail("正在确认 Edge 的 WebCodecs、H.264 与 MP4 写入能力…");
    const controller = new AbortController();
    abortRenderRef.current = controller;
    try {
      const { canRenderMediaOnWeb, renderMediaOnWeb } = await import("@remotion/web-renderer");
      const capability = await canRenderMediaOnWeb({
        container: "mp4",
        videoCodec: "h264",
        audioCodec: null,
        muted: true,
        width: 1280,
        height: 720,
      });
      if (!capability.canRender) {
        throw new Error(capability.issues.filter((issue) => issue.severity === "error").map((issue) => issue.message).join("；") || "当前浏览器无法编码 MP4");
      }
      setRenderPhase("rendering");
      setRenderDetail(`从第 1 帧开始生成，共 ${duration} 帧。请保持此页面处于打开状态。`);
      const result = await renderMediaOnWeb({
        composition: {
          id: "CreatorIntro",
          component: CreatorIntro,
          durationInFrames: duration,
          fps: storyboard.fps,
          width: 1280,
          height: 720,
          defaultProps: props,
        },
        inputProps: props,
        schema: CreatorIntroSchema,
        container: "mp4",
        videoCodec: capability.resolvedVideoCodec || "h264",
        audioCodec: null,
        muted: true,
        videoBitrate: "high",
        outputTarget: "arraybuffer",
        signal: controller.signal,
        onProgress: (progress) => {
          const nextProgress = Math.max(0, Math.min(100, Math.round(progress.progress * 100)));
          setRenderProgress(nextProgress);
          const isEncoding = progress.encodedFrames > 0;
          setRenderPhase(isEncoding ? "encoding" : "rendering");
          setRenderDetail(`${isEncoding ? "正在写入 MP4" : "正在渲染画面"} · 已渲染 ${progress.renderedFrames}/${duration} 帧 · 已编码 ${progress.encodedFrames}/${duration} 帧`);
        },
      });
      const blob = await result.getBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${(profile?.name || "creator").replace(/[\\/:*?"<>|]+/g, "-")}-creator-film.mp4`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setRenderProgress(100);
      setRenderPhase("done");
      setRenderDetail(`已根据当前档案、${projectMediaCount} 份本地素材和“${themeNames[storyboard.visualTheme]}”主题完成编码。`);
    } catch (error) {
      if (controller.signal.aborted) {
        setRenderPhase("idle");
        setRenderProgress(0);
        setRenderDetail("已取消本次导出，实时预览仍可继续使用。");
      } else {
        setRenderPhase("error");
        setRenderDetail(error instanceof Error ? error.message : "MP4 渲染失败，请重试");
      }
    } finally {
      abortRenderRef.current = null;
    }
  };

  const cancelRender = () => abortRenderRef.current?.abort();

  const rendering = renderPhase === "checking" || renderPhase === "rendering" || renderPhase === "encoding";
  const renderHeading = renderPhase === "error"
    ? "导出遇到问题"
    : renderPhase === "idle"
      ? "预览不是成片，导出才会编码"
      : renderPhaseLabels[renderPhase];

  return (
    <main className="studio-page director-page min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <LightRays className="director-light-rays" tone="gold" />
      <div className="director-perf" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></div>
      <div className="relative z-[2] mx-auto max-w-[1540px]">
        <header className="studio-header flex flex-wrap items-center justify-between gap-5 pb-5" data-reveal>
          <div className="flex items-start gap-3"><span className="studio-brand-mark"><Clapperboard size={22} /></span><div className="studio-title-lockup"><p className="studio-kicker">REMOTION DIRECTOR</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">个人影片导演台</h1><p className="mt-2 text-sm text-[#aeb7b3]">{storyboard ? `实时 Remotion 预览 · ${storyboard.scenes.length} 个镜头 · ${(duration / storyboard.fps).toFixed(0)} 秒 · ${projectMediaCount} 份用户素材` : "正在根据当前用户资料构建故事板…"}</p><span aria-hidden="true">导演</span></div></div>
          <div className="flex flex-wrap gap-2"><Link className="studio-button secondary" href="/city/neon"><Map size={16} />返回广场</Link><button className="studio-button secondary" type="button" onClick={resetStoryboard}><RotateCcw size={16} />重置编排</button><Link className="studio-button secondary" href="/onboarding"><FilePenLine size={16} />编辑资料</Link><Link className="studio-button primary" href="/profile"><CheckCircle2 size={16} />发布到主页</Link></div>
        </header>

        <section className="director-workspace mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_390px]" data-reveal data-reveal-delay="0.08">
          <div className="min-w-0 xl:sticky xl:top-6">
            <div className="studio-player-shell">
              {props && storyboard ? <Player ref={playerRef} component={CreatorIntro} inputProps={props} durationInFrames={duration} fps={storyboard.fps} compositionWidth={1280} compositionHeight={720} controls autoPlay loop style={{ width: "100%", aspectRatio: "16 / 9" }} /> : <div className="grid aspect-video place-items-center bg-[#111827] text-sm font-semibold text-white">正在读取当前用户的故事板…</div>}
            </div>

            <section className="mt-3 rounded-xl border border-white/10 bg-[#0b1210]/90 px-4 py-3 text-white" aria-live="polite">
              <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">真实视频素材检查</strong><span className="text-xs text-[#9ee6d2]">{uploadedVideos.filter((asset) => asset.runtimeStatus === "ready" && asset.runtimeUrl).length} / {uploadedVideos.length} 已载入</span></div>
              {mediaIssue && <p className="mt-2 rounded-lg border border-[#ff7468]/35 bg-[#ff7468]/10 px-3 py-2 text-xs leading-5 text-[#ffb8ae]">{mediaIssue} 系统不会再静默退回纯 Motion 成片。</p>}
              {uploadedVideos.length ? <div className="mt-2 grid gap-1.5">{uploadedVideos.map((asset) => <div className="flex flex-wrap items-center justify-between gap-2 text-xs" key={asset.id}><span className="min-w-0 truncate text-white/75">{asset.name}{asset.durationInSeconds ? ` · ${asset.durationInSeconds.toFixed(1)}s` : ""}</span><span className={asset.runtimeStatus === "ready" ? "text-[#78d7c2]" : "text-[#ff8b7f]"}>{asset.runtimeStatus === "ready" ? "可用于 Remotion 节选" : asset.runtimeError || "原文件未载入"}</span></div>)}</div> : <p className="mt-2 text-xs text-[#ffb8ae]">当前档案没有视频文件；请返回资料页上传并绑定到对应项目。</p>}
            </section>

            <section className={`director-render-console mt-5 phase-${renderPhase}`} aria-live="polite">
              <div className="render-console-copy"><span className="render-live-badge"><i /> LIVE PREVIEW</span><div><h2>{renderHeading}</h2><p>{renderDetail}</p></div></div>
              <div className="render-stage-strip">{["准备素材", "渲染帧", "编码 MP4", "完成"].map((label, index) => { const activeIndex = renderPhase === "checking" ? 0 : renderPhase === "rendering" ? 1 : renderPhase === "encoding" ? 2 : renderPhase === "done" ? 3 : -1; return <span className={index < activeIndex ? "done" : index === activeIndex ? "active" : ""} key={label}><i>{index < activeIndex || renderPhase === "done" ? "✓" : index + 1}</i>{label}</span>; })}</div>
              <div className="render-progress"><span style={{ width: `${renderProgress}%` }} /><b>{renderProgress}%</b></div>
              <div className="render-console-actions">{rendering ? <button className="studio-button render-cancel" type="button" onClick={cancelRender}><Square size={14} />取消渲染</button> : <button className="studio-button render-export" type="button" onClick={() => void renderMp4()} disabled={!storyboard || Boolean(mediaIssue)}><Download size={16} />{renderPhase === "done" ? "重新渲染 MP4" : "现场渲染 MP4"}</button>}<small>{rendering ? <><LoaderCircle className="render-spinner" size={14} />浏览器正在真实计算</> : mediaIssue ? "请先修复视频绑定" : "1280 × 720 · H.264 · 当前用户数据"}</small></div>
            </section>

            <div className="studio-timeline mt-5" aria-label="影片时间线">
              <div className="timeline-ruler"><span>00:00</span><span>SCENE TIMELINE</span><span>{storyboard ? `00:${String(Math.round(duration / storyboard.fps)).padStart(2, "0")}` : "00:00"}</span></div>
              <div className="timeline-track">{storyboard?.scenes.map((scene, index) => <button key={scene.id} type="button" className={`${selectedId === scene.id ? "active" : ""} scene-${scene.type}`} style={{ flex: scene.durationInFrames }} onClick={() => selectScene(scene.id)} title={`${sceneNames[scene.type]} · ${scene.title}`}><span>{String(index + 1).padStart(2, "0")}</span><strong>{sceneNames[scene.type]}</strong></button>)}</div>
            </div>

            {selected && <section className="studio-selection mt-5">
              <div><p className="studio-kicker">SELECTED SCENE</p><h2 className="mt-1 text-lg font-bold">{sceneNames[selected.type]} · {selected.title}</h2><p className="mt-2 text-sm leading-6 text-[#697386]">{selected.subtitle}</p></div>
              <div className="flex flex-wrap items-center gap-2"><span className="studio-pill"><Layers3 size={14} />{selected.sourceLabel}</span>{storyboard && <span className="studio-pill"><Sparkles size={14} />{themeNames[storyboard.visualTheme]}</span>}{selected.type === "project" && <span className="studio-pill accent"><Sparkles size={14} />{{ live: "上传视频 + 动态解说", browser: "产品界面演示", architecture: "系统原理动画", workflow: "流程动画" }[selected.presentation]}</span>}</div>
            </section>}
          </div>

          <aside className="studio-card min-w-0 overflow-hidden">
            <div className="studio-aside-heading"><div><p className="studio-kicker">SHOT LIST</p><h2 className="mt-1 text-lg font-bold">镜头清单</h2></div><span>{storyboard?.scenes.length || 0}</span></div>
            <ol className="studio-shot-list max-h-[720px] overflow-y-auto">
              {storyboard?.scenes.map((scene, index) => <li key={scene.id} className={selectedId === scene.id ? "active" : ""}>
                <button className="shot-main" type="button" onClick={() => selectScene(scene.id)}><span className="shot-index">{String(index + 1).padStart(2, "0")}</span><span className="min-w-0 flex-1"><strong>{sceneNames[scene.type]}</strong><small>{scene.title}</small></span><time>{(scene.durationInFrames / storyboard.fps).toFixed(0)}s</time></button>
                {index > 0 && index < storyboard.scenes.length - 1 && <div className="shot-actions"><button type="button" title="场景上移" onClick={() => moveScene(scene.id, -1)}><ArrowUp size={15} /></button><button type="button" title="场景下移" onClick={() => moveScene(scene.id, 1)}><ArrowDown size={15} /></button></div>}
              </li>)}
            </ol>
          </aside>
        </section>
      </div>
    </main>
  );
}
