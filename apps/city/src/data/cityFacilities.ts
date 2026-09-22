export type CityNewsItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary: string;
  category: "AI" | "CODING" | "AGENT" | "GITHUB";
};

export type CityModel = {
  id: string;
  name: string;
  shortName: string;
  org: string;
  coding: number;
  reasoning: number;
  agent: number;
  multimodal: number;
  speed: number;
  overall: number;
  input: number;
  output: number;
  context: number;
  use: string;
  sourceUrl: string;
};

export const newsFallback: CityNewsItem[] = [
  { id: "codex", title: "openai/codex 持续更新本地编码 Agent", url: "https://github.com/openai/codex", source: "GitHub", publishedAt: "2026-07-24", summary: "观察终端执行、权限审批、工具调用与可复现工作流。", category: "CODING" },
  { id: "agents", title: "OpenAI Agent 构建工具与实践", url: "https://openai.com/index/new-tools-for-building-agents/", source: "OpenAI", publishedAt: "2025-03-11", summary: "官方 Agent 产品与开发工具入口。", category: "AGENT" },
  { id: "copilot", title: "GitHub Copilot 与 coding agent 更新", url: "https://github.blog/ai-and-ml/github-copilot/", source: "GitHub Blog", publishedAt: "2026-07", summary: "面向开发流程、代码审查与 Agent 协作的官方更新。", category: "CODING" },
];

export const modelFallback: CityModel[] = [
  { id: "openai/gpt-5.6-sol", name: "GPT-5.6 Sol", shortName: "GPT-5.6 Sol", org: "OpenAI", coding: 98, reasoning: 97, agent: 98, multimodal: 91, speed: 72, overall: 91, input: 5, output: 30, context: 1_050_000, use: "复杂工程与长程 Agent", sourceUrl: "https://openrouter.ai/openai/gpt-5.6-sol" },
  { id: "anthropic/claude-sonnet-5", name: "Claude Sonnet 5", shortName: "Claude Sonnet 5", org: "Anthropic", coding: 96, reasoning: 96, agent: 95, multimodal: 90, speed: 80, overall: 91, input: 2, output: 10, context: 1_000_000, use: "代码、长文与工具调用", sourceUrl: "https://openrouter.ai/anthropic/claude-sonnet-5" },
  { id: "google/gemini-3.6-flash", name: "Gemini 3.6 Flash", shortName: "Gemini 3.6 Flash", org: "Google", coding: 90, reasoning: 89, agent: 88, multimodal: 96, speed: 96, overall: 92, input: 1.5, output: 7.5, context: 1_048_576, use: "高速多模态与长上下文", sourceUrl: "https://openrouter.ai/google/gemini-3.6-flash" },
  { id: "qwen/qwen3.7-plus", name: "Qwen3.7 Plus", shortName: "Qwen3.7 Plus", org: "Qwen", coding: 91, reasoning: 91, agent: 89, multimodal: 86, speed: 91, overall: 90, input: .32, output: 1.28, context: 1_000_000, use: "中文、工具调用与高性价比", sourceUrl: "https://openrouter.ai/qwen/qwen3.7-plus" },
  { id: "deepseek/deepseek-v3.2", name: "DeepSeek V3.2", shortName: "DeepSeek V3.2", org: "DeepSeek", coding: 92, reasoning: 91, agent: 88, multimodal: 70, speed: 90, overall: 86, input: .269, output: .4, context: 163_840, use: "编码与批量文本任务", sourceUrl: "https://openrouter.ai/deepseek/deepseek-v3.2" },
];

export const citySkills = [
  { name: "Remotion Best Practices", type: "VIDEO", source: "remotion-dev/skills", desc: "用帧驱动动画、媒体时间线和可渲染组件生成程序化视频。", tasks: ["个人介绍片", "数据视频", "批量模板"], install: "npx skills add remotion-dev/skills" },
  { name: "Browser Use", type: "AGENT", source: "browser-use/browser-use", desc: "让 Agent 浏览和操作网页，适合调研、测试与流程自动化。", tasks: ["浏览器自动化", "网页测试", "信息采集"], install: "pip install browser-use" },
  { name: "OpenAI Codex", type: "CODING", source: "openai/codex", desc: "在真实仓库中读取、修改和验证代码的编码 Agent。", tasks: ["代码实现", "仓库理解", "测试修复"], install: "npm install -g @openai/codex" },
  { name: "LangGraph", type: "WORKFLOW", source: "langchain-ai/langgraph", desc: "把有状态、可恢复的 Agent 编排成图。", tasks: ["多 Agent", "审批节点", "持久状态"], install: "pip install -U langgraph" },
  { name: "MCP Servers", type: "TOOLS", source: "modelcontextprotocol/servers", desc: "用标准协议把数据源和工具接入模型。", tasks: ["工具连接", "数据边界", "资源发现"], install: "npx @modelcontextprotocol/server-everything" },
  { name: "CrewAI", type: "AGENT", source: "crewAIInc/crewAI", desc: "以角色和任务组织多 Agent 协作流程。", tasks: ["研究团队", "内容流水线", "任务委派"], install: "pip install crewai" },
];

