"""
就诊前信息整理 Agent 后端：对话 + 结构化报告合成 + 简易记忆 + PDF 文本提取。
新增：SQLite 会话历史 + 科室推荐。
不提供诊断，仅整理用户自述信息。
"""
from __future__ import annotations

import asyncio
import io
import json
import re
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import date, datetime
from pathlib import Path
from urllib.parse import urlparse
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings
from pypdf import PdfReader

load_dotenv()


class Settings(BaseSettings):
    openai_api_key: str = Field(default="", validation_alias="OPENAI_API_KEY")
    openai_base_url: str = Field(
        default="https://api.openai.com/v1", validation_alias="OPENAI_BASE_URL"
    )
    openai_model: str = Field(default="gpt-4o-mini", validation_alias="OPENAI_MODEL")

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
MEMORY_DIR = DATA_DIR / "memory"
DATA_DIR.mkdir(exist_ok=True)
MEMORY_DIR.mkdir(exist_ok=True)

# ─── SQLite 会话历史 ────────────────────────────────────────────────────────
DB_PATH = DATA_DIR / "sessions.db"


def _init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id          TEXT PRIMARY KEY,
                title       TEXT NOT NULL DEFAULT '新问诊',
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL,
                messages    TEXT NOT NULL DEFAULT '[]',
                form_hints  TEXT NOT NULL DEFAULT '[]',
                report      TEXT
            )
        """)
        conn.commit()


_init_db()


@contextmanager
def _db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


# ─── Emergency & System Prompts ─────────────────────────────────────────────
EMERGENCY_PATTERNS = re.compile(
    r"(呼吸困难|喘不上气|意识不清|昏迷|大出血|咯血不止|胸痛剧烈|心梗|卒中|抽搐不止|严重过敏.*窒息)",
    re.IGNORECASE,
)

SYSTEM_CHAT = """你是「就诊前信息整理助手」，只做事实整理与追问，不做医学诊断和治疗建议。
规则：
1. 用简短、温和的口语中文回复（若用户使用英文则用英文）。
2. 依次澄清：症状与部位、起病时间与演变、诱因、伴随症状、已采取的处理、当前用药、过敏史、慢性病史、妊娠哺乳等特殊状态。
3. 绝不输出疾病名称诊断、处方或停药建议。可提示用户哪些问题可以留给医生问诊时确认。
4. 若用户信息不足，优先追问最关键缺失项，每次最多追问 2 点。
"""

SYNTHESIS_SYSTEM = """将对话中的「用户自述」整理为结构化 JSON，便于就诊前备忘。严禁诊断与治疗建议。
必须输出单个 JSON 对象（不要 Markdown），字段：
{
  "basic_info": {"patient_name_masked":"","gender":"","age":"","visit_date":""},
  "timeline_events":[{"id":"","day":"","date":"","description":"","severity":"low|medium|high"}],
  "medications":[{"id":"","name":"","frequency":"","duration":"","type":"prescription|otc"}],
  "allergies": [""],
  "questions":[{"id":"","question":"","reason":""}],
  "checklist":[{"id":"","item":"","required":true}],
  "department_recommendation": {"primary":"","secondary":"","reason":""}
}
要求：
- 若要点中含「[基本信息]」行（如 姓名 / 性别 / 年龄），填入 basic_info 对应字段；未出现则 basic_info 可留空字符串；
- timeline_events 按时间从早到晚排序；description 前缀注明「自述：」；
- allergies / medications 仅填用户明确提到的，未提到可为空数组；
- questions 给出 8-12 个「向医生求证」的问题，附带 reason；
- checklist 给中国门诊常识材料清单（身份证/医保卡、病历、化验单等），5-10 条，部分 required:false；
- visit_date 用今天日期字符串 YYYY-MM-DD（中国时区观感即可）；
- department_recommendation: primary 为最可能就诊科室（如「内科」「骨科」），secondary 为备选科室，reason 为推荐理由（1-2句）；若信息不足，primary填「综合内科/全科」。
"""

app = FastAPI(title="Medical Pre-consultation Agent API", redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Pydantic Models ─────────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str
    content: str


class ChatReq(BaseModel):
    messages: list[ChatMessage]
    session_id: str


class ChatResp(BaseModel):
    reply: str
    emergency_detected: bool = False
    demo_mode: bool = False


class SynthesizeReq(BaseModel):
    messages: list[ChatMessage]
    session_id: str
    form_hints: list[str] = []


class SessionSaveReq(BaseModel):
    session_id: str
    title: str = "新问诊"
    messages: list[dict[str, str]] = []
    form_hints: list[str] = []
    report: dict[str, Any] | None = None


class SessionInfo(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    has_report: bool


# ─── Session History CRUD ───────────────────────────────────────────────────
@app.get("/api/sessions")
async def list_sessions() -> list[dict[str, Any]]:
    """列出所有历史会话（按更新时间倒序）"""
    with _db() as conn:
        rows = conn.execute(
            "SELECT id, title, created_at, updated_at, report FROM sessions ORDER BY updated_at DESC LIMIT 100"
        ).fetchall()
    return [
        {
            "id": r["id"],
            "title": r["title"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
            "has_report": bool(r["report"]),
        }
        for r in rows
    ]


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str) -> dict[str, Any]:
    """获取单个会话的完整数据"""
    safe = re.sub(r"[^a-zA-Z0-9_-]", "", session_id) or "default"
    with _db() as conn:
        row = conn.execute(
            "SELECT * FROM sessions WHERE id = ?", (safe,)
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="会话不存在")
    return {
        "id": row["id"],
        "title": row["title"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "messages": json.loads(row["messages"] or "[]"),
        "form_hints": json.loads(row["form_hints"] or "[]"),
        "report": json.loads(row["report"]) if row["report"] else None,
    }


@app.post("/api/sessions")
@app.post("/api/sessions/")
async def save_session(req: SessionSaveReq) -> dict[str, str]:
    """创建或更新会话（upsert）"""
    safe = re.sub(r"[^a-zA-Z0-9_-]", "", req.session_id) or "default"
    now = _now()
    with _db() as conn:
        existing = conn.execute(
            "SELECT id, created_at FROM sessions WHERE id = ?", (safe,)
        ).fetchone()
        if existing:
            conn.execute(
                """UPDATE sessions SET title=?, updated_at=?, messages=?, form_hints=?, report=?
                   WHERE id=?""",
                (
                    req.title,
                    now,
                    json.dumps(req.messages, ensure_ascii=False),
                    json.dumps(req.form_hints, ensure_ascii=False),
                    json.dumps(req.report, ensure_ascii=False) if req.report else None,
                    safe,
                ),
            )
        else:
            conn.execute(
                """INSERT INTO sessions (id, title, created_at, updated_at, messages, form_hints, report)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    safe,
                    req.title,
                    now,
                    now,
                    json.dumps(req.messages, ensure_ascii=False),
                    json.dumps(req.form_hints, ensure_ascii=False),
                    json.dumps(req.report, ensure_ascii=False) if req.report else None,
                ),
            )
    return {"status": "ok", "session_id": safe}


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str) -> dict[str, str]:
    """删除指定会话"""
    safe = re.sub(r"[^a-zA-Z0-9_-]", "", session_id) or "default"
    with _db() as conn:
        conn.execute("DELETE FROM sessions WHERE id = ?", (safe,))
    # 同时删除 memory 文件
    mem_path = _memory_path(safe)
    if mem_path.exists():
        mem_path.unlink(missing_ok=True)
    return {"status": "ok"}


