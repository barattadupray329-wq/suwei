#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""中式亮色主题 — 宣纸底 + 朱砂红点缀"""

class DarkTheme:
    # ── 背景层级 ──
    BG_PRIMARY   = "#f7f4ef"   # 宣纸底色
    BG_SECONDARY = "#efece6"   # 侧栏
    BG_TERTIARY  = "#e7e4dc"   # 三级
    BG_CARD      = "#ffffff"   # 纯白卡片
    BG_INPUT     = "#fafaf6"   # 输入框
    BG_HOVER     = "#e8e2d6"   # 悬停

    # ── 文字层级 ──
    TEXT_PRIMARY   = "#2d2216"
    TEXT_SECONDARY = "#6b5e4c"
    TEXT_MUTED     = "#9b8d7a"

    # ── 语义色 ──
    ACCENT_PRIMARY   = "#c44233"  # 朱砂红 — 主按钮
    ACCENT_SECONDARY = "#3a6ba5"  # 靛蓝
    ACCENT_GREEN     = "#3a8f5c"
    ACCENT_YELLOW    = "#c48520"
    ACCENT_RED       = "#d4423f"
    ACCENT_PURPLE    = "#7c5da8"

    # 向后兼容别名
    ACCENT_BLUE = ACCENT_SECONDARY
    ACCENT_CYAN = ACCENT_PRIMARY

    BORDER_COLOR = "#e0d9cc"
    BORDER_FOCUS = ACCENT_PRIMARY

    STATUS_ACTIVE   = "#3a8f5c"
    STATUS_EXPIRED  = "#d4423f"
    STATUS_RETURNED = ACCENT_SECONDARY
    STATUS_LOST     = ACCENT_YELLOW
    STATUS_BOUGHT   = ACCENT_PURPLE

    # ── 字体 ──
    FONT_TITLE         = ("微软雅黑", 18, "bold")
    FONT_SUBTITLE      = ("微软雅黑", 15, "bold")
    FONT_LABEL         = ("微软雅黑", 12)
    FONT_NORMAL        = ("微软雅黑", 11)
    FONT_SMALL         = ("微软雅黑", 10)
    FONT_BUTTON        = ("微软雅黑", 11, "bold")
    FONT_BUTTON_BIG    = ("微软雅黑", 13, "bold")
    FONT_MONO          = ("Consolas", 10)
    FONT_CARD_VALUE    = ("微软雅黑", 32, "bold")
    FONT_CARD_VALUE_SM = ("微软雅黑", 20, "bold")

    # ── 间距常量 ──
    PAD_PAGE   = 24
    PAD_SECTION = 20
    RADIUS     = 10

    BUTTON_PAD_X = 18
    BUTTON_PAD_Y = 8
    ENTRY_WIDTH  = 36
    ENTRY_HEIGHT = 32

    HOVER_LIGHTEN = 20
    FOCUS_HIGHLIGHT = "#c44233"

    @staticmethod
    def lighten(hex_color, amount=20):
        """调亮颜色"""
        hex_color = hex_color.lstrip("#")
        r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
        r = min(255, r + amount)
        g = min(255, g + amount)
        b = min(255, b + amount)
        return f"#{r:02x}{g:02x}{b:02x}"

    @staticmethod
    def darken(hex_color, amount=20):
        """调暗颜色"""
        hex_color = hex_color.lstrip("#")
        r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
        r = max(0, r - amount)
        g = max(0, g - amount)
        b = max(0, b - amount)
        return f"#{r:02x}{g:02x}{b:02x}"

    @staticmethod
    def bind_hover(widget, normal_color, hover_color=None):
        if hover_color is None:
            hover_color = DarkTheme.darken(normal_color)
        def on_enter(e): widget.configure(bg=hover_color)
        def on_leave(e): widget.configure(bg=normal_color)
        widget.bind("<Enter>", on_enter)
        widget.bind("<Leave>", on_leave)
