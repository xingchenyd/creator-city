/** Local-first matching service. It never contacts another person or agent by itself. */

import type { AgentProfile, AgentInteraction, AgentMatchSignal } from "@/features/types";

export async function discoverMatches(
  agent: AgentProfile,
  pool: AgentProfile[]
): Promise<AgentMatchSignal[]> {
  const normalize = (values: string[]) => values.map((item) => item.trim().toLowerCase()).filter(Boolean);
  const ownSkills = normalize(agent.skills);
  const ownInterests = normalize(agent.interests);

  return pool
    .filter((candidate) => candidate.id !== agent.id && candidate.status !== "offline")
    .map((candidate) => {
      const skills = normalize(candidate.skills);
      const interests = normalize(candidate.interests);
      const sharedInterests = candidate.interests.filter((_, index) => ownInterests.includes(interests[index]));
      const complementarySkills = candidate.skills.filter((_, index) => !ownSkills.includes(skills[index]));
      const sharedSkills = skills.filter((skill) => ownSkills.includes(skill)).length;
      const verification = candidate.verified ? 8 : 0;
      const activity = candidate.status === "active" ? 5 : 2;
      const score = Math.min(99, 48 + sharedInterests.length * 11 + Math.min(4, complementarySkills.length) * 6 + sharedSkills * 3 + verification + activity);
      const reasonParts = [
        sharedInterests.length ? `共同关注 ${sharedInterests.slice(0, 2).join("、")}` : "目标方向存在交集",
        complementarySkills.length ? `可补充 ${complementarySkills.slice(0, 2).join("、")}` : "能力结构相近，适合结对评审",
        candidate.verified ? "公开作品证据已核验" : "仍需本人补充作品证据",
      ];
      return {
        targetAgentId: candidate.id,
        targetOwnerName: candidate.ownerName,
        matchScore: score,
        sharedInterests,
        complementarySkills,
        reason: reasonParts.join("；") + "。",
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

export async function preChat(
  from: AgentProfile,
  to: AgentProfile,
  maxTurns: number
): Promise<AgentInteraction[]> {
  const turns = Math.max(1, Math.min(3, maxTurns));
  const shared = from.interests.filter((item) => to.interests.some((candidate) => candidate.toLowerCase() === item.toLowerCase()));
  const complementary = to.skills.filter((item) => !from.skills.some((candidate) => candidate.toLowerCase() === item.toLowerCase()));
  const summaries = [
    `${from.ownerName} 的协作代理询问：当前最希望共同验证的创作命题是什么？`,
    `${to.ownerName} 的公开档案回应：可从 ${[...shared, ...to.interests].slice(0, 2).join("、") || "一个小型可验证原型"} 开始。`,
    `预沟通建议：由本人确认后，以 ${complementary.slice(0, 2).join("、") || "作品互评"} 为第一次会面议程。`,
  ];
  const now = Date.now();
  return summaries.slice(0, turns).map((summary, index) => ({
    id: `prechat-${from.id}-${to.id}-${now}-${index}`,
    fromAgentId: index === 1 ? to.id : from.id,
    toAgentId: index === 1 ? from.id : to.id,
    type: index === 2 ? "match_proposal" : "question",
    status: "pending",
    summary,
    timestamp: now + index,
  }));
}

export async function escalateToHuman(
  interactionId: string
): Promise<boolean> {
  if (!interactionId || typeof window === "undefined") return false;
  const key = "creator-city:human-review-queue:v1";
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "[]") as unknown;
    const current = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    window.localStorage.setItem(key, JSON.stringify(Array.from(new Set([...current, interactionId]))));
    window.dispatchEvent(new CustomEvent("creator-city:review-queued", { detail: interactionId }));
    return true;
  } catch {
    return false;
  }
}
