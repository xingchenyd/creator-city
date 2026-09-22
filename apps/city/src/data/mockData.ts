/**
 * Curated local data used when a live provider is unavailable.
 */

export const aiPulse = {
  momentum: 87,
  trendingFields: [
    { name: "AI Agents", score: 95, change: "+12" },
    { name: "RAG Systems", score: 88, change: "+8" },
    { name: "AI Coding", score: 92, change: "+15" },
    { name: "Multimodal", score: 85, change: "+6" },
    { name: "AI Safety", score: 72, change: "+3" },
  ],
};

export const githubRadar = [
  { id: "1", name: "openai/codex", stars: 24500, forks: 2100, lang: "TypeScript", summary: "AI coding agent that writes code in your terminal", tags: ["AI Coding", "Agent"] },
  { id: "2", name: "langchain-ai/langgraph", stars: 8900, forks: 1200, lang: "Python", summary: "Build resilient language agents as graphs", tags: ["Agent", "RAG"] },
  { id: "3", name: "browser-use/browser-use", stars: 12300, forks: 980, lang: "Python", summary: "Make AI control your browser", tags: ["Browser Agent"] },
  { id: "4", name: "All-Hands-AI/OpenHands", stars: 15600, forks: 1800, lang: "Python", summary: "Open-source AI software engineer", tags: ["AI Coding"] },
  { id: "5", name: "lobehub/lobe-chat", stars: 42000, forks: 9500, lang: "TypeScript", summary: "Open-source AI chat framework", tags: ["Chat", "Multimodal"] },
];

export const skillRadar = [
  { id: "1", name: "Browser Agent", demand: 94, growth: "+22%" },
  { id: "2", name: "Coding Agent", demand: 91, growth: "+18%" },
  { id: "3", name: "Memory System", demand: 78, growth: "+12%" },
  { id: "4", name: "RAG Pipeline", demand: 86, growth: "+15%" },
  { id: "5", name: "Prompt Engineering", demand: 82, growth: "+8%" },
  { id: "6", name: "AI Product Design", demand: 75, growth: "+20%" },
];

