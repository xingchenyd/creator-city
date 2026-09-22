from __future__ import annotations

import asyncio
import copy
from difflib import SequenceMatcher
import json
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from server.profile_adapter import profile_to_roundtable_persona
from server.roundtable_core.ai_provider import PixelAIProvider
from server.roundtable_core.ai_validation import validate_provider_result
from server.roundtable_core.config import Settings
from server.roundtable_core.errors import APIError

HOST = "127.0.0.1"
PORT = 8811
MAX_BODY_BYTES = 2_000_000
VALIDATION_RETRY_ATTEMPTS = 2
CONTROL_TEXT_FRAGMENTS = ("请继续围绕议题自然交流", "继续圆桌讨论")
NARRATION_PATTERNS = (
    re.compile(r"^[^，。！？\n]{1,24}(?:对着|看着|转向|冲着|朝着)[^，。！？\n]{1,24}(?:说|讲|问|回应|表示)\s*[：:]"),
    re.compile(r"^[^，。！？\n]{1,24}(?:说道|讲道|问道|回应道)\s*[：:]"),
)


class DialogueQualityError(Exception):
    def __init__(self, message: str, rejected_texts: list[str]) -> None:
        super().__init__(message)
        self.message = message
        self.rejected_texts = rejected_texts


class ProfileAwareProvider(PixelAIProvider):
    def _load_personas(self) -> dict[str, dict[str, Any]]:
        path = ROOT / "shared" / "domain" / "ExpertPersonas.json"
        values = json.loads(path.read_text(encoding="utf-8"))
        return {value["id"]: value for value in values}

    def register_profiles(self, profiles: list[dict[str, Any]]) -> None:
        for profile in profiles:
            persona = profile_to_roundtable_persona(profile)
            self._personas[persona["id"]] = persona


async def generate_roundtable(payload: dict[str, Any]) -> dict[str, Any]:
    request_payload = payload.get("request")
    profiles = payload.get("profiles") or []
    if not isinstance(request_payload, dict):
        raise ValueError("缺少 Roundtable request。")
    if not isinstance(profiles, list):
        raise ValueError("profiles 必须是数组。")

    request_payload = copy.deepcopy(request_payload)
    provider = ProfileAwareProvider(Settings())
    provider.register_profiles(profiles)
    last_error: APIError | None = None
    for attempt in range(VALIDATION_RETRY_ATTEMPTS):
        try:
            result = await provider.roundtable_reply(request_payload)
            _normalize_bridge_metadata(result.result, request_payload)
            _validate_dialogue_quality(result.result, request_payload)
            validated = validate_provider_result(
                "roundtable_reply",
                request_payload,
                result,
                allowed_persona_ids=provider.allowed_persona_ids,
            )
            return {
                "result": validated.result,
                "model": validated.model,
                "provider": validated.provider,
            }
        except DialogueQualityError as error:
            print(
                "[agent-chat-api] roundtable validation failed "
                f"type=dialogue_quality attempt={attempt + 1}/{VALIDATION_RETRY_ATTEMPTS} "
                f"reason={error.message}",
                flush=True,
            )
            last_error = APIError(502, "upstream_response_invalid", error.message)
            _add_quality_retry_feedback(request_payload, error)
            if attempt + 1 < VALIDATION_RETRY_ATTEMPTS:
                await asyncio.sleep(0.25 * (attempt + 1))
        except APIError as error:
            if error.code != "upstream_response_invalid":
                raise
            print(
                "[agent-chat-api] roundtable validation failed "
                f"type=provider_result attempt={attempt + 1}/{VALIDATION_RETRY_ATTEMPTS} "
                f"reason={error.message}",
                flush=True,
            )
            last_error = error
            if attempt + 1 < VALIDATION_RETRY_ATTEMPTS:
                await asyncio.sleep(0.25 * (attempt + 1))
    if last_error:
        raise last_error
    raise APIError(502, "upstream_response_invalid", "上游 AI 返回的业务结构不符合要求。")