# ─── Memory ──────────────────────────────────────────────────────────────────
EMERGENCY_REPLY_ZH = (
    "检测到可能存在危急症状描述。**请立即停止自助整理，拨打当地急救电话或前往最近急诊**。"
    "本助手不能处理紧急情况。"
)


def prepare_chat_messages(req: ChatReq) -> tuple[bool, list[dict[str, str]]]:
    """返回 (是否危急, 非危急时的 messages 载荷)。危急时第二项为空列表。"""
    last_user = next(
        (m.content for m in reversed(req.messages) if m.role == "user"),
        "",
    )
    if last_user and EMERGENCY_PATTERNS.search(last_user):
        return True, []

    mem = load_memory(req.session_id)
    mem_txt = memory_summary_block(mem)
    payload_messages: list[dict[str, str]] = [
        {"role": "system", "content": SYSTEM_CHAT},
    ]
    if mem_txt:
        payload_messages.append(
            {"role": "system", "content": "以下为该用户历史摘要（仅供参考）：\n" + mem_txt}
        )
    payload_messages.extend(
        {"role": m.role, "content": m.content} for m in req.messages if m.content.strip()
    )
    return False, payload_messages


def _memory_path(session_id: str) -> Path:
    safe = re.sub(r"[^a-zA-Z0-9_-]", "", session_id) or "default"
    return MEMORY_DIR / f"{safe}.json"


