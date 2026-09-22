import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`模型目录暂不可用（${response.status}）`);
    const payload = await response.json();
    if (!Array.isArray(payload.data) || !payload.data.length) throw new Error("模型目录返回为空");
    const data = payload.data.filter((m: { id?: string }) => typeof m.id === "string").map((m: {
      id: string; name?: string; description?: string; created?: number; context_length?: number;
      pricing?: { prompt?: string; completion?: string };
      supported_parameters?: string[]; architecture?: { input_modalities?: string[] };
    }) => {
      const price = (value?: string) => value !== undefined && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) * 1000000 : null;
      return { id: m.id, name: m.name || m.id, org: m.id.split("/")[0], description: m.description || "",
        created: m.created || 0, context: m.context_length || 0, input: price(m.pricing?.prompt), output: price(m.pricing?.completion),
        tools: m.supported_parameters?.includes("tools") || false, reasoning: m.supported_parameters?.includes("reasoning") || false,
        modalities: m.architecture?.input_modalities || [], sourceUrl: `https://openrouter.ai/${m.id}` };
    }).sort((a: { created: number }, b: { created: number }) => b.created - a.created);
    return NextResponse.json({ ok: true, data, source: "OpenRouter 实时目录", fetchedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, data: [], error: error instanceof Error ? error.message : "模型目录连接失败" }, { status: 502 });
  }
}
