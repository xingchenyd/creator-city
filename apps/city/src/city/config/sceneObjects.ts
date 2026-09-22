import type { SceneObjectDef } from "@/features/types";

export const SCENE_OBJECTS: SceneObjectDef[] = [
  // These bounds were measured from the real 1672×941 courtyard base and
  // converted to the 1280×720 Phaser world. Each image stays on one stone pad;
  // the fourth lower round pad remains open for roaming and conversation NPCs.
  { kind: "facility", id: "bulletin", name: "AI Intelligence Academy", nameCn: "智能资讯书院", desc: "读取 GitHub、OpenAI 与开发者网站的 AI、Coding、Agent 最新信号。", route: "/intelligence", x: 176, y: 119, w: 174, h: 142, color: 0xfff9df, accent: 0xd94b3f, shape: "bulletin" },
  { kind: "facility", id: "leaderboard", name: "Model Observatory", nameCn: "模型天文台", desc: "实时查看最新上架模型、价格、上下文与接口支持能力。", route: "/leaderboard", x: 363, y: 119, w: 174, h: 142, color: 0x163531, accent: 0xffd64f, shape: "screen" },
  { kind: "facility", id: "table-dev", name: "Build & Test Workshop", nameCn: "开发测试工坊", desc: "发布开发与测试需求，可设置积分或红包奖励。", route: "/collaboration?zone=dev", x: 557, y: 119, w: 166, h: 142, color: 0x4b86d1, accent: 0x42c8c4, shape: "table" },
  { kind: "facility", id: "homepage", name: "Personal Homepage", nameCn: "个人主页", desc: "展示当前用户的静态简历、经历与项目档案。", route: "/profile", x: 819, y: 80, w: 278, h: 216, color: 0xd94b3f, accent: 0xffd64f, shape: "studio" },
  { kind: "facility", id: "skillgarden", name: "Skill & Open Source Market", nameCn: "Skill 与开源集市", desc: "浏览新 Skill、工作流、开源项目与安装方式。", route: "/skills", x: 111, y: 390, w: 160, h: 157, color: 0x4d9b63, accent: 0xffd64f, shape: "garden" },
  { kind: "facility", id: "table-social", name: "Creator Match Teahouse", nameCn: "创作者交友茶馆", desc: "设置想遇见的人，匹配 Agent 会先行筛选并推送合适对象。", route: "/collaboration?zone=social", x: 307, y: 397, w: 124, h: 139, color: 0x7256a8, accent: 0xe7668b, shape: "table" },
  { kind: "facility", id: "agentroundtable", name: "Chat Debate Hall", nameCn: "Agent 辩论馆", desc: "从城市人物中选择 2–6 位个人 Agent，进入微信式辩论群聊。", route: "/chat-debate", x: 458, y: 397, w: 126, h: 139, color: 0x236b5b, accent: 0x42c8c4, shape: "roundtable" },
  { kind: "facility", id: "hackathon", name: "Hackathon Hub", nameCn: "黑客松会馆", desc: "聚合近期官方黑客松赛程，并直达主办方报名页面。", route: "/projects", x: 681, y: 397, w: 128, h: 139, color: 0xd94b3f, accent: 0xffd64f, shape: "hackathon" },
  { kind: "facility", id: "studio", name: "Creator Profile Studio", nameCn: "个人简历生成馆", desc: "直接打开由个人档案生成的 Remotion 视频界面。", route: "/video", x: 827, y: 390, w: 166, h: 157, color: 0xd94b3f, accent: 0xffd64f, shape: "studio" },
  { kind: "facility", id: "agenthub", name: "Creator Gallery", nameCn: "创作者影像展厅", desc: "播放不同用户的 Remotion 主页影片，并浏览结构化项目档案。", route: "/creator", x: 1011, y: 367, w: 170, h: 180, color: 0xd94b3f, accent: 0xffd64f, shape: "gate" },
];
