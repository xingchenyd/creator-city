"use client";

import dynamic from "next/dynamic";
import { ArrowRight, Building2, Check, FileText, LogOut, MessageCircleMore, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CityFacilityWorkbench } from "@/city/CityFacilityWorkbench";
import { CITY_NPCS } from "@/city/config/npcs";
import { SCENE_OBJECTS } from "@/city/config/sceneObjects";
import { loadCloudProfile, loadProfile } from "@/features/profile";
import { clearSession, isGuestSession, loadSession } from "@/features/session";
import type { CityInteractable, SceneObjectDef, SceneObjectId } from "@/features/types";

const CityGame = dynamic(() => import("@/city/CityGame").then((module) => module.CityGame), { ssr: false });
const CHAT_DEBATE_URL = process.env.NEXT_PUBLIC_CHAT_DEBATE_URL || "/chat-debate/";

function chatDebateUrl(params: Record<string, string> = {}) {
  const origin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
  const url = new URL(CHAT_DEBATE_URL, origin);
  const session = loadSession();
  if (isGuestSession(session)) url.searchParams.set("guest", "1");
  else if (session?.email) url.searchParams.set("creator", session.email);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

export function CityPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<CityInteractable | null>(null);
  const [activeFacility, setActiveFacility] = useState<SceneObjectDef | null>(null);
  const [name, setName] = useState("Creator");
  const [debateHref, setDebateHref] = useState(CHAT_DEBATE_URL);
  const [debateAgentIds, setDebateAgentIds] = useState<string[]>([]);
  const interactionLocked = useRef(false);

  useEffect(() => {
    if (!loadSession()) { router.replace("/"); return; }
    setName(loadProfile()?.name || "Creator");
    setDebateHref(chatDebateUrl());
    void loadCloudProfile().then((profile) => setName(profile?.name || loadProfile()?.name || "Creator"));
    const requested = new URLSearchParams(window.location.search).get("facility") as SceneObjectId | null;
    const requestedFacility = SCENE_OBJECTS.find((facility) => facility.id === requested);
    if (requestedFacility) {
      interactionLocked.current = true;
      setActiveFacility(requestedFacility);
    }
  }, [router]);

  const signOut = async () => { await clearSession(); router.push("/"); };

  const facilityFor = (object: CityInteractable): SceneObjectDef | null => {
    if (object.kind === "facility") return object;
    const routeMap: Record<string, SceneObjectId> = {
      "/video": "studio",
      "/profile": "homepage",
      "/intelligence": "bulletin",
      "/skills": "skillgarden",
      "/projects": "hackathon",
      "/creator": "agenthub",
      "/collaboration?zone=hackathon": "hackathon",
      "/collaboration?zone=dev": "table-dev",
      "/collaboration?zone=social": "table-social",
      "/collaboration?zone=agent": "agentroundtable",
    };
    const id = routeMap[object.route];
    return SCENE_OBJECTS.find((facility) => facility.id === id) || null;
  };

  const enterSelected = () => {
    if (!selected) return;
    const facility = facilityFor(selected);
    if (facility?.id === "agentroundtable") {
      window.location.assign(chatDebateUrl());
      return;
    }
    if (facility?.id === "studio" || facility?.id === "homepage") {
      window.location.assign(facility.route);
      return;
    }
    if (facility) {
      interactionLocked.current = true;
      setActiveFacility(facility);
    }
    setSelected(null);
  };

  const selectedPersonalAgent = selected?.kind === "npc" && selected.debateAgentId ? selected : null;
  const debateAgents = debateAgentIds
    .map((id) => CITY_NPCS.find((npc) => npc.debateAgentId === id))
    .filter((npc): npc is NonNullable<typeof npc> => Boolean(npc));

  const openPersonalPage = () => {
    if (!selectedPersonalAgent) return;
    window.location.assign(chatDebateUrl({ profile: selectedPersonalAgent.debateAgentId! }));
  };

  const toggleDebateAgent = () => {
    if (!selectedPersonalAgent) return;
    const id = selectedPersonalAgent.debateAgentId!;
    setDebateAgentIds((current) => current.includes(id)
      ? current.filter((value) => value !== id)
      : current.length < 6 ? [...current, id] : current);
  };

  const startDebate = () => {
    if (debateAgentIds.length < 2 || debateAgentIds.length > 6) return;
    window.location.assign(chatDebateUrl({ participants: debateAgentIds.join(",") }));
  };

  const dismissSelected = () => {
    interactionLocked.current = true;
    setSelected(null);
    window.setTimeout(() => { if (!activeFacility) interactionLocked.current = false; }, 120);
  };

  const closeFacility = () => {
    setActiveFacility(null);
    setSelected(null);
    if (new URLSearchParams(window.location.search).has("facility")) window.history.replaceState({}, "", "/city/neon");
    window.setTimeout(() => { interactionLocked.current = false; }, 120);
  };

  const selectObject = (object: CityInteractable) => {
    if (!interactionLocked.current) setSelected(object);
  };

  return (
    <main className="city-page relative h-svh w-screen overflow-hidden bg-[#aedbd0]">
      <CityGame onObjectSelect={selectObject} />
      <nav className="city-nav absolute right-3 top-3 z-20 sm:right-5 sm:top-5" aria-label="城市导航">
        <a href="/onboarding" title="个人简历生成"><FileText size={17} /><span>个人简历</span></a>
        <a href={debateHref} title="创作议事厅"><MessageCircleMore size={17} /><span>创作议事厅</span></a>
        <a className="city-nav-profile" href="/profile" title="个人主页"><UserRound size={17} /><span>{name}</span></a>
        <button type="button" onClick={signOut} title="退出登录" aria-label="退出登录"><LogOut size={17} /><span>退出</span></button>
      </nav>

      {debateAgents.length > 0 && (
        <aside className="city-debate-dock absolute left-1/2 top-3 z-30 -translate-x-1/2 sm:top-5" aria-label="辩论席位">
          <div><small>CHAT DEBATE</small><strong>已选 {debateAgents.length} / 6</strong></div>
          <ul>{debateAgents.map((agent) => <li key={agent.id}><Check size={12} />{agent.nameCn}</li>)}</ul>
          <button type="button" disabled={debateAgents.length < 2} onClick={startDebate}>进入辩论</button>
        </aside>
      )}

      {selected && (
        <div className="city-dialog-backdrop absolute inset-0 z-50 grid place-items-center p-4" onMouseDown={(event) => { if (event.currentTarget === event.target) dismissSelected(); }}>
          <section className={`city-dialog city-dialog-${selected.kind}`} onClick={(event) => event.stopPropagation()}>
            <div className="city-dialog-eaves" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
            <button className="city-dialog-close" type="button" onClick={dismissSelected} title="关闭" aria-label="关闭"><X size={18} /></button>
            <div className="city-dialog-heading">
              <span className="city-dialog-seal">{selected.kind === "npc" ? <MessageCircleMore size={24} /> : <Building2 size={24} />}</span>
              <div><p>{selected.kind === "npc" ? "京城偶遇 · CITY AGENT" : "院落去处 · DISTRICT ENTRY"}</p><h2>{selected.nameCn}</h2><small>{selected.kind === "npc" ? selected.role : selected.name}</small></div>
            </div>
            <p className="city-dialog-desc">{selected.desc}</p>
            {selected.kind === "npc" && <div className="city-dialog-lines">{selected.dialogue.map((line, index) => <p className={index % 2 ? "reply" : ""} key={line}><span>{index % 2 ? "答" : "问"}</span>{line}</p>)}</div>}
            <div className="city-dialog-actions">
              {selectedPersonalAgent ? (
                <>
                  <button className="primary" type="button" onClick={openPersonalPage}><span>{selectedPersonalAgent.id.includes("-") && !["lin-ran", "meng-yuxuan", "li-minghan"].includes(selectedPersonalAgent.id) ? "查看角色档案" : "查看个人主页"}</span><ArrowRight size={18} /></button>
                  <button type="button" onClick={toggleDebateAgent}>{debateAgentIds.includes(selectedPersonalAgent.debateAgentId!) ? "移出辩论" : "加入辩论"}</button>
                </>
              ) : (
                <button
                  className="primary"
                  type="button"
                  onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); enterSelected(); }}
                  onClick={(event) => { if (event.detail === 0) enterSelected(); }}
                ><span>{selected.kind === "npc" ? selected.actionLabel : "进入空间"}</span><ArrowRight size={18} /></button>
              )}
              <button type="button" onClick={dismissSelected}>留在院中</button>
            </div>
          </section>
        </div>
      )}

      {activeFacility && <CityFacilityWorkbench facility={activeFacility} onClose={closeFacility} />}
    </main>
  );
}
