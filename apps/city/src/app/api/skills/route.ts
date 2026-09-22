import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
export const dynamic = "force-dynamic";
const getDailySkills = unstable_cache(async () => {
    const query = encodeURIComponent("topic:agent-skills fork:false archived:false stars:>10");
    const headers: Record<string, string> = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const response = await fetch(`https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=100`,
      { headers, cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(response.status === 403 || response.status === 429 ? "GitHub API 额度暂时用尽，请稍后重试" : `GitHub 返回 ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.items)) throw new Error("GitHub 仓库数据格式异常");
    const data = payload.items.map((repo: { full_name: string; description: string; html_url: string; stargazers_count: number; forks_count: number; pushed_at: string; created_at: string; topics: string[]; language: string }) => ({
      name: repo.full_name, description: repo.description || "查看仓库了解 Skill 内容与安装方式。",
      url: repo.html_url, stars: repo.stargazers_count, forks: repo.forks_count,
      updatedAt: repo.pushed_at, createdAt: repo.created_at, topics: repo.topics || [], language: repo.language,
    }));
    return { ok: true, data, source: "GitHub 官方 API · agent-skills · Star 排名",
      fetchedAt: response.headers.get("date") || new Date().toISOString(), refreshAfterSeconds: 86400,
      total: payload.total_count, incomplete: Boolean(payload.incomplete_results) };
}, ["creator-city-daily-skills-v1"], { revalidate: 86400 });

export async function GET() {
  try {
    return NextResponse.json(await getDailySkills());
  } catch (error) {
    return NextResponse.json({ ok: false, data: [], error: error instanceof Error ? error.message : "Skill 数据连接失败" }, { status: 502 });
  }
}
