import expertPersonas from "../../shared/domain/ExpertPersonas.json";
import sampleProfileJson from "../../shared/domain/lin-ran.sample.json";
import mengYuxuanProfileJson from "../../shared/domain/meng-yuxuan.json";
import liMinghanProfileJson from "../../shared/domain/li-minghan.json";
import type { Agent, PersonalAgentProfile } from "@/types";

const visualMap: Record<string, { accent: string; avatarPrefix?: string }> = {
  "product-editor": { accent: "#b44d42" },
  "evidence-researcher": { accent: "#477482" },
  "experience-designer": { accent: "#8a5da0" },
  "systems-builder": { accent: "#2f7564" },
  "growth-strategist": { accent: "#b7812e" },
  "ethics-steward": { accent: "#58666d" },
  "demo-director": { accent: "#d36f3d" },
  trump: { accent: "#e7aa45", avatarPrefix: "PetTrump" },
  claude: { accent: "#8b7ccf", avatarPrefix: "PetClawd" },
  doubao: { accent: "#3fac83", avatarPrefix: "PetDoubaoHuman" },
  musk: { accent: "#6f8794", avatarPrefix: "PetMuskie" },
  zhangxuefeng: { accent: "#d39930", avatarPrefix: "PetZhangXuefeng" },
  leijun: { accent: "#4d8db7", avatarPrefix: "PetLeiJun" },
  zhangyiming: { accent: "#5b9b66", avatarPrefix: "PetZhangYiming" },
  "sam-altman": { accent: "#7b6f9d", avatarPrefix: "PetSam" },
  einstein: { accent: "#8b7a4a", avatarPrefix: "PetEinstein" },
  newton: { accent: "#65758a", avatarPrefix: "PetNewton" },
  "jensen-huang": { accent: "#5e846c", avatarPrefix: "PetJensenHuang" },
  usachi: { accent: "#a96f83", avatarPrefix: "PetUsachi" },
  hachiware: { accent: "#6f91a6", avatarPrefix: "PetXiaoba" },
  nailong: { accent: "#c7894e", avatarPrefix: "PetHappyNailong" },
  bubu: { accent: "#8a6f61", avatarPrefix: "PetBubu" },
  rilakkuma: { accent: "#8c765a", avatarPrefix: "PetRilakkuma" },
  "l-lawliet": { accent: "#596779", avatarPrefix: "PetL" },
  misa: { accent: "#a26783", avatarPrefix: "PetMisa" },
  conan: { accent: "#547899", avatarPrefix: "PetConan" },
  luffy: { accent: "#a65f52", avatarPrefix: "PetLuffy" },
  feynman: { accent: "#77725c" },
  "carl-sagan": { accent: "#536b82" },
  "lu-xun": { accent: "#7b5f59" },
  "andy-warhol": { accent: "#8d6b8c" },
  "carl-jung": { accent: "#526f6a" },
  "feng-xiaogang": { accent: "#80665b" },
  "hu-chenfeng": { accent: "#6f7560" },
  "chen-danqing": { accent: "#7e6556" },
  xiongda: { accent: "#68754f" },
};

const preferredIds = new Set([
  "product-editor",
  "evidence-researcher",
  "experience-designer",
  "systems-builder",
  "growth-strategist",
  "ethics-steward",
  "demo-director",
]);

export const roundtableAgents: Agent[] = (expertPersonas as Array<Record<string, unknown>>)
  .filter((persona) => preferredIds.has(String(persona.id)))
  .map((persona) => {
    const id = String(persona.id);
    const visual = visualMap[id];
    return {
      id,
      name: String(persona.displayName),
      role: String(persona.role),
      kind: "roundtable",
      coreBelief: String(persona.coreBelief),
      speechStyle: String(persona.speechStyle),
      debateStyle: String(persona.debateStyle),
      accent: visual.accent,
      avatarPrefix: visual.avatarPrefix,
    };
  });

export const sampleProfiles = [
  sampleProfileJson,
  mengYuxuanProfileJson,
  liMinghanProfileJson,
] as unknown as PersonalAgentProfile[];

export const sampleProfile = sampleProfiles[0];

export function profileToAgent(profile: PersonalAgentProfile): Agent {
  return {
    id: profile.id,
    name: profile.identity.displayName,
    role: profile.runtime.role,
    kind: "personal",
    coreBelief: profile.runtime.coreBelief,
    speechStyle: profile.runtime.speechStyle,
    debateStyle: profile.runtime.debateStyle,
    accent: profileAccent(profile.id),
    avatarPrefix: profileAvatar(profile.id),
    profile,
  };
}

function profileAvatar(id: string): string | undefined {
  if (id === "lin-ran") return "PetLinRan";
  if (id === "meng-yuxuan") return "PetMengYuxuan";
  if (id === "li-minghan") return "PetLiMinghan";
  return undefined;
}

function profileAccent(id: string): string {
  if (id === "lin-ran") return "#d48258";
  if (id === "meng-yuxuan") return "#4f7995";
  if (id === "li-minghan") return "#7b6c9c";
  return colorFromId(id);
}

function colorFromId(id: string): string {
  const palette = ["#497a78", "#aa6758", "#6d77a8", "#8a794e", "#9a5d78"];
  const hash = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
}
