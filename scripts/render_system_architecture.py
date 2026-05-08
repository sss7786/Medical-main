"""
生成 MedBrief 系统结构图 PNG（供报告粘贴）。运行：python scripts/render_system_architecture.py
"""
from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch, Rectangle

OUT = Path(__file__).resolve().parent.parent / "docs" / "system-architecture.png"

# 配色（现代技术文档风）
COLORS = {
    "bg": "#f1f5f9",
    "band_user": "#e8f4fc",
    "band_fe": "#ecfdf5",
    "band_be": "#fffbeb",
    "band_infra": "#f5f3ff",
    "text": "#0f172a",
    "text_muted": "#64748b",
    "border": "#cbd5e1",
    "accent_user": "#0284c7",
    "accent_fe": "#059669",
    "accent_be": "#d97706",
    "accent_llm": "#7c3aed",
    "accent_db": "#475569",
    "shadow": "#94a3b8",
}


def _cn_font() -> None:
    plt.rcParams["font.sans-serif"] = ["Microsoft YaHei", "SimHei", "Arial Unicode MS", "DejaVu Sans"]
    plt.rcParams["axes.unicode_minus"] = False


def band(
    ax,
    x: float,
    y: float,
    w: float,
    h: float,
    color: str,
    label: str | None = None,
) -> None:
    ax.add_patch(Rectangle((x, y), w, h, facecolor=color, edgecolor="none", zorder=0))
    if label:
        ax.text(
            0.056,
            y + h - 0.032,
            label,
            ha="left",
            va="top",
            fontsize=8.2,
            color=COLORS["text_muted"],
            fontweight="600",
            zorder=1,
        )


def card(
    ax,
    x: float,
    y: float,
    w: float,
    h: float,
    title: str,
    lines: list[str],
    accent: str,
    *,
    title_fs: float = 10.5,
    body_fs: float = 8.6,
) -> None:
    rs = 0.028
    pad = 0.014
    # 轻阴影
    ax.add_patch(
        FancyBboxPatch(
            (x - 0.004, y - 0.006),
            w + 0.008,
            h + 0.012,
            boxstyle=f"round,pad={pad},rounding_size={rs}",
            facecolor=COLORS["shadow"],
            edgecolor="none",
            alpha=0.18,
            zorder=2,
        )
    )
    # 主体白卡片
    ax.add_patch(
        FancyBboxPatch(
            (x, y),
            w,
            h,
            boxstyle=f"round,pad={pad},rounding_size={rs}",
            facecolor="#ffffff",
            edgecolor=COLORS["border"],
            linewidth=1.05,
            zorder=3,
        )
    )
    # 左侧强调色条（与圆角协调：略缩进）
    inset_y = y + 0.02
    bar_h = max(h - 0.04, 0.04)
    ax.add_patch(Rectangle((x + 0.022, inset_y), 0.022, bar_h, facecolor=accent, zorder=4, alpha=0.95))

    inner_left = x + 0.055
    inner_w = w - 0.068
    ax.text(
        inner_left + inner_w / 2,
        y + h - 0.036,
        title,
        ha="center",
        va="top",
        fontsize=title_fs,
        fontweight="bold",
        color=COLORS["text"],
        zorder=5,
    )
    ul_y = y + h - 0.05
    ax.plot(
        [inner_left, inner_left + inner_w],
        [ul_y, ul_y],
        color=accent,
        linewidth=2.25,
        solid_capstyle="round",
        zorder=5,
    )

    body_text = "\n".join(lines)
    ax.text(
        inner_left + inner_w / 2,
        y + h / 2 - 0.032,
        body_text,
        ha="center",
        va="center",
        fontsize=body_fs,
        color=COLORS["text"],
        linespacing=1.5,
        zorder=5,
    )


def v_arrow(ax, x: float, y_hi: float, y_lo: float, color: str, label: str = "") -> None:
    ax.add_patch(
        FancyArrowPatch(
            (x, y_hi),
            (x, y_lo),
            arrowstyle="-|>",
            mutation_scale=13,
            linewidth=1.5,
            color=color,
            zorder=8,
        )
    )
    if label:
        ax.text(
            x + 0.05,
            (y_hi + y_lo) / 2,
            label,
            ha="left",
            va="center",
            fontsize=8,
            color=COLORS["text_muted"],
            bbox=dict(boxstyle="round,pad=0.32", facecolor="white", edgecolor=COLORS["border"], alpha=0.97),
            zorder=9,
        )


def diag_arrow(
    ax,
    xy_start: tuple[float, float],
    xy_end: tuple[float, float],
    color: str,
    label: str = "",
) -> None:
    ax.add_patch(
        FancyArrowPatch(
            xy_start,
            xy_end,
            arrowstyle="-|>",
            mutation_scale=10,
            linewidth=1.25,
            color=color,
            connectionstyle="arc3,rad=0.05",
            zorder=7,
        )
    )
    if label:
        mx, my = (xy_start[0] + xy_end[0]) / 2, (xy_start[1] + xy_end[1]) / 2
        ax.text(
            mx + 0.02,
            my + 0.025,
            label,
            ha="center",
            va="center",
            fontsize=7.8,
            color=COLORS["text_muted"],
            bbox=dict(boxstyle="round,pad=0.22", facecolor="white", edgecolor=COLORS["border"], alpha=0.95),
            zorder=8,
        )


