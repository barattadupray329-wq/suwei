################################################################################
# 生产环境部署验证脚本 (Windows PowerShell)
# 用于在 Windows 环境验证速维电脑租赁管理系统 v2 的部署前置条件
################################################################################

# 禁用进度条以加快输出
$ProgressPreference = 'SilentlyContinue'

# 颜色函数
function Write-Info {
    param([string]$Message)
    Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [INFO] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [SUCCESS] $Message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [ERROR] $Message" -ForegroundColor Red
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [WARNING] $Message" -ForegroundColor Yellow
}

################################################################################
# 前置条件检查
################################################################################

function Check-Prerequisites {
    Write-Info "检查前置条件..."
    
    # 检查 Python
    try {
        $pythonVersion = python --version 2>&1
        Write-Success "Python 已安装: $pythonVersion"
    }
    catch {
        Write-Error-Custom "Python 未安装或不在 PATH 中"
        return $false
    }
    
    # 检查 pip
    try {
        $pipVersion = pip --version 2>&1
        Write-Success "pip 已安装: $pipVersion"
    }
    catch {
        Write-Error-Custom "pip 未安装或不在 PATH 中"
        return $false
    }
    
    # 检查 Git
    try {
        $gitVersion = git --version 2>&1
        Write-Success "Git 已安装: $gitVersion"
    }
    catch {
        Write-Error-Custom "Git 未安装或不在 PATH 中"
        return $false
    }
    
    # 检查环境变量
    if (-not $env:DB_PASSWORD) {
        Write-Warning-Custom "环境变量 DB_PASSWORD 未设置"
    }
    
    if (-not $env:SECRET_KEY) {
        Write-Warning-Custom "环境变量 SECRET_KEY 未设置"
    }
    
    return $true
}

################################################################################
# 检查项目依赖
################################################################################

function Check-Dependencies {
    Write-Info "检查项目依赖..."
    
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $projectRoot = Split-Path -Parent $scriptDir
    
    # 检查 requirements.txt
    if (Test-Path "$projectRoot/requirements.txt") {
        Write-Success "requirements.txt 已找到"
        
        $requiredPackages = @(
            "flask",
            "sqlite3",
            "requests",
            "cryptography"
        )
        
        foreach ($pkg in $requiredPackages) {
            try {
                $result = pip show $pkg 2>&1
                if ($result) {
                    Write-Success "  ✓ $pkg 已安装"
                }
            }
            catch {
                Write-Warning-Custom "  ✗ $pkg 未安装"
            }
        }
    }
    else {
        Write-Warning-Custom "requirements.txt 未找到"
    }
}

################################################################################
# 检查模块导入
################################################################################

function Test-Module-Imports {
    Write-Info "测试关键模块导入..."
    
    $testModules = @{
        "core.app" = "主应用模块"
        "core.report_engine" = "报表引擎"
        "core.cache_manager" = "缓存管理器"
        "core.config" = "配置管理器"
        "core.auth" = "认证模块"
    }
    
    foreach ($moduleName in $testModules.Keys) {
        try {
            python -c "import sys; sys.path.insert(0, '.'); from $moduleName import *; print('OK')" 2>&1 | Out-Null
            Write-Success "✓ $($testModules[$moduleName]) ($moduleName) - 导入成功"
        }
        catch {
            Write-Warning-Custom "✗ $($testModules[$moduleName]) ($moduleName) - 导入失败"
        }
    }
}

################################################################################
# 检查配置文件
################################################################################

function Check-Configuration {
    Write-Info "检查配置文件..."
    
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $projectRoot = Split-Path -Parent $scriptDir
    
    $configFiles = @(
        "$projectRoot/config.production.json",
        "$projectRoot/requirements.txt"
    )
    
    foreach ($configFile in $configFiles) {
        if (Test-Path $configFile) {
            $size = (Get-Item $configFile).Length
            Write-Success "✓ $(Split-Path -Leaf $configFile) - $([Math]::Round($size/1KB))KB"
        }
        else {
            Write-Warning-Custom "✗ $(Split-Path -Leaf $configFile) - 未找到"
        }
    }
}

################################################################################
# 生成部署就绪报告
################################################################################

function Generate-Deployment-Report {
    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Magenta
    Write-Success "部署就绪性检查报告"
    Write-Host "================================================================================" -ForegroundColor Magenta
    Write-Host ""
    
    Write-Info "时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    Write-Info "系统: Windows $(Get-WmiObject Win32_OperatingSystem).BuildNumber"
    Write-Info "PowerShell: $($PSVersionTable.PSVersion)"
    Write-Info "工作目录: $(Get-Location)"
    Write-Host ""
    
    Write-Host "系统信息:" -ForegroundColor Cyan
    $osInfo = Get-WmiObject Win32_OperatingSystem
    Write-Host "  操作系统: $($osInfo.Caption)"
    Write-Host "  处理器核心: $(Get-WmiObject Win32_Processor).NumberOfCores"
    Write-Host "  总内存: $([Math]::Round((Get-WmiObject Win32_ComputerSystem).TotalPhysicalMemory/1GB))GB"
    Write-Host "  可用内存: $([Math]::Round((Get-WmiObject Win32_OperatingSystem).FreePhysicalMemory/1KB/1024))GB"
    Write-Host ""
    
    Write-Host "部署前置条件检查:" -ForegroundColor Cyan
    $prereqOk = Check-Prerequisites
    Write-Host ""
    
    Write-Host "依赖检查:" -ForegroundColor Cyan
    Check-Dependencies
    Write-Host ""
    
    Write-Host "配置文件检查:" -ForegroundColor Cyan
    Check-Configuration
    Write-Host ""
    
    Write-Host "模块导入测试:" -ForegroundColor Cyan
    Test-Module-Imports
    Write-Host ""
    
    Write-Host "部署建议:" -ForegroundColor Cyan
    Write-Host "  1. 在 Linux/Unix 生产服务器上运行原始的 Bash 部署脚本"
    Write-Host "  2. 使用 Gunicorn + systemd 来管理应用进程"
    Write-Host "  3. 配置以下环境变量:"
    Write-Host "     - DB_PASSWORD (数据库密码)"
    Write-Host "     - SECRET_KEY (应用密钥)"
    Write-Host "     - BACKUP_ENCRYPTION_KEY (备份加密密钥)"
    Write-Host "     - PROD_DOMAIN (生产域名)"
    Write-Host "  4. 执行部署步骤:"
    Write-Host "     a. 备份现有系统"
    Write-Host "     b. 克隆/更新代码"
    Write-Host "     c. 安装依赖"
    Write-Host "     d. 运行数据库迁移"
    Write-Host "     e. 初始化缓存"
    Write-Host "     f. 配置 systemd 服务"
    Write-Host "     g. 启动应用"
    Write-Host "     h. 验证部署"
    Write-Host ""
    
    Write-Host "================================================================================" -ForegroundColor Magenta
    if ($prereqOk) {
        Write-Success "✓ 所有前置条件已满足，系统已准备好部署"
    }
    else {
        Write-Error-Custom "✗ 部分前置条件未满足，请解决后重试"
    }
    Write-Host "================================================================================" -ForegroundColor Magenta
}

################################################################################
# 主程序
################################################################################

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Magenta
Write-Host "速维电脑租赁管理系统 v2 - 生产部署验证脚本" -ForegroundColor Magenta
Write-Host "================================================================================" -ForegroundColor Magenta
Write-Host ""

Generate-Deployment-Report

Write-Host ""
Write-Info "部署验证完成！请根据上述报告进行相应的部署前准备。"
Write-Host ""
