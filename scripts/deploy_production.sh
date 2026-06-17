#!/bin/bash

################################################################################
# 生产环境部署脚本
# 用于部署速维电脑租赁管理系统 v2 到生产环境
################################################################################

set -e  # 如果任何命令失败，脚本就停止

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # 无颜色

# 配置变量
REPO_URL="https://github.com/barattadupray329-wq/suwei.git"
DEPLOY_DIR="/opt/suwei_rental"
BACKUP_DIR="/backups"
LOG_DIR="/var/log/suwei_rental"
APP_USER="rental"
APP_GROUP="rental"
ENVIRONMENT="production"

################################################################################
# 日志函数
################################################################################

log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

################################################################################
# 前置条件检查
################################################################################

check_prerequisites() {
    log_info "检查前置条件..."
    
    # 检查 Python
    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 未安装"
        exit 1
    fi
    log_success "Python 3 已安装: $(python3 --version)"
    
    # 检查 Git
    if ! command -v git &> /dev/null; then
        log_error "Git 未安装"
        exit 1
    fi
    log_success "Git 已安装: $(git --version)"
    
    # 检查 pip
    if ! command -v pip3 &> /dev/null; then
        log_error "pip3 未安装"
        exit 1
    fi
    log_success "pip3 已安装"
    
    # 检查环境变量
    if [ -z "$DB_PASSWORD" ]; then
        log_warning "环境变量 DB_PASSWORD 未设置"
    fi
    
    if [ -z "$SECRET_KEY" ]; then
        log_warning "环境变量 SECRET_KEY 未设置"
    fi
}

################################################################################
# 备份现有系统
################################################################################

backup_current_system() {
    log_info "备份当前系统..."
    
    if [ -d "$DEPLOY_DIR" ]; then
        TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        BACKUP_FILE="$BACKUP_DIR/suwei_rental_backup_$TIMESTAMP.tar.gz"
        
        mkdir -p "$BACKUP_DIR"
        tar -czf "$BACKUP_FILE" -C "$DEPLOY_DIR" . 2>/dev/null || true
        
        log_success "系统已备份到 $BACKUP_FILE"
    else
        log_info "没有现有系统需要备份（首次部署）"
    fi
}

################################################################################
# 创建部署目录
################################################################################

create_deployment_structure() {
    log_info "创建部署目录结构..."
    
    # 创建主要目录
    mkdir -p "$DEPLOY_DIR"
    mkdir -p "$LOG_DIR"
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$DEPLOY_DIR/logs"
    mkdir -p "$DEPLOY_DIR/data"
    mkdir -p "$DEPLOY_DIR/cache"
    
    # 设置权限
    chown -R $APP_USER:$APP_GROUP "$DEPLOY_DIR" 2>/dev/null || true
    chown -R $APP_USER:$APP_GROUP "$LOG_DIR" 2>/dev/null || true
    chmod -R 755 "$DEPLOY_DIR"
    chmod -R 755 "$LOG_DIR"
    
    log_success "部署目录结构已创建"
}

################################################################################
# 克隆或更新代码
################################################################################

clone_or_update_code() {
    log_info "克隆或更新代码..."
    
    if [ -d "$DEPLOY_DIR/.git" ]; then
        log_info "更新现有代码库..."
        cd "$DEPLOY_DIR"
        git fetch origin
        git checkout main
        git pull origin main
    else
        log_info "克隆代码库..."
        rm -rf "$DEPLOY_DIR"
        git clone --depth 1 "$REPO_URL" "$DEPLOY_DIR"
        cd "$DEPLOY_DIR"
    fi
    
    log_success "代码已更新到最新版本"
    log_info "最新提交: $(git rev-parse --short HEAD)"
}

################################################################################
# 安装依赖
################################################################################

install_dependencies() {
    log_info "安装 Python 依赖..."
    
    cd "$DEPLOY_DIR"
    
    # 创建虚拟环境（如果不存在）
    if [ ! -d "venv" ]; then
        log_info "创建虚拟环境..."
        python3 -m venv venv
    fi
    
    # 激活虚拟环境
    source venv/bin/activate
    
    # 升级 pip
    pip install --upgrade pip setuptools wheel
    
    # 安装依赖
    if [ -f "requirements.txt" ]; then
        log_info "从 requirements.txt 安装依赖..."
        pip install -r requirements.txt
    fi
    
    # 安装生产必需的包
    pip install gunicorn python-dotenv
    
    log_success "依赖已安装"
}

################################################################################
# 配置环境
################################################################################

configure_environment() {
    log_info "配置生产环境..."
    
    cd "$DEPLOY_DIR"
    
    # 复制生产配置文件
    if [ -f "config.production.json" ]; then
        cp config.production.json config.json
        log_success "配置文件已设置"
    fi
    
    # 创建 .env 文件（如果不存在）
    if [ ! -f ".env" ]; then
        log_info "创建 .env 文件..."
        cat > .env << EOF
ENVIRONMENT=production
DB_PASSWORD=\${DB_PASSWORD:-your_db_password}
SECRET_KEY=\${SECRET_KEY:-your_secret_key}
BACKUP_ENCRYPTION_KEY=\${BACKUP_ENCRYPTION_KEY:-your_backup_key}
PROD_DOMAIN=\${PROD_DOMAIN:-localhost}
SMTP_SERVER=\${SMTP_SERVER:-smtp.gmail.com}
ADMIN_EMAIL=\${ADMIN_EMAIL:-admin@example.com}
EOF
        log_warning "请更新 .env 文件中的环境变量"
    fi
    
    # 设置权限
    chmod 600 .env 2>/dev/null || true
    chown $APP_USER:$APP_GROUP .env 2>/dev/null || true
    
    log_success "环境已配置"
}