def main() -> None:
    _cn_font()
    fig_w, fig_h = 11.2, 8.4
    fig, ax = plt.subplots(figsize=(fig_w, fig_h), dpi=200)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")
    fig.patch.set_facecolor(COLORS["bg"])
    ax.set_facecolor(COLORS["bg"])

    # 外框（轻边框）
    ax.add_patch(
        FancyBboxPatch(
            (0.01, 0.01),
            0.98,
            0.98,
            boxstyle="round,pad=0,rounding_size=0.02",
            facecolor="none",
            edgecolor="#cbd5e1",
            linewidth=1.0,
            zorder=12,
        )
    )

    # 分层色带（层名在左侧，不挡主卡片）
    band(ax, 0, 0.805, 1, 0.105, COLORS["band_user"], "① 用户层")
    band(ax, 0, 0.555, 1, 0.235, COLORS["band_fe"], "② 表现层")
    band(ax, 0, 0.208, 1, 0.33, COLORS["band_be"], "③ 应用层（Agent）")
    band(ax, 0, 0.028, 1, 0.168, COLORS["band_infra"], "④ 数据与外部服务")

    # 标题
    ax.text(0.5, 0.968, "MedBrief 系统结构", ha="center", va="top", fontsize=18, fontweight="700", color=COLORS["text"])
    ax.text(0.5, 0.935, "就诊前信息整理 · 前后端分离", ha="center", va="top", fontsize=10.5, color=COLORS["text_muted"])

    # 用户
    u_x, u_w, u_y, u_h = 0.36, 0.28, 0.822, 0.065
    card(ax, u_x, u_y, u_w, u_h, "用户终端", ["浏览器（桌面 / 移动）"], COLORS["accent_user"], title_fs=11, body_fs=9.4)

    fe_x, fe_w = 0.11, 0.78
    fe_y, fe_h = 0.575, 0.178
    card(
        ax,
        fe_x,
        fe_y,
        fe_w,
        fe_h,
        "Web 前端  ·  Vite + React + TypeScript",
        [
            "对话与问诊进度 · 场景：全科 / 儿科 / 慢病",
            "报告预览 · 打印/PDF · JSON / Markdown",
            "语音（Web Speech）·  国际化 zh / en",
            "开发：Vite 将 /api 代理至后端",
        ],
        COLORS["accent_fe"],
    )

    be_x, be_w = fe_x, fe_w
    be_y, be_h = 0.228, 0.285
    card(
        ax,
        be_x,
        be_y,
        be_w,
        be_h,
        "后端智能体  ·  FastAPI",
        [
            "POST /api/chat/stream  → NDJSON 流式对话",
            "POST /api/chat  ·  POST /api/synthesize（结构化报告）",
            "POST /api/extract-pdf  ·  GET/POST /api/sessions",
            "Memory：session JSON，过敏/用药摘要回注",
            "安全：危急词拦截 · 分步澄清 System Prompt",
        ],
        COLORS["accent_be"],
        body_fs=8.15,
    )

    llm_x, llm_w = 0.13, 0.35
    st_x, st_w = 0.52, 0.35
    bot_y, bot_h = 0.052, 0.12

    card(
        ax,
        llm_x,
        bot_y,
        llm_w,
        bot_h,
        "大模型网关（可选）",
        ["OpenAI 兼容 API", "BASE_URL + API Key", "无 Key：离线话术 / 占位报告"],
        COLORS["accent_llm"],
        title_fs=10,
        body_fs=8.4,
    )
    card(
        ax,
        st_x,
        bot_y,
        st_w,
        bot_h,
        "本地持久化",
        ["data/memory/*.json", "会话与记忆（演示勿存真实隐私）"],
        COLORS["accent_db"],
        title_fs=10,
        body_fs=8.6,
    )

    cx = 0.5
    v_arrow(ax, cx, u_y - 0.01, fe_y + fe_h + 0.018, COLORS["accent_user"], "HTTPS / 本地")
    v_arrow(ax, cx, fe_y - 0.014, be_y + be_h + 0.018, COLORS["accent_fe"], "REST · NDJSON 流")

    diag_arrow(
        ax,
        (be_x + be_w * 0.27, be_y - 0.012),
        (llm_x + llm_w * 0.48, bot_y + bot_h + 0.018),
        COLORS["accent_llm"],
        "调用",
    )
    diag_arrow(
        ax,
        (be_x + be_w * 0.73, be_y - 0.012),
        (st_x + st_w * 0.52, bot_y + bot_h + 0.018),
        COLORS["accent_db"],
        "读写",
    )

    ax.text(
        0.98,
        0.012,
        "图 · MedBrief 总体架构",
        ha="right",
        va="bottom",
        fontsize=7.8,
        color=COLORS["text_muted"],
        zorder=11,
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    plt.subplots_adjust(left=0.02, right=0.98, top=0.99, bottom=0.01)
    fig.savefig(OUT, bbox_inches="tight", facecolor=fig.get_facecolor(), pad_inches=0.2)
    plt.close()
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