def _validate_dialogue_quality(result: dict[str, Any], request_payload: dict[str, Any]) -> None:
    turns = result.get("turns")
    requested_turns = request_payload.get("requested_turns")
    if not isinstance(turns, list) or not isinstance(requested_turns, list):
        return

    history_by_speaker: dict[str, list[str]] = {}
    history_entries: list[tuple[str, str]] = []
    for item in request_payload.get("conversation_history") or []:
        if not isinstance(item, dict) or item.get("role") != "expert":
            continue
        speaker_id = str(item.get("expert_id") or "").strip()
        content = str(item.get("content") or "").strip()
        if speaker_id and content:
            history_by_speaker.setdefault(speaker_id, []).append(content)
            history_entries.append((speaker_id, content))

    for requested, turn in zip(requested_turns, turns, strict=False):
        if not isinstance(requested, dict) or not isinstance(turn, dict):
            continue
        text = str(turn.get("text") or "").strip()
        if not text:
            continue
        speaker_id = str(requested.get("expert_id") or "").strip()
        speaker_name = str(requested.get("expert_name") or "").strip()
        same_speaker_clause_length = 15 if request_payload.get("phase") == "rebuttal" else 12
        same_speaker_clause_similarity = 0.80 if request_payload.get("phase") == "rebuttal" else 0.70

        if any(fragment in text for fragment in CONTROL_TEXT_FRAGMENTS):
            raise DialogueQualityError("候选发言复述了后台续聊指令。", [text])
        if speaker_name and re.match(rf"^{re.escape(speaker_name)}\s*[：:]", text):
            raise DialogueQualityError("候选发言包含多余的说话人姓名标签。", [text])
        if any(pattern.search(text) for pattern in NARRATION_PATTERNS):
            raise DialogueQualityError("候选发言使用了第三人称旁白，而不是角色直接发言。", [text])

        comparison = _comparison_text(text)
        if not comparison:
            continue
        for previous in history_by_speaker.get(speaker_id, []):
            previous_comparison = _comparison_text(previous)
            if not previous_comparison:
                continue
            if comparison == previous_comparison:
                raise DialogueQualityError("候选发言与该角色的历史发言完全重复。", [text, previous])
            if (
                min(len(comparison), len(previous_comparison)) >= 24
                and SequenceMatcher(None, comparison, previous_comparison).ratio() >= 0.90
            ):
                raise DialogueQualityError("候选发言与该角色的历史发言高度近似，没有推进讨论。", [text, previous])
            if _repeats_substantial_clause(
                text,
                previous,
                min_clause_length=same_speaker_clause_length,
                similarity_ratio=same_speaker_clause_similarity,
            ):
                raise DialogueQualityError("候选发言复用了该角色已经说过的关键句或论证骨架。", [text, previous])

        for previous_speaker_id, previous in history_entries:
            if previous_speaker_id == speaker_id:
                continue
            previous_comparison = _comparison_text(previous)
            if not previous_comparison:
                continue
            if comparison == previous_comparison:
                raise DialogueQualityError("候选发言完整复述了另一位角色的历史发言。", [text, previous])
            if (
                min(len(comparison), len(previous_comparison)) >= 24
                and SequenceMatcher(None, comparison, previous_comparison).ratio() >= 0.93
            ):
                raise DialogueQualityError("候选发言与另一位角色的历史发言高度近似。", [text, previous])
            if (
                request_payload.get("phase") == "stance"
                and _repeats_substantial_clause(text, previous, min_clause_length=16, similarity_ratio=0.82)
            ):
                raise DialogueQualityError("候选开场复用了另一位角色已经说过的关键句。", [text, previous])


def _comparison_text(value: str) -> str:
    value = re.sub(r"^[^，,:：]{1,12}[，,:：]", "", value.strip())
    value = re.sub(
        r"^(?:按|根据|结合)[^，,]{0,36}(?:个人问卷|本人提供|自述|经历|判断标准)[，,]",
        "",
        value,
    )
    return re.sub(r"[^0-9A-Za-z\u4e00-\u9fff]+", "", value).casefold()