export const hackathonTeams = [
  { name: "中轴叙事引擎", challenge: "AI for Beijing", pitch: "把北京街区史料变成可游玩的多模态路线", stage: "PROTOTYPE", members: ["产品 / 星辰", "Agent 工程 / 北辰"], open: ["交互设计", "北京地方史"], tech: ["Remotion", "RAG", "Map"], deadline: "08.16", progress: 62 },
  { name: "Patchwork Agents", challenge: "Open Source AI Hack", pitch: "能在失败后恢复的浏览器协作 Agent", stage: "BUILD", members: ["Python / Ada", "前端 / Ming"], open: ["Agent 评测", "Demo 叙事"], tech: ["Browser Use", "LangGraph"], deadline: "08.03", progress: 74 },
  { name: "回声档案馆", challenge: "Creative AI Weekend", pitch: "把口述史、照片和地点生成可校对的视频档案", stage: "IDEA", members: ["影像 / Lin", "研究 / Xun"], open: ["全栈开发", "数据治理"], tech: ["Whisper", "Remotion"], deadline: "08.09", progress: 35 },
];

export type DevTask = {
  id: number;
  title: string;
  repo: string;
  type: string;
  reward: number;
  money: string;
  acceptance: string[];
  stack: string[];
  owner: string;
  due: string;
};

export const initialDevTasks: DevTask[] = [
  { id: 1, title: "Remotion 中文长标题极限输入回归", repo: "xingchenyd/creator-city", type: "TEST", reward: 180, money: "¥30", acceptance: ["覆盖 12 组输入", "附 3 张失败截图", "提交复现步骤"], stack: ["Playwright", "Remotion"], owner: "星辰", due: "今天 22:00" },
  { id: 2, title: "Windows 中文路径下的 Electron 打包验证", repo: "qybaihe/mooncut", type: "COMPAT", reward: 320, money: "¥66", acceptance: ["Win 11 实机", "首次启动日志", "给出可复现结论"], stack: ["Electron", "Windows"], owner: "qybaihe", due: "07.27" },
  { id: 3, title: "Browser Agent 登录态恢复测试矩阵", repo: "browser-use/browser-use", type: "QA DESIGN", reward: 240, money: "", acceptance: ["定义 8 个状态", "区分可恢复/不可恢复", "输出测试矩阵"], stack: ["Browser", "Agent"], owner: "北海测试所", due: "07.29" },
];

export const creatorMatches = [
  { name: "星辰", handle: "xingchenyd", title: "数据分析 × AI 产品 × 商业分析", offers: ["产品叙事", "数据分析", "Remotion"], seeks: ["Agent 工程", "交互设计"], projects: ["Creator City", "ColorBook", "Scrap Loop"], match: 96, reason: "你们都在做创作者工具；星辰的产品与叙事能力可补足 Agent 工程。" },
  { name: "qybaihe", handle: "qybaihe", title: "AI 视频与跨端产品构建者", offers: ["Remotion", "FFmpeg", "SwiftUI"], seeks: ["AI 产品", "多模态工作流"], projects: ["MoonCut", "Chat Debate"], match: 92, reason: "视频工作流与 Creator City 的个人主页生成链路高度相关。" },
  { name: "browser-use", handle: "browser-use", title: "Browser agent open-source team", offers: ["Browser Automation", "Python", "Agent"], seeks: ["评测", "生态案例"], projects: ["browser-use"], match: 85, reason: "适合作为浏览器 Agent 工程与可靠执行的公开案例连接。" },
  { name: "OpenHands", handle: "OpenHands", title: "AI-driven development community", offers: ["Agent Runtime", "Developer Tools"], seeks: ["开源贡献", "真实任务"], projects: ["OpenHands"], match: 82, reason: "开发测试桌上的任务可以成为真实 Agent 能力评测样本。" },
];