def load_memory(session_id: str) -> dict[str, Any]:
    p = _memory_path(session_id)
    if not p.is_file():
        return {"allergies": [], "medications": [], "notes": ""}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"allergies": [], "medications": [], "notes": ""}


def save_memory(session_id: str, data: dict[str, Any]) -> None:
    p = _memory_path(session_id)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def memory_summary_block(mem: dict[str, Any]) -> str:
    parts = []
    if mem.get("allergies"):
        parts.append("已知过敏：" + "、".join(mem["allergies"]))
    if mem.get("medications"):
        parts.append("曾记录用药：" + "、".join(mem["medications"]))
    if mem.get("notes"):
        parts.append("备注：" + str(mem["notes"]))
    return "\n".join(parts) if parts else ""


# ─── LLM Helpers ─────────────────────────────────────────────────────────────
def build_chat_completions_url(base_url: str) -> str:
    b = (base_url or "").strip().rstrip("/")
    if not b:
        b = "https://api.openai.com/v1"
    if b.endswith("/chat/completions"):
        return b
    host = (urlparse(b).netloc or "").lower()
    if host.endswith("deepseek.com"):
        base_root = b[: -len("/v1")] if b.endswith("/v1") else b
        return f"{base_root.rstrip('/')}/chat/completions"
    if not b.endswith("/v1"):
        b = f"{b}/v1"
    return f"{b}/chat/completions"


async def openai_chat(
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.4,
    response_format_json: bool = False,
) -> str:
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY missing")
    url = build_chat_completions_url(settings.openai_base_url)
    body: dict[str, Any] = {
        "model": settings.openai_model,
        "messages": messages,
        "temperature": temperature,
    }
    if response_format_json:
        body["response_format"] = {"type": "json_object"}
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
                "Content-Type": "application/json",
            },
            json=body,
        )
        if r.status_code >= 400:
            snippet = (r.text or "")[:800]
            if r.status_code == 405:
                raise HTTPException(
                    status_code=502,
                    detail=(
                        "大模型网关返回 405：请求地址可能不对。"
                        "OpenAI 类服务 Base 需以 /v1 结尾；DeepSeek 请用 https://api.deepseek.com（无 /v1），"
                        "参见 https://api-docs.deepseek.com/zh-cn/ 。"
                        f" 实际请求: POST {url} 。网关原文: {snippet}"
                    ),
                )
            raise HTTPException(
                status_code=502,
                detail=f"大模型接口 HTTP {r.status_code}：{snippet}",
            )
        data = r.json()
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as e:
            raise HTTPException(status_code=502, detail=f"Bad LLM payload: {e}") from e


async def openai_chat_stream_tokens(
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.5,
) -> Any:
    """从 OpenAI 兼容接口的流式 chat completions 中逐段产出文本。"""
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY missing")
    url = build_chat_completions_url(settings.openai_base_url)
    body: dict[str, Any] = {
        "model": settings.openai_model,
        "messages": messages,
        "temperature": temperature,
        "stream": True,
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "POST",
            url,
            headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
                "Content-Type": "application/json",
            },
            json=body,
        ) as r:
            if r.status_code >= 400:
                err_text = (await r.aread()).decode("utf-8", errors="replace")[:1200]
                if r.status_code == 405:
                    raise HTTPException(
                        status_code=502,
                        detail=(
                            "大模型网关返回 405：请求地址可能不对。"
                            "OpenAI 类服务 Base 需以 /v1 结尾；DeepSeek 请用 https://api.deepseek.com（无 /v1），"
                            "参见 https://api-docs.deepseek.com/zh-cn/ 。"
                            f" 实际请求: POST {url} 。网关原文: {err_text}"
                        ),
                    )
                raise HTTPException(
                    status_code=502,
                    detail=f"大模型接口 HTTP {r.status_code}：{err_text}",
                )
            async for raw_line in r.aiter_lines():
                line = (raw_line or "").strip()
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                    choice0 = (chunk.get("choices") or [{}])[0]
                    delta = choice0.get("delta") or {}
                    piece = delta.get("content") or ""
                    if piece:
                        yield piece
                except (json.JSONDecodeError, IndexError, TypeError):
                    continue


