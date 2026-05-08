"""单元测试：表单解析、离线合成、危急路由（不启动 HTTP 服务）。"""

import uuid

import pytest

from main import (
    EMERGENCY_PATTERNS,
    ChatMessage,
    ChatReq,
    _parse_form_hints,
    fallback_synthesize,
    prepare_chat_messages,
)


def test_prepare_chat_messages_emergency() -> None:
    emer, msgs = prepare_chat_messages(
        ChatReq(
            session_id="sid",
            messages=[
                ChatMessage(role="assistant", content="您好"),
                ChatMessage(role="user", content="我胸痛剧烈喘不上气"),
            ],
        )
    )
    assert emer is True
    assert msgs == []


def test_prepare_chat_messages_normal() -> None:
    emer, msgs = prepare_chat_messages(
        ChatReq(
            session_id="sid",
            messages=[
                ChatMessage(role="user", content="头痛三天了"),
            ],
        )
    )
    assert emer is False
    assert msgs[0]["role"] == "system"
    assert any(m["role"] == "user" for m in msgs)


def test_parse_form_hints_allergy() -> None:
    ev, meds, allergies = _parse_form_hints(["[过敏] 青霉素过敏"])
    assert meds == []
    assert any("青霉素" in a for a in allergies)


def test_fallback_synthesize_from_hints() -> None:
    sid = str(uuid.uuid4())
    hints = ["[症状] 发热", "[时间线] 3天前开始"]
    bundle = fallback_synthesize("", hints, sid)
    assert len(bundle["timeline_events"]) >= 1
    assert bundle["basic_info"]["visit_date"]


def test_emergency_regex_matches() -> None:
    assert EMERGENCY_PATTERNS.search("昏迷不醒")
    assert EMERGENCY_PATTERNS.search("呼吸困难")
