# PowerShell 一键打包脚本
# 用法: .\build.ps1

param(
    [switch]$SkipNsis = $false,  # 跳过 NSIS 步骤
    [switch]$SkipClean = $false  # 不清理旧的 build 文件
)

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "速维电脑租赁管理系统 - 打包脚本" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# 获取脚本目录
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# 1. 检查依赖
Write-Host "1️⃣  检查依赖..." -ForegroundColor Yellow
$pythonPath = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $pythonPath) {
    Write-Host "❌ 未找到 Python 环境，请先安装 Python 3.8+" -ForegroundColor Red
    exit 1
}
Write-Host "✅ 已找到 Python: $pythonPath" -ForegroundColor Green

# 检查 PyInstaller
Write-Host "   检查 PyInstaller..." -ForegroundColor Gray
python -m pip list | Select-String PyInstaller | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ℹ️  安装 PyInstaller..." -ForegroundColor Cyan
    python -m pip install PyInstaller --quiet
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ PyInstaller 安装失败" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✅ PyInstaller 已就绪" -ForegroundColor Green

# 2. 清理旧的构建文件
if (-not $SkipClean) {
    Write-Host ""
    Write-Host "2️⃣  清理旧的构建文件..." -ForegroundColor Yellow
    if (Test-Path "build") {
        Remove-Item -Path "build" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "✅ 已删除 build 目录" -ForegroundColor Green
    }
    if (Test-Path "dist") {
        Remove-Item -Path "dist" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "✅ 已删除 dist 目录" -ForegroundColor Green
    }
    if (Test-Path "*.spec") {
        Remove-Item -Path "*.spec" -Force -ErrorAction SilentlyContinue
        Write-Host "✅ 已删除 .spec 文件" -ForegroundColor Green
    }
}

# 3. 使用 PyInstaller 打包
Write-Host ""
Write-Host "3️⃣  使用 PyInstaller 生成 exe..." -ForegroundColor Yellow
Write-Host "   这可能需要几分钟，请耐心等待..." -ForegroundColor Cyan
Write-Host ""

$pyInstallerCmd = @"
pyinstaller `
    --name="速维租赁管理系统" `
    --onefile `
    --windowed `
    --icon=suwei_icon.ico `
    --hidden-import=tkinter `
    --hidden-import=tkinter.ttk `
    --hidden-import=tkinter.messagebox `
    --hidden-import=tkinter.filedialog `
    --hidden-import=sqlite3 `
    --add-data="theme:theme" `
    --add-data="modules:modules" `
    --add-data="core:core" `
    --noconfirm `
    main.py
"@

Invoke-Expression $pyInstallerCmd
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ PyInstaller 打包失败" -ForegroundColor Red
    exit 1
}
Write-Host ""
Write-Host "✅ exe 生成成功！位置: dist\速维租赁管理系统.exe" -ForegroundColor Green

# 4. 生成 NSIS 安装程序
if (-not $SkipNsis) {
    Write-Host ""
    Write-Host "4️⃣  生成 NSIS 安装程序..." -ForegroundColor Yellow
    
    # 检查 NSIS
    $nsisPath = "C:\Program Files (x86)\NSIS\makensis.exe"
    if (-not (Test-Path $nsisPath)) {
        $nsisPath = "C:\Program Files\NSIS\makensis.exe"
    }
    
    if (-not (Test-Path $nsisPath)) {
        Write-Host "⚠️  未找到 NSIS，跳过安装程序生成" -ForegroundColor Yellow
        Write-Host "   提示：如需生成安装程序，请从 https://nsis.sourceforge.io/Main_Page 下载 NSIS" -ForegroundColor Gray
    } else {
        Write-Host "   检测到 NSIS: $nsisPath" -ForegroundColor Gray
        & $nsisPath "build_installer.nsi"
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ 安装程序生成成功！文件: 速维租赁管理系统_安装程序.exe" -ForegroundColor Green
        } else {
            Write-Host "⚠️  NSIS 生成安装程序失败，但 exe 已生成" -ForegroundColor Yellow
        }
    }
}

# 5. 最终总结
Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "✅ 打包完成！" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "输出文件:" -ForegroundColor Yellow
Write-Host "  📦 exe:  dist\速维租赁管理系统.exe" -ForegroundColor Cyan
Write-Host "  📦 installer: 速维租赁管理系统_安装程序.exe (如果生成了)" -ForegroundColor Cyan
Write-Host ""
Write-Host "部署说明:" -ForegroundColor Yellow
Write-Host "  1. 在其他电脑上下载并安装坚果云" -ForegroundColor Gray
Write-Host "  2. 使用账号 625730448@qq.com 登录" -ForegroundColor Gray
Write-Host "  3. 双击 exe 文件直接运行，或使用安装程序安装" -ForegroundColor Gray
Write-Host "  4. 首次运行时会自动同步数据" -ForegroundColor Gray
Write-Host ""