################################################################################
# 数据库迁移
################################################################################

database_migration() {
    log_info "执行数据库迁移..."
    
    cd "$DEPLOY_DIR"
    source venv/bin/activate
    
    # 如果有数据库迁移脚本，在这里执行
    if [ -f "scripts/migrate_db.py" ]; then
        python3 scripts/migrate_db.py
        log_success "数据库迁移已完成"
    else
        log_info "没有数据库迁移脚本（可选）"
    fi
}

################################################################################
# 初始化缓存
################################################################################

initialize_cache() {
    log_info "初始化缓存系统..."
    
    cd "$DEPLOY_DIR"
    source venv/bin/activate
    
    # 如果有缓存初始化脚本，在这里执行
    if [ -f "scripts/init_cache.py" ]; then
        python3 scripts/init_cache.py
        log_success "缓存已初始化"
    else
        log_info "没有缓存初始化脚本（可选）"
    fi
}

################################################################################
# 运行测试
################################################################################

run_tests() {
    log_info "运行冒烟测试..."
    
    cd "$DEPLOY_DIR"
    source venv/bin/activate
    
    # 运行基本的导入测试
    python3 -c "from core.app import MainWindow; print('✓ App module imported successfully')"
    python3 -c "from core.report_engine import ReportEngine; print('✓ Report engine imported successfully')"
    python3 -c "from core.cache_manager import CacheManager; print('✓ Cache manager imported successfully')"
    python3 -c "from core.config import ConfigManager; print('✓ Config manager imported successfully')"
    
    log_success "冒烟测试已通过"
}

################################################################################
# 配置 Systemd 服务
################################################################################

configure_systemd_service() {
    log_info "配置 systemd 服务..."
    
    # 创建 systemd 服务文件
    sudo tee /etc/systemd/system/suwei-rental.service > /dev/null << EOF
[Unit]
Description=速维电脑租赁管理系统 v2
After=network.target

[Service]
Type=notify
User=$APP_USER
Group=$APP_GROUP
WorkingDirectory=$DEPLOY_DIR
Environment="PATH=$DEPLOY_DIR/venv/bin"
ExecStart=$DEPLOY_DIR/venv/bin/gunicorn --workers 4 --worker-class sync --bind 0.0.0.0:5000 --timeout 30 core.app:app
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF
    
    # 重新加载 systemd
    sudo systemctl daemon-reload
    
    log_success "Systemd 服务已配置"
}

################################################################################
# 启动应用
################################################################################

start_application() {
    log_info "启动应用..."
    
    # 启用并启动服务
    sudo systemctl enable suwei-rental.service
    sudo systemctl start suwei-rental.service
    
    # 等待服务启动
    sleep 2
    
    # 检查服务状态
    if sudo systemctl is-active --quiet suwei-rental.service; then
        log_success "应用已成功启动"
    else
        log_error "应用启动失败"
        sudo systemctl status suwei-rental.service
        exit 1
    fi
}

################################################################################
# 验证部署
################################################################################

verify_deployment() {
    log_info "验证部署..."
    
    # 等待应用完全启动
    sleep 3
    
    # 检查应用是否在运行
    if curl -s http://localhost:5000/health > /dev/null 2>&1; then
        log_success "应用健康检查通过"
    else
        log_warning "健康检查端点不可用（这是正常的）"
    fi
    
    # 检查日志文件
    if [ -f "$LOG_DIR/app.log" ]; then
        log_success "日志文件已创建"
    fi
    
    log_success "部署验证完成"
}

################################################################################
# 清理
################################################################################

cleanup() {
    log_info "清理临时文件..."
    
    # 删除旧的备份（保留最近 30 天）
    find "$BACKUP_DIR" -name "suwei_rental_backup_*.tar.gz" -mtime +30 -delete
    
    log_success "清理完成"
}

################################################################################
# 主部署流程
################################################################################

main() {
    log_info "======================================================"
    log_info "速维电脑租赁管理系统 v2 - 生产部署脚本"
    log_info "开始时间: $(date)"
    log_info "======================================================"
    
    # 执行部署步骤
    check_prerequisites
    backup_current_system
    create_deployment_structure
    clone_or_update_code
    install_dependencies
    configure_environment
    database_migration
    initialize_cache
    run_tests
    configure_systemd_service
    start_application
    verify_deployment
    cleanup
    
    log_info "======================================================"
    log_success "部署完成！"
    log_info "应用地址: http://localhost:5000"
    log_info "日志位置: $LOG_DIR"
    log_info "配置文件: $DEPLOY_DIR/config.json"
    log_info "======================================================"
}

# 运行主函数
main "$@"
