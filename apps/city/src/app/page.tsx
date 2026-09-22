"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Film, LockKeyhole, Map, Sparkles, UserRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GateEntrance } from "@/components/GateEntrance";
import { LightRays } from "@/components/motion/LightRays";
import { SplitRevealText } from "@/components/motion/SplitRevealText";
import { createGuestSession, hydrateSession, registerSession, signInSession } from "@/features/session";

const chapters = [
  { icon: Sparkles, label: "导入创作档案", meta: "GitHub / 简历 / 论文" },
  { icon: Film, label: "生成个人影片", meta: "Motion + 实机素材" },
  { icon: Map, label: "进入城市漫游", meta: "北京创作者院落" },
];

export default function HomePage() {
  const router = useRouter();
  const [ready, setReady] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [entering, setEntering] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    router.prefetch("/city/neon");
    let active = true;
    void hydrateSession()
      .then((session) => {
        if (!active) return;
        setReady(true);
        if (session) router.replace("/city/neon");
      })
      .catch(() => {
        if (!active) return;
        setReady(true);
        setError("登录状态读取失败，仍可使用游客模式进入。");
      });
    return () => { active = false; };
  }, [router]);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !username.includes("@")) {
      setError("请输入有效邮箱");
      return;
    }
    setError("");
    try {
      await signInSession(username.trim(), password);
      sessionStorage.setItem("creator-city-arrival", "gate");
      setEntering(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败，请稍后重试");
    }
  };

  const register = async () => {
    if (!username.trim() || !username.includes("@")) {
      setError("请输入有效邮箱");
      return;
    }
    setError("");
    try {
      await registerSession(username.trim(), password);
      sessionStorage.setItem("creator-city-arrival", "gate");
      setEntering(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "注册失败，请稍后重试");
    }
  };

  const enterAsGuest = async () => {
    setError("");
    try {
      await createGuestSession();
      sessionStorage.setItem("creator-city-arrival", "gate");
      setEntering(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "游客模式启动失败，请稍后重试");
    }
  };

  const finishEntrance = useCallback(() => router.push("/city/neon"), [router]);

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#08100e] text-[#f0d28d]">
        <div className="text-center">
          <p className="font-mono text-xs tracking-[0.28em]">CREATOR CITY</p>
          <p className="mt-3 text-sm text-white/65">正在读取创作者身份…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="login-cinematic">
      <motion.div
        className={`login-cinematic-scene ${entering ? "pointer-events-none" : ""}`}
        animate={entering ? { opacity: 0, scale: reduced ? 1 : 1.06, filter: reduced ? "blur(0px)" : "blur(14px)" } : { opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: reduced ? 0.08 : 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="login-courtyard" aria-hidden="true" />
        <div className="login-depth" aria-hidden="true" />
        <LightRays className="login-light-rays" tone="gold" />
        <div className="login-film-line" aria-hidden="true" />

        <header className="login-nav">
          <a className="login-brand" href="#top" aria-label="Creator City 首页">
            <span>创</span>
            <span><strong>CREATOR CITY</strong><small>北京 AI 创作者之城</small></span>
          </a>
          <div className="login-nav-signal"><i />LIVE PROTOTYPE · 2026</div>
        </header>

        <section className="login-stage" id="top">
          <div className="login-story">
            <p className="login-eyebrow" data-reveal>REMOTION PROFILE × CREATOR COMMUNITY</p>
            <h1><SplitRevealText text="让作品开口，" /><br /><SplitRevealText className="login-title-accent" text="让同路人出现。" /></h1>
            <p className="login-lead" data-reveal data-reveal-delay="0.22">
              你的 GitHub、简历、论文与实机录像，会被编排成一支有节奏的个人影片。影片结束，镜头继续向前，走入一座会发生相遇的北京院落。
            </p>
            <div className="login-chapters" data-reveal data-reveal-delay="0.32">
              {chapters.map(({ icon: Icon, label, meta }, index) => (
                <div key={label}>
                  <span><Icon size={17} /></span>
                  <p><small>0{index + 1}</small><strong>{label}</strong><em>{meta}</em></p>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={signIn} className="login-console" data-reveal data-reveal-distance="70" data-reveal-delay="0.16">
            <div className="login-console-top"><span>CITY GATE / 身份验证</span><i /><i /><i /></div>
            <div className="login-console-body">
              <span className="login-seal"><LockKeyhole size={22} /></span>
              <p className="login-console-kicker">京城创作者会馆</p>
              <h2>持创作者身份入城</h2>
              <p className="login-console-copy">使用邮箱和密码登录 Supabase。注册后个人资料和 Agent 信息会保存到云端。</p>
              <label htmlFor="username">邮箱 / EMAIL</label>
              <input id="username" type="email" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="email" />
              <label htmlFor="password">密码 / PASSWORD</label>
              <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
              {error && <p className="login-error">{error}</p>}
              <div className="login-actions">
              <button type="submit" disabled={entering}>
                <span>{entering ? "正在登录" : "登录已有账号"}</span><ArrowRight size={18} />
              </button>
                <button className="secondary" type="button" disabled={entering} onClick={register}>
                  <span>注册新账号</span><Sparkles size={18} />
                </button>
                <button className="guest" type="button" disabled={entering} onClick={enterAsGuest}>
                  <span>游客试玩</span><UserRound size={18} />
                </button>
              </div>
              <div className="login-console-foot"><span /><small>游客数据将在关闭网页后清除</small><span /></div>
            </div>
          </form>
        </section>

        <div className="login-scroll-cue" aria-hidden="true"><span>一份档案，一支影片，一座城</span><i /></div>
      </motion.div>
      <AnimatePresence>{entering && <GateEntrance active onComplete={finishEntrance} />}</AnimatePresence>
    </main>
  );
}