async def _simulate_stream_text(text: str) -> Any:
    """离线模式分块输出，前端可流式展示。"""
    if not text:
        return
    n = len(text)
    step = max(2, min(8, n // 10 or 3))
    for i in range(0, n, step):
        yield text[i : i + step]
        await asyncio.sleep(0.02)


def _streaming_resolve_error(exc: BaseException) -> str:
    if isinstance(exc, HTTPException):
        return str(exc.detail)
    return str(exc)


def _fallback_chat_reply(messages: list[ChatMessage]) -> str:
    n_user = sum(1 for m in messages if m.role == "user")
    replies = [
        "了解。为方便整理就诊材料，这个症状大约从什么时候开始的？有没有逐渐加重或缓解？",
        "疼痛或不适的程度大概 1-10 分打几分？是持续的还是一阵一阵的？",
        "最近有没有用过什么药（包括非处方药/Vitamins）？",
        "有没有药物或食物过敏史？既往有哪些慢性病需要在看病时一并说明？",
        "请先点击右侧上方「刷新报告」或说一声「刷新报告」，我会把目前对话整理成时间线与问题清单。",
    ]
    idx = min(max(n_user - 1, 0), len(replies) - 1)
    return replies[idx]


def _today_str() -> str:
    return date.today().strftime("%Y-%m-%d")


_FORM_HINT_RE = re.compile(r"^\[([^\]]+)\]\s*(.+)\s*$")


def _parse_form_hints(form_hints: list[str]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[str]]:
    """从左侧「快速选择」产生的 `[步骤名] 内容` 解析结构化片段（离线/兜底用）。"""
    events: list[dict[str, Any]] = []
    medications: list[dict[str, Any]] = []
    allergies: list[str] = []
    med_ord = 0

    for raw in form_hints:
        line = (raw or "").strip()
        if not line.startswith("["):
            continue
        m = _FORM_HINT_RE.match(line)
        if not m:
            continue
        label, text = m.group(1).strip(), m.group(2).strip()
        if not text:
            continue

        if label == "症状":
            events.append(
                {
                    "id": str(uuid.uuid4())[:8],
                    "day": "症状",
                    "date": _today_str(),
                    "description": f"自述：{text}",
                    "severity": "medium" if any(k in text for k in ("剧痛", "高热", "晕厥", "呼吸困难")) else "low",
                }
            )
        elif label == "时间线":
            events.append(
                {
                    "id": str(uuid.uuid4())[:8],
                    "day": "起病/演变",
                    "date": _today_str(),
                    "description": f"自述：{text}",
                    "severity": "low",
                }
            )
        elif label == "用药":
            if text in ("无", "无用药", "没有"):
                pass
            elif "处方" in text:
                med_ord += 1
                medications.append(
                    {
                        "id": f"m{med_ord}",
                        "name": "（有处方药，请补充具体药名与剂量）",
                        "frequency": "待补充",
                        "duration": "待补充",
                        "type": "prescription",
                    }
                )
            elif "非处方" in text or "OTC" in text.upper():
                med_ord += 1
                medications.append(
                    {
                        "id": f"m{med_ord}",
                        "name": "（非处方药，请补充药名）",
                        "frequency": "按包装/说明书",
                        "duration": "待补充",
                        "type": "otc",
                    }
                )
            else:
                med_ord += 1
                medications.append(
                    {
                        "id": f"m{med_ord}",
                        "name": text,
                        "frequency": "用户未说明",
                        "duration": "用户未说明",
                        "type": "otc",
                    }
                )
        elif label == "过敏":
            if "无过敏" in text or text == "无":
                allergies.append("无过敏史（自述，就诊时请再确认）")
            else:
                allergies.append(f"{text}（自述，待核实）")

    return events, medications, allergies


def _user_declined_meds(form_hints: list[str]) -> bool:
    for raw in form_hints:
        m = _FORM_HINT_RE.match((raw or "").strip())
        if m and m.group(1).strip() == "用药" and "无" in m.group(2):
            return True
    return False


def _basic_from_hints(form_hints: list[str]) -> dict[str, str]:
    name, gender, age = "—", "—", "—"
    for raw in form_hints:
        m = _FORM_HINT_RE.match((raw or "").strip())
        if not m or m.group(1).strip() != "基本信息":
            continue
        text = m.group(2)
        if mm := re.search(r"姓名[:：\s]*([^\s,，;；]+)", text):
            name = mm.group(1).strip() or name
        if mm := re.search(r"性别[:：\s]*([^\s,，;；]+)", text):
            gender = mm.group(1).strip() or gender
        if mm := re.search(r"年龄[:：\s]*([0-9]{1,3})\s*岁?", text):
            age = f"{mm.group(1).strip()}岁"
        elif mm := re.search(r"年龄[:：\s]*([0-9]{1,3})", text):
            age = f"{mm.group(1).strip()}岁"
    return {
        "patient_name_masked": name,
        "gender": gender,
        "age": age,
        "visit_date": _today_str(),
    }


def fallback_synthesize(
    transcript: str, form_hints: list[str], session_id: str
) -> dict[str, Any]:
    mem = load_memory(session_id)
    hint_txt = "\n".join(form_hints)
    blob = transcript + ("\n" + hint_txt if hint_txt else "")

    hint_events, hint_meds, hint_allergies = _parse_form_hints(form_hints)
    events: list[dict[str, Any]] = list(hint_events)

    if transcript.strip() and not events:
        events.append(
            {
                "id": str(uuid.uuid4())[:8],
                "day": "对话摘要",
                "date": _today_str(),
                "description": "自述：" + transcript.strip().replace("\n", " ")[:400],
                "severity": "low",
            }
        )
    elif transcript.strip() and events:
        events.append(
            {
                "id": str(uuid.uuid4())[:8],
                "day": "其他口述",
                "date": _today_str(),
                "description": "自述（对话摘录）：" + transcript.strip().replace("\n", " ")[:280],
                "severity": "low",
            }
        )

    meds_guess: list[dict[str, Any]] = list(hint_meds)
    if (
        not meds_guess
        and not _user_declined_meds(form_hints)
        and (
            "处方" in blob
            or re.search(r"(服药|吃药|用过药|正在吃|服用).{0,8}药", blob)
        )
    ):
        meds_guess.append(
            {
                "id": "m1",
                "name": "（请核对药名）",
                "frequency": "用户未说明",
                "duration": "用户未说明",
                "type": "otc",
            }
        )

    allergies = sorted({*(mem.get("allergies") or []), *hint_allergies})
    if "青霉素" in blob and not any("青霉素" in str(a) for a in allergies):
        allergies.append("青霉素（自述，待核实）")

    basic = _basic_from_hints(form_hints)

    qs = [
        {
            "id": "q1",
            "question": "这些症状最可能的原因是什么？需要做哪些检查来明确？",
            "reason": "帮助理解医生的诊断思路（非自我诊断）。",
        },
        {
            "id": "q2",
            "question": "当前用药是否与症状相关，是否需要调整？",
            "reason": "用药安全与依从性。",
        },
        {
            "id": "q3",
            "question": "如果出现哪些加重情况需要立即复诊或急诊？",
            "reason": "识别危险信号。",
        },
    ]
    checklist = [
        {"id": "c1", "item": "身份证或医保卡", "required": True},
        {"id": "c2", "item": "既往病历与处方（如有）", "required": True},
        {"id": "c3", "item": "近期化验/检查报告纸质或电子版", "required": True},
        {"id": "c4", "item": "正在服用药品包装盒或清单照片", "required": True},
        {"id": "c5", "item": "过敏史与慢性病史手写备忘", "required": False},
    ]
    return {
        "basic_info": basic,
        "timeline_events": events,
        "medications": meds_guess,
        "allergies": allergies,
        "questions": qs,
        "checklist": checklist,
        "department_recommendation": {
            "primary": "综合内科/全科",
            "secondary": "—",
            "reason": "（离线模式）信息不足，建议先挂全科门诊由医生分诊。",
        },
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "memory_note": (
            memory_summary_block(mem)
            if memory_summary_block(mem)
            else (
                "（离线模式）已根据对话与「快速选择」要点生成结构化条目；填写基本信息后可同步至右上报告。"
                if form_hints
                else "（离线模式）已根据对话生成占位条目，配置 API Key 后可获得更佳结构化结果。"
            )
        ),
    }


# ─── Routes ──────────────────────────────────────────────────────────────────
@app.get("/", response_model=None)
async def root():
    # Docker / 生产：static 由前端 build 放入；开发仅跑后端时无该文件，返回 JSON 便于确认服务
    built = BASE_DIR / "static" / "index.html"
    if built.is_file():
        return FileResponse(str(built))
    return {"service": "Medical Pre-consultation Agent API", "docs": "/docs", "api": "/api/chat"}


@app.post("/api/chat", response_model=ChatResp)
@app.post("/api/chat/", response_model=ChatResp)
async def chat(req: ChatReq) -> ChatResp:
    emergency, payload_messages = prepare_chat_messages(req)
    if emergency:
        return ChatResp(reply=EMERGENCY_REPLY_ZH, emergency_detected=True)

    if settings.openai_api_key:
        try:
            txt = await openai_chat(payload_messages, temperature=0.5)
            return ChatResp(reply=txt.strip(), emergency_detected=False, demo_mode=False)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    return ChatResp(
        reply=_fallback_chat_reply(req.messages),
        emergency_detected=False,
        demo_mode=True,
    )


def _ndjson_line(obj: dict[str, Any]) -> bytes:
    return (json.dumps(obj, ensure_ascii=False) + "\n").encode("utf-8")


@app.post("/api/chat/stream")
@app.post("/api/chat/stream/")
async def chat_stream(req: ChatReq):
    async def ndjson_body():
        try:
            emergency, payload_messages = prepare_chat_messages(req)
            if emergency:
                yield _ndjson_line(
                    {"type": "meta", "emergency_detected": True, "demo_mode": False}
                )
                yield _ndjson_line({"type": "delta", "text": EMERGENCY_REPLY_ZH})
                yield _ndjson_line({"type": "done"})
                return

            if settings.openai_api_key:
                yield _ndjson_line(
                    {"type": "meta", "emergency_detected": False, "demo_mode": False}
                )
                try:
                    async for piece in openai_chat_stream_tokens(
                        payload_messages, temperature=0.5
                    ):
                        yield _ndjson_line({"type": "delta", "text": piece})
                except (HTTPException, Exception) as exc:
                    yield _ndjson_line(
                        {"type": "delta", "text": f"[错误] {_streaming_resolve_error(exc)}"}
                    )
            else:
                reply = _fallback_chat_reply(req.messages)
                yield _ndjson_line(
                    {"type": "meta", "emergency_detected": False, "demo_mode": True}
                )
                async for piece in _simulate_stream_text(reply):
                    yield _ndjson_line({"type": "delta", "text": piece})
            yield _ndjson_line({"type": "done"})
        except Exception as e:
            yield _ndjson_line(
                {"type": "meta", "emergency_detected": False, "demo_mode": False}
            )
            yield _ndjson_line({"type": "delta", "text": f"[错误] {e}"})
            yield _ndjson_line({"type": "done"})

    return StreamingResponse(
        ndjson_body(),
        media_type="application/x-ndjson; charset=utf-8",
    )


@app.post("/api/synthesize")
@app.post("/api/synthesize/")
async def synthesize(req: SynthesizeReq) -> dict[str, Any]:
    lines = []
    for m in req.messages:
        if m.role == "user":
            lines.append("用户：" + m.content.strip())
        elif m.role == "assistant":
            lines.append("助手：" + m.content.strip())
    for h in req.form_hints:
        lines.append("表单快捷项：" + h)
    transcript = "\n".join(lines)

    if not settings.openai_api_key:
        bundle = fallback_synthesize(transcript, req.form_hints, req.session_id)
        _merge_memory_from_bundle(req.session_id, bundle)
        return bundle

    user_prompt = (
        "以下为患者与助手对话及表单要点（均为自述，需要你整理为 JSON）：\n" + transcript
    )
    try:
        raw = await openai_chat(
            [
                {"role": "system", "content": SYNTHESIS_SYSTEM},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            response_format_json=True,
        )
        bundle = json.loads(raw)
    except (json.JSONDecodeError, HTTPException) as exc:
        bundle = fallback_synthesize(transcript, req.form_hints, req.session_id)
        bundle.setdefault(
            "memory_note",
            f"模型输出解析失败，已使用占位结果。详情：{getattr(exc, 'detail', exc)}",
        )
    bundle["generated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M")
    mem = load_memory(req.session_id)
    mn = memory_summary_block(mem)
    if mn:
        bundle["memory_note"] = mn
    _normalize_ids(bundle)
    _merge_memory_from_bundle(req.session_id, bundle)
    return bundle


def _normalize_ids(bundle: dict[str, Any]) -> None:
    for i, ev in enumerate(bundle.get("timeline_events") or []):
        ev.setdefault("id", str(i + 1))
    for i, m in enumerate(bundle.get("medications") or []):
        m.setdefault("id", str(i + 1))
    for i, q in enumerate(bundle.get("questions") or []):
        q.setdefault("id", str(i + 1))
    for i, c in enumerate(bundle.get("checklist") or []):
        c.setdefault("id", str(i + 1))


def _merge_memory_from_bundle(session_id: str, bundle: dict[str, Any]) -> None:
    mem = load_memory(session_id)
    allergies = bundle.get("allergies") or []
    meds = bundle.get("medications") or []
    mem["allergies"] = sorted(set(mem.get("allergies") or []).union(allergies))
    med_names = [str(m.get("name", "")).strip() for m in meds if m.get("name")]
    prev = mem.get("medications") or []
    mem["medications"] = sorted(set(prev).union([n for n in med_names if n]))
    mem["notes"] = "最近更新：" + datetime.now().strftime("%Y-%m-%d %H:%M")
    save_memory(session_id, mem)


@app.post("/api/extract-pdf")
@app.post("/api/extract-pdf/")
async def extract_pdf(file: UploadFile = File(...)) -> dict[str, Any]:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="仅支持 .pdf")
    raw = await file.read()
    if len(raw) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="文件过大（>15MB）")
    try:
        reader = PdfReader(io.BytesIO(raw))
        texts: list[str] = []
        for page in reader.pages[:30]:
            t = page.extract_text() or ""
            texts.append(t)
        merged = "\n".join(texts).strip()
        return {"pages": len(reader.pages), "text": merged[:12000]}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"PDF 读取失败：{exc}") from exc


