#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 `DOU.png` 生成应用图标文件。"""
from pathlib import Path

from PIL import Image


def create_icon():
    base_dir = Path(__file__).resolve().parent
    source_path = base_dir / "DOU.png"
    png_path = base_dir / "douyu_icon.png"
    ico_path = base_dir / "douyu_icon.ico"

    if not source_path.exists():
        raise FileNotFoundError(f"未找到源图片: {source_path}")

    img = Image.open(source_path).convert("RGBA")

    # 统一输出为适合 Windows 图标的方形尺寸，保留原图内容并居中。
    size = 256
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    scale = min(size / img.width, size / img.height)
    new_size = (max(1, int(img.width * scale)), max(1, int(img.height * scale)))
    resized = img.resize(new_size, Image.LANCZOS)
    offset = ((size - new_size[0]) // 2, (size - new_size[1]) // 2)
    canvas.paste(resized, offset, resized)

    canvas.save(png_path)

    icon_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    canvas.save(ico_path, format="ICO", sizes=icon_sizes)
    print(f"ICO 图标已保存: {ico_path}")


if __name__ == '__main__':
    create_icon()