export const researchRadar = [
  { id: "1", title: "Tree of Thoughts: Deliberate Problem Solving with LLMs", authors: "Yao et al.", date: "2026-06", innovation: "Self-evaluation guided search over thought trees", direction: "Reasoning" },
  { id: "2", title: "ToolFormer: Language Models Can Teach Themselves to Use Tools", authors: "Schick et al.", date: "2026-05", innovation: "Self-supervised tool usage learning", direction: "Tool Use" },
  { id: "3", title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks", authors: "Lewis et al.", date: "2026-04", innovation: "RAG architecture for external knowledge", direction: "RAG" },
];

export const modelLeaderboard = [
  { rank: 1, name: "GPT-5", org: "OpenAI", score: 96.2, coding: 98, reasoning: 95, speed: 89 },
  { rank: 2, name: "Claude 4 Opus", org: "Anthropic", score: 94.8, coding: 93, reasoning: 97, speed: 82 },
  { rank: 3, name: "Gemini 2.5 Ultra", org: "Google", score: 93.1, coding: 91, reasoning: 94, speed: 88 },
  { rank: 4, name: "Llama 4 405B", org: "Meta", score: 88.5, coding: 86, reasoning: 89, speed: 78 },
  { rank: 5, name: "DeepSeek V3", org: "DeepSeek", score: 85.3, coding: 88, reasoning: 83, speed: 91 },
];

export const personalSignal = [
  { id: "1", type: "project", title: "New RAG framework matches your skills", relevance: 92, action: "Explore" },
  { id: "2", type: "skill", title: "Browser Agent demand rising in your area", relevance: 85, action: "Learn" },
  { id: "3", type: "paper", title: "Memory systems paper aligns with your projects", relevance: 78, action: "Read" },
];

export const creatorProfile = {
  name: "Alex Chen",
  level: "Architect",
  title: "AI Product Builder",
  bio: "Building AI-native tools that make creators 10x more effective. Focus on agent architectures and RAG systems.",
  skills: [
    { name: "AI Agents", level: 92, category: "Core" },
    { name: "RAG Systems", level: 88, category: "Core" },
    { name: "TypeScript", level: 90, category: "Engineering" },
    { name: "Python", level: 85, category: "Engineering" },
    { name: "Product Design", level: 78, category: "Design" },
    { name: "Prompt Engineering", level: 86, category: "Core" },
  ],
  projects: [
    { id: "1", title: "AgentForge", role: "Creator", tech: ["TypeScript", "OpenAI", "LangGraph"], desc: "Visual agent builder for non-technical users", stars: 1200 },
    { id: "2", title: "RAGBase", role: "Lead Dev", tech: ["Python", "FastAPI", "Pinecone"], desc: "Drop-in RAG pipeline with citation tracking", stars: 890 },
    { id: "3", title: "PixelPrompt", role: "Creator", tech: ["React", "DALL-E", "Remotion"], desc: "AI-powered content creation studio", stars: 2100 },
  ],
  achievements: [
    { id: "1", title: "Hackathon Winner 2025", desc: "1st place at AI Builder Hackathon" },
    { id: "2", title: "Open Source Star", desc: "2k+ stars across projects" },
    { id: "3", title: "Top 1% Contributor", desc: "GitHub active contributor" },
  ],
  aiSummary: "Alex is a full-stack AI builder with strong agent architecture and RAG expertise. Their projects show a pattern of making complex AI accessible to non-technical users. Growth trajectory suggests expanding into AI product strategy.",
  stats: { projects: 12, stars: 4190, contributions: 856, followers: 320 },
};

type MuseumProject = {
  id: string;
  title: string;
  author: string;
  category: string;
  tech: string[];
  desc: string;
  cover: string;
  github: string;
  demo?: string;
};

export const projectsMuseum: MuseumProject[] = [
  { id: "creator-city", title: "Creator City", author: "xingchenyd", category: "AI Design", tech: ["Next.js", "Remotion", "Supabase"], desc: "把创作者档案、作品证据、协作与多 Agent 议事组织进一座可探索的北京像素社区。", cover: "#236b5b", github: "github.com/xingchenyd/creator-city" },
  { id: "colorbook", title: "ColorBook · 此地有回声", author: "xingchenyd", category: "Education", tech: ["城市叙事", "AI", "Web"], desc: "将北京与天津的地点、故事卡牌和现实任务编排成可参与的城市文化体验。", cover: "#d94b3f", github: "github.com/xingchenyd/colorbook" },
  { id: "scrap-loop", title: "Scrap Loop · 废品轮回", author: "xingchenyd", category: "Education", tech: ["Pixel RPG", "Game Design", "Web"], desc: "用像素探索、物品分类和循环机制，把环保回收知识做成可玩的网页原型。", cover: "#d9b451", github: "github.com/xingchenyd/scrap-loop" },
  { id: "mooncut", title: "MoonCut", author: "qybaihe", category: "Productivity", tech: ["Remotion", "FFmpeg", "Electron"], desc: "面向 AI 口播内容的跨端视频工作台，覆盖素材、编排与渲染流程。", cover: "#7256a8", github: "github.com/qybaihe/mooncut" },
  { id: "roundtable", title: "Roundtable", author: "qybaihe", category: "Agent", tech: ["React", "FastAPI", "Multi-Agent"], desc: "多角色立场、质询与收敛式讨论引擎，是创作议事厅的核心参考实现。", cover: "#477482", github: "github.com/qybaihe/Roundtable" },
  { id: "yd-academic-ppt", title: "Academic PPT Skill", author: "xingchenyd", category: "Research", tech: ["Codex Skill", "Presentation", "Workflow"], desc: "把研究材料和结构要求转化为可复用的学术演示工作流。", cover: "#c36c3d", github: "github.com/xingchenyd/yd-academic-ppt" },
];

export const mentorRecommendations = [
  { skill: "Multi-Agent Systems", currentLevel: 45, targetLevel: 80, reason: "Aligns with AI Agent trend (95) and your agent projects", resources: ["LangGraph docs", "AutoGen tutorial", "Agent communication patterns"] },
  { skill: "Vector Databases", currentLevel: 60, targetLevel: 85, reason: "Core to RAG systems (88) and your RAGBase project", resources: ["Pinecone course", "RAG optimization guide"] },
  { skill: "AI Product Strategy", currentLevel: 40, targetLevel: 75, reason: "Your growth trajectory suggests product leadership potential", resources: ["AI product framework", "Creator economy analysis"] },
];

export const collaborationMatches = [
  { id: "1", name: "Yuki Zhang", avatar: "Y", matchScore: 92, reason: "Complementary: your backend + their frontend. Shared interest in RAG.", skills: ["React", "UI/UX", "TypeScript"], project: "VisualRAG" },
  { id: "2", name: "Chen Wei", avatar: "C", matchScore: 87, reason: "Both working on agent systems. Shared research interest in multi-agent.", skills: ["Python", "LangGraph", "Research"], project: "AgentSim" },
  { id: "3", name: "Zhao Min", avatar: "Z", matchScore: 83, reason: "Productivity tools overlap. Your AI + their workflow expertise.", skills: ["Workflow", "TypeScript", "Design"], project: "FlowState" },
];
