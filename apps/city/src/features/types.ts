/**
 * Creator City - shared type definitions
 */

export type SceneObjectId =
  | "studio"
  | "homepage"
  | "bulletin"
  | "leaderboard"
  | "skillgarden"
  | "table-dev"
  | "table-social"
  | "agentroundtable"
  | "agenthub"
  | "hackathon";

export type BuildingId = SceneObjectId;

export type CreatorLevel =
  | "Initiate"
  | "Builder"
  | "Architect"
  | "Visionary";

export interface SceneObjectDef {
  kind: "facility";
  id: SceneObjectId;
  name: string;
  nameCn: string;
  desc: string;
  route: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
  accent: number;
  shape: "studio" | "bulletin" | "screen" | "table" | "garden" | "gate" | "hackathon" | "roundtable";
}

export interface CityNpcDef {
  kind: "npc";
  id: string;
  name: string;
  nameCn: string;
  role: string;
  desc: string;
  dialogue: string[];
  route: string;
  actionLabel: string;
  debateAgentId?: string;
  color: number;
  spriteFrame: number;
  points: { x: number; y: number }[];
  behavior: "patrol" | "tea" | "conversation-a" | "conversation-b";
}

export type CityInteractable = SceneObjectDef | CityNpcDef;

export interface SkillNode {
  id: string;
  label: string;
  level: number;
  category: string;
}

export interface ProjectEntry {
  id: string;
  title: string;
  author: string;
  category: "Agent" | "AI Coding" | "AI Design" | "Education" | "Research" | "Productivity";
  cover: string;
  techStack: string[];
  demoUrl?: string;
  githubUrl?: string;
  aiSummary: string;
}

export interface IntelligenceItem {
  id: string;
  source: "github" | "skill" | "research" | "pulse";
  title: string;
  summary: string;
  url?: string;
  metrics?: Record<string, number | string>;
  tags: string[];
}

export interface GrowthRecommendation {
  skill: string;
  currentLevel: number;
  targetLevel: number;
  reason: string;
  resources: string[];
}

export interface AgentProfile {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerType: "person" | "enterprise";
  status: "active" | "idle" | "offline";
  skills: string[];
  interests: string[];
  verified: boolean;
}

export interface AgentInteraction {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  type: "question" | "skill_exchange" | "content_share" | "match_proposal";
  status: "pending" | "accepted" | "declined" | "escalated_to_human";
  summary: string;
  timestamp: number;
}

export interface AgentMatchSignal {
  targetAgentId: string;
  targetOwnerName: string;
  matchScore: number;
  sharedInterests: string[];
  complementarySkills: string[];
  reason: string;
}
