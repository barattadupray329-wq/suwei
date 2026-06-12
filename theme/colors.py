#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""深色现代主题配色方案"""

class DarkTheme:
    BG_PRIMARY = "#1a1a2e"
    BG_SECONDARY = "#16213e"
    BG_TERTIARY = "#0f3460"
    BG_CARD = "#1f2937"
    BG_INPUT = "#2d3748"
    BG_HOVER = "#374151"

    TEXT_PRIMARY = "#e2e8f0"
    TEXT_SECONDARY = "#a0aec0"
    TEXT_MUTED = "#718096"

    ACCENT_BLUE = "#3b82f6"
    ACCENT_CYAN = "#06b6d4"
    ACCENT_GREEN = "#10b981"
    ACCENT_YELLOW = "#f59e0b"
    ACCENT_RED = "#ef4444"
    ACCENT_PURPLE = "#8b5cf6"

    BORDER_COLOR = "#374151"
    BORDER_FOCUS = "#3b82f6"

    STATUS_ACTIVE = "#10b981"
    STATUS_EXPIRED = "#ef4444"
    STATUS_RETURNED = "#3b82f6"
    STATUS_LOST = "#f59e0b"
    STATUS_BOUGHT = "#8b5cf6"

    FONT_TITLE = ("微软雅黑", 18, "bold")
    FONT_SUBTITLE = ("微软雅黑", 14, "bold")
    FONT_LABEL = ("微软雅黑", 11)
    FONT_NORMAL = ("微软雅黑", 10)
    FONT_SMALL = ("微软雅黑", 9)
    FONT_BUTTON = ("微软雅黑", 10, "bold")
    FONT_BUTTON_BIG = ("微软雅黑", 12, "bold")
    FONT_MONO = ("Consolas", 10)
    FONT_CARD_VALUE = ("微软雅黑", 32, "bold")
    FONT_CARD_VALUE_SM = ("微软雅黑", 18, "bold")

    BUTTON_PAD_X = 14
    BUTTON_PAD_Y = 8
    ENTRY_WIDTH = 34
    ENTRY_HEIGHT = 28

    HOVER_LIGHTEN = 20
    FOCUS_HIGHLIGHT = "#60a5fa"

    @staticmethod
    def lighten(hex_color, amount=20):
        """调亮颜色用于 hover 效果"""
        hex_color = hex_color.lstrip("#")
        r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
        r = min(255, r + amount)
        g = min(255, g + amount)
        b = min(255, b + amount)
        return f"#{r:02x}{g:02x}{b:02x}"

    @staticmethod
    def bind_hover(widget, normal_color, hover_color=None):
        """绑定鼠标进入/离开的 hover 效果"""
        if hover_color is None:
            hover_color = DarkTheme.lighten(normal_color)
        def on_enter(e): widget.configure(bg=hover_color)
        def on_leave(e): widget.configure(bg=normal_color)
        widget.bind("<Enter>", on_enter)
        widget.bind("<Leave>", on_leave)