def _repeats_substantial_clause(
    current: str,
    previous: str,
    *,
    min_clause_length: int = 12,
    similarity_ratio: float = 0.70,
) -> bool:
    current_text = _comparison_text(current)
    previous_text = _comparison_text(previous)
    if not current_text or not previous_text:
        return False
    current_clauses = {
        _comparison_text(value)
        for value in re.split(r"[，。！？；,:：]+", current)
        if len(_comparison_text(value)) >= 8
    }
    previous_clauses = {
        _comparison_text(value)
        for value in re.split(r"[，。！？；,:：]+", previous)
        if len(_comparison_text(value)) >= 8
    }
    for current_clause in current_clauses:
        for previous_clause in previous_clauses:
            matcher = SequenceMatcher(None, current_clause, previous_clause)
            longest = matcher.find_longest_match().size
            if len(current_clause) >= min_clause_length and current_clause == previous_clause and (
                len(current_clause) / max(1, min(len(current_text), len(previous_text))) >= 0.2
            ):
                return True
            if (
                longest >= min_clause_length
                and longest / max(1, min(len(current_clause), len(previous_clause))) >= similarity_ratio
            ):
                return True
    return False


def _add_quality_retry_feedback(
    request_payload: dict[str, Any],
    error: DialogueQualityError,
) -> None:
    rejected = "；".join(" ".join(text.split())[:120] for text in error.rejected_texts[:2])
    feedback = f"上一次候选因‘{error.message}’被拒绝。必须换一个新的论证角度，禁止复用这些表达：{rejected}"
    for requested in request_payload.get("requested_turns") or []:
        if not isinstance(requested, dict):
            continue
        current = str(requested.get("debate_role") or "").strip()
        requested["debate_role"] = f"{current} {feedback}".strip()


async def generate_discussion_verdict(payload: dict[str, Any]) -> dict[str, Any]:
    topic = str(payload.get("topic") or "").strip()
    agents = payload.get("agents")
    messages = payload.get("messages")
    if not topic:
        raise ValueError("缺少讨论议题。")
    if not isinstance(agents, list) or not 2 <= len(agents) <= 6:
        raise ValueError("参与者数量必须为 2–6 位。")
    if not isinstance(messages, list) or not messages:
        raise ValueError("缺少讨论记录。")

    normalized_agents: list[dict[str, str]] = []
    allowed_ids: set[str] = set()
    for raw in agents:
        if not isinstance(raw, dict):
            raise ValueError("参与者资料格式不正确。")
        agent_id = str(raw.get("id") or "").strip()
        name = str(raw.get("name") or "").strip()
        role = str(raw.get("role") or "Agent").strip()
        if not agent_id or not name or agent_id in allowed_ids:
            raise ValueError("参与者资料不完整。")
        allowed_ids.add(agent_id)
        normalized_agents.append({"id": agent_id, "name": name, "role": role})

    history_lines: list[str] = []
    for raw in messages[-60:]:
        if not isinstance(raw, dict):
            continue
        text = " ".join(str(raw.get("text") or "").split())
        if not text:
            continue
        speaker_id = str(raw.get("speakerId") or "")
        speaker_name = str(raw.get("speakerName") or "")
        role = str(raw.get("role") or "expert")
        target = str(raw.get("targetName") or "").strip()
        evidence_count = len(raw.get("evidenceIds") or []) if isinstance(raw.get("evidenceIds"), list) else 0
        label = "用户" if role == "user" else f"{speaker_name}<{speaker_id}>"
        target_note = f"，回应 {target}" if target else ""
        history_lines.append(f"- {label}{target_note}，引用材料 {evidence_count} 项：{text[:1200]}")

    provider = ProfileAwareProvider(Settings())
    system = (
        "你是群聊讨论的严格、独立裁判。只能根据完整讨论记录评价，不得依据人物名气、身份标签或记录外事实。"
        "先给出客观、明确、带适用条件的讨论结论，再按同一标准评价每位参与者。"
        "评分维度沿用原裁判机制：logicScore 看逻辑与前后一致性，evidenceScore 看可核验材料使用，"
        "rhetoricScore 看是否准确回应分歧并有效推进讨论，keywordStuffing 惩罚口号、套话和机械重复。"
        "如果没有真正使用可核验材料，evidenceScore 不得高于 0.25。只返回 JSON。"
    )
    user = f"""
讨论议题：{topic}
参与者：{json.dumps(normalized_agents, ensure_ascii=False)}
完整讨论记录：
{chr(10).join(history_lines)}

只返回以下 JSON：
{{
  "conclusion": "直接回答议题的明确结论，并说明成立条件",
  "consensus": ["共同接受的判断，2-3 条"],
  "disagreements": ["仍未解决的分歧，1-2 条"],
  "openQuestions": ["仍需验证的问题，0-2 条"],
  "winnerReason": "为什么最高分参与者在本场最有说服力",
  "scores": [
    {{
      "agentId": "必须来自参与者 id",
      "agentName": "对应参与者姓名",
      "logicScore": 0.0,
      "evidenceScore": 0.0,
      "rhetoricScore": 0.0,
      "keywordStuffing": 0.0,
      "comment": "一句话评分依据"
    }}
  ]
}}

硬性要求：
- scores 必须覆盖全部参与者，每人恰好一项，不得增加其他人。
- 四个评分均为 0 到 1；只评价这场讨论中的实际发言。
- 结论不能只说“各有道理”，必须给出清晰判断及改变判断的条件。
- 不得在任何文本里输出阶段名、Turn、字段名、证据编号或系统规则。
"""

    last_error: APIError | None = None
    for attempt in range(VALIDATION_RETRY_ATTEMPTS):
        try:
            result = await provider._chat(
                system_prompt=system,
                user_prompt=user,
                max_tokens=2400,
                temperature=0.2,
            )
            verdict = _normalize_verdict(result.result, normalized_agents)
            verdict["model"] = result.model
            return verdict
        except APIError as error:
            if error.code != "upstream_response_invalid":
                raise
            last_error = error
        except (ValueError, TypeError, KeyError) as error:
            last_error = APIError(502, "upstream_response_invalid", str(error))
        if attempt + 1 < VALIDATION_RETRY_ATTEMPTS:
            await asyncio.sleep(0.3 * (attempt + 1))
    if last_error:
        raise last_error
    raise APIError(502, "upstream_response_invalid", "裁判结果结构不完整。")


