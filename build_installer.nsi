; NSIS 安装程序脚本 - 速维租赁管理系统
; 需要安装 NSIS: https://nsis.sourceforge.io/

!include "MUI2.nsh"
!include "x64.nsh"

; 基本配置
Name "速维电脑租赁管理系统"
OutFile "速维租赁管理系统_安装程序.exe"
InstallDir "$PROGRAMFILES\suwei_rental"
InstallDirRegKey HKCU "Software\suwei_rental" ""

; 默认提取路径
RequestExecutionLevel user

; MUI 设置
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_LANGUAGE "SimpChinese"

; 检查坚果云是否安装
Section "检查依赖"
  ; 检查坚果云
  ${If} ${FileExists} "C:\Program Files\Nutstore\Nutstore.exe"
    DetailPrint "✓ 已检测到坚果云"
  ${Else}
    ${If} ${FileExists} "C:\Program Files (x86)\Nutstore\Nutstore.exe"
      DetailPrint "✓ 已检测到坚果云"
    ${Else}
      MessageBox MB_YESNO|MB_ICONQUESTION "未检测到坚果云。建议先安装坚果云以启用数据同步功能。$\n$\n是否现在打开坚果云下载页面？" \
        /SD IDYES IDYES download_nutstore IDNO skip_nutstore
      
      download_nutstore:
        ExecShell "open" "https://www.jianguoyun.com/s/downloads"
      
      skip_nutstore:
    ${EndIf}
  ${EndIf}
SectionEnd

; 安装应用文件
Section "安装应用"
  SetOutPath "$INSTDIR"
  
  ; 复制 exe 文件
  File "dist\速维租赁管理系统.exe"
  
  ; 创建快捷方式到开始菜单
  CreateDirectory "$SMPROGRAMS\suwei_rental"
  CreateShortcut "$SMPROGRAMS\suwei_rental\速维电脑租赁管理系统.lnk" "$INSTDIR\速维租赁管理系统.exe"
  CreateShortcut "$SMPROGRAMS\suwei_rental\卸载.lnk" "$INSTDIR\Uninstall.exe"
  
  ; 创建桌面快捷方式
  CreateShortcut "$DESKTOP\速维租赁管理系统.lnk" "$INSTDIR\速维租赁管理系统.exe"
  
  ; 保存安装路径到注册表
  WriteRegStr HKCU "Software\suwei_rental" "" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\suwei_rental" \
    "DisplayName" "速维电脑租赁管理系统"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\suwei_rental" \
    "UninstallString" "$INSTDIR\Uninstall.exe"
SectionEnd

; 创建软链接到坚果云数据文件夹
Section "配置数据同步"
  DetailPrint "正在创建数据同步软链接..."
  
  ${If} ${FileExists} "$INSTDIR\租赁数据"
    DetailPrint "✓ 数据文件夹已存在"
  ${Else}
    DetailPrint "注意：首次运行应用时会自动创建数据同步链接"
    DetailPrint "请确保已在坚果云中创建 '租赁数据' 同步文件夹"
  ${EndIf}
SectionEnd

; 卸载程序
Section "Uninstall"
  ; 删除应用文件
  Delete "$INSTDIR\速维租赁管理系统.exe"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  
  ; 删除快捷方式
  Delete "$SMPROGRAMS\suwei_rental\*.*"
  RMDir "$SMPROGRAMS\suwei_rental"
  Delete "$DESKTOP\速维租赁管理系统.lnk"
  
  ; 删除注册表项
  DeleteRegKey HKCU "Software\suwei_rental"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\suwei_rental"
SectionEnd

; 函数：在安装完成后显示信息
Function .onInstSuccess
  MessageBox MB_INFORMATION|MB_OK "安装完成！$\n$\n请确保已安装坚果云并登录账号：625730448@qq.com$\n$\n首次运行应用时会自动同步数据。"
FunctionEnd