@app.get("/api/health")
async def health() -> dict[str, Any]:  # noqa: D401
    full = build_chat_completions_url(settings.openai_base_url)
    base_only = full.removesuffix("/chat/completions")
    return {
        "status": "ok",
        "model": settings.openai_model,
        "llm_chat_base": base_only,
        "key_configured": bool(settings.openai_api_key),
        "agent": {
            "description": "就诊前信息整理 Agent：对话 + 结构化合成 + 会话记忆 + PDF 文本提取 + 历史会话管理",
            "llm_reasoning": bool(settings.openai_api_key),
            "tools": [
                {"name": "chat", "endpoint": "POST /api/chat", "purpose": "就诊前多轮对话（非流式）"},
                {"name": "chat_stream", "endpoint": "POST /api/chat/stream", "purpose": "同上，NDJSON 流式输出"},
                {"name": "extract_pdf_text", "endpoint": "POST /api/extract-pdf", "purpose": "从化验单/病历 PDF 抽取文本"},
                {"name": "synthesize_report", "endpoint": "POST /api/synthesize", "purpose": "整理为结构化 JSON 报告（含科室推荐）"},
                {"name": "list_sessions", "endpoint": "GET /api/sessions", "purpose": "列出历史会话"},
                {"name": "get_session", "endpoint": "GET /api/sessions/{id}", "purpose": "获取单个历史会话"},
                {"name": "save_session", "endpoint": "POST /api/sessions", "purpose": "保存/更新会话"},
                {"name": "delete_session", "endpoint": "DELETE /api/sessions/{id}", "purpose": "删除会话"},
            ],
            "memory": {
                "kind": "sqlite_sessions + session_file_json",
                "path_hint": "server/data/sessions.db + server/data/memory/<session_id>.json",
                "note": "SQLite 持久化历史会话；JSON 文件存储跨轮次过敏/用药摘要",
            },
            "planning": "多轮 system prompt 引导澄清症状/时间线/用药/过敏；危急关键词拦截；科室推荐",
        },
    }


# ── Docker 生产部署：同时提供前端静态文件 ────────────────────────────────────
_STATIC_DIR = BASE_DIR / "static"
if _STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=str(_STATIC_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def _spa_fallback(full_path: str):  # noqa: D401
        index = _STATIC_DIR / "index.html"
        if index.is_file():
            return FileResponse(str(index))
        return {"detail": "index.html not found"}