export type CityHackathonEvent = {
  id: string;
  name: string;
  organizer: string;
  date: string;
  deadline: string;
  deadlineAt?: string;
  location: string;
  mode: "ONLINE" | "HYBRID" | "IN PERSON";
  status: "报名中" | "即将开放" | "活动入口" | "报名已截止" | "已结束" | "待核验";
  region: "DOMESTIC" | "GLOBAL";
  prize: string;
  eligibility: string;
  evidenceGrade: "A" | "B" | "PORTAL";
  verifiedAt: string;
  summary: string;
  tags: string[];
  registrationUrl: string;
  sourceUrl: string;
};

export const competitions: CityHackathonEvent[] = [
  {
    id: "robbyant-2026", name: "首届蚂蚁灵波具身大模型挑战赛", organizer: "蚂蚁灵波 · 魔搭社区 · 阿里云天池",
    date: "2026 · 线上初赛 + 线下真机黑客松", deadline: "2026.10.26（具体时区见官方页）",
    deadlineAt: "2026-10-26T00:00:00+08:00", location: "中国大陆 · 线上初赛 / 线下决赛", mode: "HYBRID",
    status: "报名中", region: "DOMESTIC", prize: "¥280,000", eligibility: "企业、高校、个人开发者及技术爱好者；详见官方规则",
    evidenceGrade: "B", verifiedAt: "2026-09-22", summary: "基于 LingBot-VLA 2.0 的模型复现、训练调优和真机适配挑战，含线下黑客马拉松。",
    tags: ["具身智能", "VLA", "中国大陆"], registrationUrl: "https://modelscope.cn/events", sourceUrl: "https://modelscope.cn/events",
  },
  {
    id: "openatom-industry-2026", name: "第四届开放原子大赛 · 开源行业解决方案创新赛", organizer: "开放原子开源基金会 · 开源中国",
    date: "2026 赛季", deadline: "报名窗口以赛事官网为准", location: "中国大陆 · 北京", mode: "HYBRID",
    status: "待核验", region: "DOMESTIC", prize: "见官方奖项说明", eligibility: "企业、科研院所、高校实验室等；详见赛项要求",
    evidenceGrade: "B", verifiedAt: "2026-09-22", summary: "围绕医疗、制造、教育、金融等行业，提交可落地的开源解决方案。已核验赛事存在，当前报名窗口待确认。",
    tags: ["开源", "行业应用", "AI"], registrationUrl: "https://www.oschina.net/oa2026/", sourceUrl: "https://www.openatom.org/journalism/detail/F0onmmkGQvzG",
  },
  {
    id: "weekly-cn", name: "周周黑客松 · 国内活动日历", organizer: "HackathonWeekly",
    date: "滚动活动", deadline: "按各场活动报名窗口", location: "深圳 / 杭州 / 北京等", mode: "IN PERSON",
    status: "活动入口", region: "DOMESTIC", prize: "按具体活动", eligibility: "创作者、独立开发者、产品人与技术爱好者",
    evidenceGrade: "PORTAL", verifiedAt: "2026-09-22", summary: "国内社区的迷你黑客松、Demo Show 与工作坊；进入活动日历选择所在城市与最新场次。",
    tags: ["黑客松", "独立开发", "国内社区"], registrationUrl: "https://hackathonweekly.com/events", sourceUrl: "https://hackathonweekly.com/",
  },
  {
    id: "modelscope-cn", name: "魔搭社区 · 黑客松与 AI 开发赛", organizer: "ModelScope",
    date: "持续更新", deadline: "按具体赛项", location: "中国大陆 / 线上", mode: "HYBRID",
    status: "活动入口", region: "DOMESTIC", prize: "现金、算力及社区权益，按赛项", eligibility: "按具体赛事规则",
    evidenceGrade: "PORTAL", verifiedAt: "2026-09-22", summary: "魔搭官方赛事目录，覆盖黑客松、应用开发、算法和模型实践活动。",
    tags: ["AI", "魔搭", "黑客松"], registrationUrl: "https://modelscope.cn/events", sourceUrl: "https://modelscope.cn/events",
  },
  {
    id: "fde-20260921", name: "FDE 实战松 · 前线交付战", organizer: "云谷中心 · 魔搭社区 · 蜂元智能",
    date: "2026.09.21", deadline: "本场已结束", deadlineAt: "2026-09-18T00:00:00+08:00", location: "杭州 · 云谷中心", mode: "IN PERSON",
    status: "已结束", region: "DOMESTIC", prize: "¥19,000", eligibility: "每队 1–3 人；保留活动复盘入口",
    evidenceGrade: "A", verifiedAt: "2026-09-22", summary: "围绕具身智能数据工厂与园区 AI 提效开展单日开发，交付方案、报价与可运行 Demo。本场已结束。",
    tags: ["FDE", "Agent", "杭州"], registrationUrl: "https://byteswarm-ai.com/fde/hack", sourceUrl: "https://byteswarm-ai.com/fde/hack",
  },
  {
    id: "revenuecat-shipaton-2026",
    name: "RevenueCat Shipaton 2026",
    organizer: "RevenueCat · Devpost",
    date: "2026.08.25 - 10.01",
    deadline: "2026.10.01 14:45（北京时间）",
    deadlineAt: "2026-10-01T14:45:00+08:00",
    location: "全球线上",
    mode: "ONLINE",
    status: "报名中",
    region: "GLOBAL",
    prize: "$685,000 现金及权益",
    eligibility: "中国大陆可参赛；提交前核对官方规则",
    evidenceGrade: "A",
    verifiedAt: "2026-08-30",
    summary: "围绕应用内购买与订阅体验构建并发布可体验产品。",
    tags: ["APP", "PRODUCT", "GLOBAL"],
    registrationUrl: "https://revenuecat-shipaton-2026.devpost.com/",
    sourceUrl: "https://revenuecat-shipaton-2026.devpost.com/",
  },
  {
    id: "opencv-ai-competition-2026",
    name: "OpenCV AI Competition 2026",
    organizer: "OpenCV · Devpost",
    date: "2026.08.25 - 10.27",
    deadline: "2026.10.27 14:45（北京时间）",
    deadlineAt: "2026-10-27T14:45:00+08:00",
    location: "全球线上",
    mode: "ONLINE",
    status: "报名中",
    region: "GLOBAL",
    prize: "$10,000 现金",
    eligibility: "中国大陆可参赛；需遵守硬件与提交规则",
    evidenceGrade: "B",
    verifiedAt: "2026-08-30",
    summary: "使用 OpenCV 与边缘 AI 方案解决真实视觉问题。",
    tags: ["COMPUTER VISION", "EDGE AI", "OPEN SOURCE"],
    registrationUrl: "https://opencv26.devpost.com/",
    sourceUrl: "https://opencv26.devpost.com/",
  },
  {
    id: "devpost-ai-hackathons",
    name: "Devpost AI Hackathons",
    organizer: "Devpost",
    date: "持续更新",
    deadline: "按赛事截止时间排序",
    location: "全球 / 线上与线下",
    mode: "HYBRID",
    status: "活动入口",
    region: "GLOBAL",
    prize: "按具体赛事",
    eligibility: "按具体赛事官方规则",
    evidenceGrade: "PORTAL",
    verifiedAt: "2026-09-22",
    summary: "Devpost 机器学习与 AI 赛事聚合入口，报名时进入具体主办方页面核验。",
    tags: ["MACHINE LEARNING", "OPEN SOURCE", "PRODUCT"],
    registrationUrl: "https://devpost.com/hackathons?themes[]=Machine%20Learning%2FAI",
    sourceUrl: "https://devpost.com/hackathons",
  },
  {
    id: "hackquest-hackathons",
    name: "HackQuest Hackathons",
    organizer: "HackQuest",
    date: "持续更新",
    deadline: "查看当前报名窗口",
    location: "全球 / 线上与线下",
    mode: "HYBRID",
    status: "活动入口",
    region: "GLOBAL",
    prize: "按具体赛事",
    eligibility: "按具体赛事官方规则",
    evidenceGrade: "PORTAL",
    verifiedAt: "2026-09-22",
    summary: "面向开发者的赛事入口，覆盖 AI、开源与 Web3 主题。",
    tags: ["AI", "WEB3", "OPEN SOURCE"],
    registrationUrl: "https://www.hackquest.io/hackathons",
    sourceUrl: "https://www.hackquest.io/hackathons",
  },
];

export const hallTeamSignals = [
  { name: "Turing Hutong", need: "交互设计", stack: ["Agent", "Next.js"], match: 92 },
  { name: "北海编译所", need: "Python / RAG", stack: ["Research", "Data"], match: 87 },
  { name: "中轴创作组", need: "产品与路演", stack: ["Remotion", "Story"], match: 83 },
];