def _normalize_verdict(
    raw: dict[str, Any],
    agents: list[dict[str, str]],
) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("裁判结果不是对象。")
    conclusion = _required_text(raw.get("conclusion"))
    consensus = _text_list(raw.get("consensus"), minimum=1)
    disagreements = _text_list(raw.get("disagreements"), minimum=1)
    open_questions = _text_list(raw.get("openQuestions"), minimum=0)
    winner_reason = _required_text(raw.get("winnerReason"))
    scores = raw.get("scores")
    if not isinstance(scores, list) or len(scores) != len(agents):
        raise ValueError("裁判评分没有覆盖全部参与者。")

    agent_by_id = {agent["id"]: agent for agent in agents}
    normalized_scores: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in scores:
        if not isinstance(item, dict):
            raise ValueError("裁判评分项格式不正确。")
        agent_id = _required_text(item.get("agentId"))
        if agent_id not in agent_by_id or agent_id in seen:
            raise ValueError("裁判评分引用了错误的参与者。")
        seen.add(agent_id)
        logic = _score(item.get("logicScore"))
        evidence = _score(item.get("evidenceScore"))
        rhetoric = _score(item.get("rhetoricScore"))
        stuffing = _score(item.get("keywordStuffing"))
        overall = max(0.0, min(1.0, logic * 0.4 + evidence * 0.35 + rhetoric * 0.25 - stuffing * 0.42))
        normalized_scores.append({
            "agentId": agent_id,
            "agentName": agent_by_id[agent_id]["name"],
            "logicScore": round(logic, 4),
            "evidenceScore": round(evidence, 4),
            "rhetoricScore": round(rhetoric, 4),
            "keywordStuffing": round(stuffing, 4),
            "overallScore": round(overall, 4),
            "comment": _required_text(item.get("comment")),
        })
    normalized_scores.sort(key=lambda item: item["overallScore"], reverse=True)
    winner = normalized_scores[0]
    return {
        "conclusion": conclusion,
        "consensus": consensus[:3],
        "disagreements": disagreements[:2],
        "openQuestions": open_questions[:2],
        "winnerAgentId": winner["agentId"],
        "winnerAgentName": winner["agentName"],
        "winnerReason": winner_reason,
        "scores": normalized_scores,
    }


