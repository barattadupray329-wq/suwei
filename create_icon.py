#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成红色「速」字应用图标"""
from PIL import Image, ImageDraw, ImageFont
import os

def create_icon():
    size = 256
    # 纯白背景
    img = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)

    # 圆角矩形背景
    padding = 16
    corner_radius = 48
    draw.rounded_rectangle(
        [padding, padding, size - padding, size - padding],
        radius=corner_radius,
        fill='#f9f8f5'
    )

    # 尝试使用中文字体
    font_paths = [
        "C:/Windows/Fonts/msyh.ttc",       # 微软雅黑
        "C:/Windows/Fonts/simhei.ttf",     # 黑体
        "C:/Windows/Fonts/simsun.ttc",     # 宋体
        "C:/Windows/Fonts/msyhbd.ttc",     # 微软雅黑 Bold
    ]
    font = None
    for fp in font_paths:
        try:
            font = ImageFont.truetype(fp, 160)
            break
        except (IOError, OSError):
            continue
    if font is None:
        font = ImageFont.load_default()

    # 绘制红色「速」字
    text = "速"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (size - text_w) // 2
    y = (size - text_h) // 2 - 8
    # 使用更饱满的红色
    draw.text((x, y), text, fill='#d44d3b', font=font)

    # 保存 PNG 预览
    output_dir = os.path.dirname(os.path.abspath(__file__))
    png_path = os.path.join(output_dir, 'suwei_icon.png')
    img.save(png_path)
    
    ico_path = os.path.join(output_dir, 'suwei_icon.ico')
    
    sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    icon_images = []
    for s in sizes:
        resized = img.resize(s, Image.LANCZOS)
        icon_images.append(resized)
    
    icon_images[0].save(
        ico_path,
        format='ICO',
        sizes=[(img.size[0], img.size[1]) for img in icon_images],
        append_images=icon_images[1:]
    )
    print(f"ICO 图标已保存: {ico_path}")

if __name__ == '__main__':
    create_icon()
