"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw, Search, Star } from "lucide-react";

type Model = { id: string; name: string; org: string; description: string; created: number; context: number; input: number | null; output: number | null; tools: boolean; reasoning: boolean; modalities: string[]; sourceUrl: string };
type Skill = { name: string; description: string; url: string; stars: number; forks: number; updatedAt: string; topics: string[] };
function useCatalog<T>(endpoint: string, interval: number) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fetchedAt, setFetchedAt] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal });
      const result = await response.json();
      if (!response.ok || !result.ok || !Array.isArray(result.data)) throw new Error(result.error || "数据暂不可用");
      if (signal?.aborted) return;
      setData(result.data); setFetchedAt(result.fetchedAt); setError("");
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "连接失败");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [endpoint]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const timer = window.setInterval(() => { if (!document.hidden) void load(controller.signal); }, interval);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [interval, load]);
  return { data, loading, error, fetchedAt, load };
}
const date = (v: string) => v ? new Date(v).toLocaleString("zh-CN") : "尚未同步";
const price = (v: number | null) => v === null ? "未提供" : v === 0 ? "免费" : "$" + v.toLocaleString("en-US", { maximumFractionDigits: 4 });
export function LiveModels() {
  const { data, loading, error, fetchedAt, load } = useCatalog<Model>("/api/models", 300000);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [feature, setFeature] = useState("all");
  const filtered = useMemo(() => data.filter(m => (m.name + " " + m.id).toLowerCase().includes(query.toLowerCase()) && (feature === "all" || (feature === "tools" ? m.tools : feature === "reasoning" ? m.reasoning : m.modalities.includes("image")))).sort((a,b) => sort === "price" ? (a.input ?? Infinity) - (b.input ?? Infinity) : sort === "context" ? b.context - a.context : b.created - a.created), [data, query, sort, feature]);
  return <div className="city-live-catalog">
    <div className="city-event-filters"><label><Search size={16}/><input aria-label="搜索模型" placeholder="搜索模型名称或厂商" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <select aria-label="模型排序" value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">最新上架</option><option value="price">输入价格最低</option><option value="context">上下文最长</option></select>
    <select aria-label="模型能力筛选" value={feature} onChange={e=>setFeature(e.target.value)}><option value="all">全部能力</option><option value="tools">工具调用</option><option value="reasoning">推理参数</option><option value="image">图像输入</option></select>
    <button className="city-bench-icon-button" disabled={loading} onClick={()=>void load()}><RefreshCw size={16}/>{loading ? "同步中" : "实时刷新"}</button></div>
    <p className="city-bench-source">OpenRouter · {data.length} 个模型 · 同步于 {date(fetchedAt)} · 每 5 分钟刷新</p>
    <p className="city-bench-notice">默认按目录上架时间排序。能力标签表示接口支持，不代表评测分数；价格单位 USD / 百万 tokens。</p>
    {error && <p role="alert" className="city-bench-notice">{error}{data.length ? "，保留上次成功结果。" : "，请点击刷新重试。"}</p>}
    <div className="city-model-table-wrap"><table><thead><tr><th>模型 / 厂商</th><th>上架时间</th><th>支持能力</th><th>输入价格</th><th>输出价格</th><th>上下文</th></tr></thead><tbody>{filtered.map(m=><tr key={m.id}><td><a href={m.sourceUrl} target="_blank" rel="noreferrer"><b>{m.name}</b><small>{m.id} ↗</small></a></td><td>{m.created ? new Date(m.created*1000).toLocaleDateString("zh-CN") : "未提供"}</td><td>{[m.tools && "工具",m.reasoning && "推理",m.modalities.includes("image") && "图像"].filter(Boolean).join(" · ") || "文本"}</td><td>{price(m.input)}</td><td>{price(m.output)}</td><td>{m.context.toLocaleString()}</td></tr>)}</tbody></table></div>
    {!loading && !filtered.length && <p className="city-empty-state">没有符合条件的模型。</p>}
  </div>;
}
export function LiveSkills() {
  const { data, loading, error, fetchedAt, load } = useCatalog<Skill>("/api/skills", 3600000);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("stars");
  const filtered = useMemo(()=>data.filter(s=>(s.name+" "+s.description+" "+s.topics.join(" ")).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>sort==="updated" ? Date.parse(b.updatedAt)-Date.parse(a.updatedAt) : b.stars-a.stars),[data,query,sort]);
  return <div className="city-live-catalog"><div className="city-event-filters"><label><Search size={16}/><input aria-label="搜索 Skill" placeholder="搜索 Skill 仓库或用途" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Skill 排序" value={sort} onChange={e=>setSort(e.target.value)}><option value="stars">Star 最多</option><option value="updated">最近提交</option></select><button className="city-bench-icon-button" disabled={loading} onClick={()=>void load()}><RefreshCw size={16}/>{loading?"同步中":"刷新列表"}</button></div>
    <p className="city-bench-source">GitHub 官方 API · agent-skills 主题前 100 个仓库 · 每日更新 · 数据时间 {date(fetchedAt)}</p>
    <p className="city-bench-notice">按累计 Star 排序，非每日新增 Star；最近提交在此热门仓库集合内排序。安装方法以仓库 README 为准。</p>
    {error && <p role="alert" className="city-bench-notice">{error}{data.length ? "，保留上次成功结果。" : "，请稍后刷新。"}</p>}
    <section className="city-skills-grid">{filtered.map((s,i)=><article key={s.name}><header><span>SKILL / {i+1}</span><span><Star size={14}/> {s.stars.toLocaleString()}</span></header><h3>{s.name}</h3><p>{s.description}</p><div>{s.topics.slice(0,4).map(t=><b key={t}>{t}</b>)}</div><p>最近提交 {new Date(s.updatedAt).toLocaleDateString("zh-CN")} · Fork {s.forks.toLocaleString()}</p><footer><a href={s.url} target="_blank" rel="noreferrer">查看 Skill 与安装说明 <ExternalLink size={15}/></a></footer></article>)}</section>
    {!loading && !filtered.length && <p className="city-empty-state">没有符合条件的 Skill。</p>}
  </div>;
}
