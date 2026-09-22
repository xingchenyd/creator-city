import { competitions } from "@/data/cityFacilities";

export async function GET() {
  return Response.json({
    ok: true,
    data: competitions.map((event) => ({
      ...event,
      status: event.status === "报名中" && event.deadlineAt && Date.parse(event.deadlineAt) <= Date.now() ? "报名已截止" : event.status,
    })),
    source: "官方链接人工核验快照 · 无网页爬取",
    fetchedAt: "2026-09-22T00:00:00Z",
    methodology: "仅保存主办方公开报名链接和人工核验字段；报名资格、奖金与截止时间以官方页面为准。",
  });
}
