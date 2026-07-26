"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Player } from "@remotion/player";
import { ArrowUpRight, Award, Building2, CalendarDays, Clapperboard, Code2, FileText, GitFork, Map, PencilLine, Sparkles } from "lucide-react";
import { CreatorIntro, type CreatorIntroProps } from "@/remotion/CreatorIntro";
import { buildCreatorStoryboard, getStoryboardDuration } from "@/remotion/storyboard";
import { loadCloudProfile, loadProfile, saveProfile, type UserProfile } from "@/features/profile";
import { resolveProfileMedia } from "@/features/mediaLibrary";
import { repairProfileMediaBindings } from "@/features/profileMediaBindings";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let revoke: (() => void) | undefined;
    let active = true;
    void loadCloudProfile().then((currentProfile) => {
      const storedProfile = currentProfile || loadProfile();
      if (!storedProfile) {
        router.replace("/onboarding");
        return null;
      }
      const repairedProfile = repairProfileMediaBindings(storedProfile);
      saveProfile(repairedProfile);
      return resolveProfileMedia(repairedProfile);
    }).then((resolved) => {
      if (!resolved) return;
      if (!active) { resolved.revoke(); return; }
      revoke = resolved.revoke;
      setProfile(resolved.profile);
    });
    return () => { active = false; revoke?.(); };
  }, [router]);

  const storyboard = useMemo(() => profile ? buildCreatorStoryboard(profile) : null, [profile]);

  if (!profile || !storyboard) return <main className="studio-page grid min-h-screen place-items-center font-semibold text-[#697386]">正在打开个人主页…</main>;
  const videoProps: CreatorIntroProps = { storyboard };
  const duration = getStoryboardDuration(storyboard);

  return (
    <main className="studio-page profile-site min-h-screen">
      <header className="profile-nav">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <Link href="/profile" className="flex min-w-0 items-center gap-3"><span className="profile-monogram">{profile.name.slice(0, 1)}</span><span className="min-w-0"><strong className="block truncate">{profile.name}</strong><small className="block truncate">{profile.title}</small></span></Link>
          <nav className="flex items-center gap-2"><Link className="studio-button secondary hidden sm:inline-flex" href="/onboarding"><PencilLine size={16} />编辑档案</Link><Link className="studio-button secondary hidden md:inline-flex" href="/video"><Clapperboard size={16} />导演台</Link><Link className="studio-button primary" href="/city/neon"><Map size={16} />Creator City</Link></nav>
        </div>
      </header>

      <section className="profile-hero">
        <div className="mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-8 sm:pt-20">
          <div className="max-w-5xl"><p className="profile-kicker">CREATOR PROFILE · BEIJING</p><h1>{profile.name}</h1><p className="profile-role">{profile.title}</p><p className="profile-statement">{profile.bio}</p><p className="profile-narrative">{profile.narrative}</p></div>
          <div className="mt-8 flex flex-wrap items-center gap-3">{profile.githubUsername && <a className="studio-button light" href={`https://github.com/${profile.githubUsername}`} target="_blank" rel="noreferrer"><GitFork size={17} />GitHub / {profile.githubUsername}</a>}<Link className="studio-button glass" href="/video"><Clapperboard size={17} />观看影片</Link></div>
          <div className="profile-skill-line mt-10">{profile.skills.slice(0, 7).map((skill) => <span key={skill.name}>{skill.name}<small>{skill.level}</small></span>)}</div>
        </div>
      </section>

      <section className="profile-reel-band" aria-labelledby="film-heading">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8 sm:py-16">
          <div className="profile-section-heading"><div><p className="studio-kicker">FEATURE REEL</p><h2 id="film-heading">一段会演示作品的自我介绍</h2></div><p>{storyboard.scenes.length} 个镜头 · {(duration / storyboard.fps).toFixed(0)} 秒</p></div>
          <div className="studio-player-shell mt-6"><Player component={CreatorIntro} inputProps={videoProps} durationInFrames={duration} fps={storyboard.fps} compositionWidth={1280} compositionHeight={720} controls loop style={{ width: "100%", aspectRatio: "16 / 9" }} /></div>
        </div>
      </section>

      {profile.metrics.length > 0 && <section className="profile-metrics-band"><div className="mx-auto grid max-w-7xl gap-px px-4 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">{profile.metrics.map((metric) => <div key={metric.id}><strong>{metric.value}</strong><span>{metric.label}</span><small>{metric.context}</small></div>)}</div></section>}

      <section className="profile-content-band" aria-labelledby="projects-heading">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-8 sm:py-20">
          <div className="profile-section-heading"><div><p className="studio-kicker">SELECTED WORK</p><h2 id="projects-heading">作品、实机与构建过程</h2></div><p>每个项目都保留角色、结果与实现路径。</p></div>
          <div className="profile-projects mt-8">{profile.projects.map((project, index) => <article key={project.id} className={index === 0 ? "featured" : ""}>
            <div className="project-copy"><div className="flex items-center justify-between gap-4"><p className="studio-kicker">{project.ownership === "reference" ? "REFERENCE" : "PROJECT"} {String(index + 1).padStart(2, "0")}</p>{project.url && <a className="studio-icon-button" href={project.url} target="_blank" rel="noreferrer" title={`打开 ${project.name}`}><ArrowUpRight size={17} /></a>}</div>{project.ownership === "reference" && <span className="studio-pill mt-3">外部参考 · {project.sourceOwner || "原作者"}（非本人项目）</span>}<h3>{project.name || "未命名项目"}</h3><p>{project.desc}</p>{project.impact && <blockquote>{project.impact}</blockquote>}<div className="mt-5 flex flex-wrap gap-2">{project.tech.map((tech) => <span className="studio-pill" key={tech}>{tech}</span>)}</div></div>
            <div className="project-visual">{project.mediaType === "video" && project.mediaUrl ? <video src={project.mediaUrl} muted loop autoPlay playsInline controls /> : project.mediaType === "image" && project.mediaUrl ? <img src={project.mediaUrl} alt={`${project.name} 项目画面`} /> : <div className="project-flow"><span><Code2 size={19} />{project.role || "核心贡献"}</span>{(project.architecture.length ? project.architecture : project.workflow).slice(0, 5).map((node, nodeIndex) => <div key={`${node}-${nodeIndex}`}><b>{String(nodeIndex + 1).padStart(2, "0")}</b>{node}</div>)}</div>}</div>
          </article>)}</div>
        </div>
      </section>

      {(profile.experiences.length > 0 || profile.education.length > 0) && <section className="profile-trajectory-band"><div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.15fr_.85fr]">
        <div><p className="studio-kicker">TRAJECTORY</p><h2 className="mt-2 text-3xl font-bold">经历不是清单，是能力形成的过程</h2><div className="profile-timeline mt-8">{profile.experiences.map((item) => <article key={item.id}><time>{item.period}</time><h3>{item.role}</h3><p className="organization"><Building2 size={15} />{item.organization}</p><p>{item.summary}</p></article>)}</div></div>
        <div><p className="studio-kicker">EDUCATION & AWARDS</p><div className="profile-evidence-list mt-8">{profile.education.map((item) => <article key={item.id}><span><CalendarDays size={18} /></span><div><small>{item.period}</small><h3>{item.school}</h3><p>{item.degree} · {item.field}</p>{item.result && <strong>{item.result}</strong>}</div></article>)}{profile.awards.map((award) => <article key={award.id}><span><Award size={18} /></span><div><small>{award.date} · {award.issuer}</small><h3>{award.title}</h3>{award.detail && <p>{award.detail}</p>}</div></article>)}</div></div>
      </div></section>}

      {profile.papers.length > 0 && <section className="profile-content-band"><div className="mx-auto max-w-7xl px-4 py-14 sm:px-8 sm:py-20"><div className="profile-section-heading"><div><p className="studio-kicker">RESEARCH NOTES</p><h2>论文与研究贡献</h2></div><FileText size={24} /></div><div className="profile-papers mt-8">{profile.papers.map((paper, index) => <a key={`${paper.title}-${index}`} href={paper.url || undefined} target={paper.url ? "_blank" : undefined} rel="noreferrer"><span>{paper.venue || "RESEARCH"}</span><h3>{paper.title}</h3><p>{paper.contribution}</p><ArrowUpRight size={17} /></a>)}</div></div></section>}

      <section className="profile-contact-band"><div className="mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-24"><Sparkles size={26} /><p className="profile-kicker mt-5">OPEN TO COLLABORATE</p><h2>下一件作品，可以从一次具体交流开始。</h2><p>{profile.lookingFor || "欢迎从一个具体项目开始交流。"}</p>{profile.githubUsername && <a className="studio-button light mt-8" href={`https://github.com/${profile.githubUsername}`} target="_blank" rel="noreferrer"><GitFork size={17} />访问 GitHub</a>}</div></section>
    </main>
  );
}
