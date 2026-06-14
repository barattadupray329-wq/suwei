#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 PNG 生成 ICO 并更新桌面快捷方式图标"""
from PIL import Image
import os

def update_icon():
    png_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'suwei_icon.png')
    ico_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'suwei_icon.ico')
    
    if not os.path.exists(png_path):
        print(f"PNG 图标不存在: {png_path}")
        return
    
    img = Image.open(png_path)
    sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    icon_images = [img.resize(s, Image.LANCZOS) for s in sizes]
    
    icon_images[0].save(
        ico_path,
        format='ICO',
        sizes=[(img.size[0], img.size[1]) for img in icon_images],
        append_images=icon_images[1:]
    )
    print(f"ICO 图标已生成: {ico_path}")
    
    # 更新快捷方式
    import win32com.client
    desktop = os.path.join(os.path.expanduser('~'), 'Desktop')
    shortcut_path = os.path.join(desktop, '速维电脑租赁管理系统V2.lnk')
    
    if os.path.exists(shortcut_path):
        shell = win32com.client.Dispatch("WScript.Shell")
        shortcut = shell.CreateShortCut(shortcut_path)
        shortcut.IconLocation = ico_path
        shortcut.Save()
        print("快捷方式图标已更新")
    else:
        print("快捷方式不存在")

if __name__ == '__main__':
    update_icon()