def _required_text(value: Any) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError("裁判结果缺少必要文字。")
    return value.strip()


def _text_list(value: Any, *, minimum: int) -> list[str]:
    if not isinstance(value, list):
        raise ValueError("裁判结果列表格式不正确。")
    result = [item.strip() for item in value if isinstance(item, str) and item.strip()]
    if len(result) < minimum:
        raise ValueError("裁判结果列表内容不足。")
    return result


def _score(value: Any) -> float:
    if isinstance(value, bool) or not isinstance(value, int | float):
        raise ValueError("裁判评分不是数字。")
    return max(0.0, min(1.0, float(value)))


def _normalize_bridge_metadata(
    result: dict[str, Any],
    request_payload: dict[str, Any],
) -> None:
    """Canonicalize metadata that the request already determines exactly.

    Roundtable's original JSON example always shows userImpact, while its original
    validator correctly forbids that metadata when latest_user_turn is absent.
    The bridge resolves that transport ambiguity deterministically without changing
    the original prompt, stance ledger, grounding rules, or validator. Display names
    are also request-owned identity metadata; expert IDs remain strictly model-output
    fields checked by the original validator.
    """
    turns = result.get("turns")
    if not isinstance(turns, list):
        return
    requested_turns = request_payload.get("requested_turns")
    if isinstance(requested_turns, list):
        for turn, requested in zip(turns, requested_turns, strict=False):
            if not isinstance(turn, dict) or not isinstance(requested, dict):
                continue
            turn["expertName"] = requested.get("expert_name")
            if requested.get("required_target_name"):
                turn["targetExpertName"] = requested.get("required_target_name")
            elif not request_payload.get("latest_user_turn"):
                turn["targetExpertId"] = None
                turn["targetExpertName"] = None

    if request_payload.get("latest_user_turn"):
        return
    user_response_keys = (
        "respondedUserTurnId",
        "respondedUserQuote",
        "respondedUserClaim",
        "responseKind",
        "userImpact",
    )
    for turn in turns:
        if not isinstance(turn, dict):
            continue
        for key in user_response_keys:
            turn[key] = None


class Handler(BaseHTTPRequestHandler):
    server_version = "AgentChat/1.0"

    def do_GET(self) -> None:
        if self.path == "/api/health":
            settings = Settings()
            self._send(200, {
                "status": "ok",
                "service": "creator-council",
                "ai_configured": settings.ai_configured,
                "provider": settings.active_chat_provider,
                "model": settings.active_chat_model,
            })
            return
        self._send(404, {"error": {"message": "接口不存在。"}})

    def do_POST(self) -> None:
        if self.path not in {"/api/chat/reply", "/api/chat/discussion/verdict"}:
            self._send(404, {"error": {"message": "接口不存在。"}})
            return
        try:
            length = int(self.headers.get("Content-Length") or "0")
            if length <= 0 or length > MAX_BODY_BYTES:
                raise ValueError("请求为空或超过大小限制。")
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            if self.path == "/api/chat/discussion/verdict":
                result = asyncio.run(generate_discussion_verdict(payload))
            else:
                result = asyncio.run(generate_roundtable(payload))
            self._send(200, result)
        except APIError as error:
            self._send(error.status_code, {"error": {"code": error.code, "message": error.message}})
        except (ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
            self._send(422, {"error": {"code": "invalid_request", "message": str(error)}})
        except Exception as error:
            self._send(502, {"error": {"code": "roundtable_failed", "message": str(error)}})

    def log_message(self, format: str, *args: Any) -> None:
        # Never log request bodies or Profile Pack content.
        print(f"[agent-chat-api] {self.address_string()} {format % args}")

    def _send(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        try:
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            return


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Agent chat service listening on http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
