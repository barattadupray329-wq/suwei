"""
Update Server - 用于跨电脑同步更新包和数据
运行: python update_server.py
然后在其他电脑的 exe 中配置服务器地址即可
"""

import os
import json
import socket
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler
from datetime import datetime
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 项目根目录
PROJECT_ROOT = Path(__file__).parent
DATA_FOLDER = PROJECT_ROOT / "租赁数据"
UPDATE_PACKAGES_FOLDER = DATA_FOLDER / ".update_packages"

class UpdateServerHandler(SimpleHTTPRequestHandler):
    """自定义 HTTP 请求处理器"""
    
    def do_GET(self):
        """处理 GET 请求"""
        # 获取客户端 IP
        client_ip = self.client_address[0]
        
        # 处理更新包列表
        if self.path == '/api/updates/list':
            return self._handle_update_list(client_ip)
        
        # 处理更新包下载
        elif self.path.startswith('/api/updates/download/'):
            return self._handle_update_download(client_ip)
        
        # 处理数据文件列表
        elif self.path == '/api/data/list':
            return self._handle_data_list(client_ip)
        
        # 处理数据文件下载
        elif self.path.startswith('/api/data/download/'):
            return self._handle_data_download(client_ip)
        
        # 处理服务器状态
        elif self.path == '/api/status':
            return self._handle_status(client_ip)
        
        # 处理根路径
        elif self.path == '/':
            return self._handle_root()
        
        else:
            self.send_error(404, f"Path not found: {self.path}")
    
    def _handle_update_list(self, client_ip):
        """返回可用的更新包列表"""
        try:
            if not UPDATE_PACKAGES_FOLDER.exists():
                UPDATE_PACKAGES_FOLDER.mkdir(parents=True, exist_ok=True)
            
            updates = []
            for pkg_file in sorted(UPDATE_PACKAGES_FOLDER.glob('*.zip'), reverse=True):
                updates.append({
                    'name': pkg_file.name,
                    'size': pkg_file.stat().st_size,
                    'modified': datetime.fromtimestamp(pkg_file.stat().st_mtime).isoformat(),
                    'url': f'/api/updates/download/{pkg_file.name}'
                })
            
            logger.info(f"[{client_ip}] 请求更新列表，找到 {len(updates)} 个包")
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': True,
                'updates': updates,
                'timestamp': datetime.now().isoformat()
            }).encode('utf-8'))
            return None
        
        except Exception as e:
            logger.error(f"[{client_ip}] 获取更新列表失败: {e}")
            return self._send_json_error(str(e))
    
    def _handle_update_download(self, client_ip):
        """下载更新包"""
        try:
            pkg_name = self.path.split('/')[-1]
            pkg_path = UPDATE_PACKAGES_FOLDER / pkg_name
            
            if not pkg_path.exists():
                logger.warning(f"[{client_ip}] 更新包不存在: {pkg_name}")
                return self._send_json_error(f"Update package not found: {pkg_name}")
            
            logger.info(f"[{client_ip}] 下载更新包: {pkg_name} ({pkg_path.stat().st_size} bytes)")
            
            self.send_response(200)
            self.send_header('Content-type', 'application/zip')
            self.send_header('Content-Length', str(pkg_path.stat().st_size))
            self.send_header('Content-Disposition', f'attachment; filename={pkg_name}')
            self.end_headers()
            
            with open(pkg_path, 'rb') as f:
                self.wfile.write(f.read())
            
            return None
        
        except Exception as e:
            logger.error(f"[{client_ip}] 下载更新包失败: {e}")
            return self._send_json_error(str(e))
    
    def _handle_data_list(self, client_ip):
        """返回数据文件列表"""
        try:
            if not DATA_FOLDER.exists():
                DATA_FOLDER.mkdir(parents=True, exist_ok=True)
            
            data_files = []
            for root, dirs, files in os.walk(DATA_FOLDER):
                # 跳过 .update_packages 文件夹的详细列表
                if '.update_packages' in dirs:
                    dirs.remove('.update_packages')
                
                for file in files:
                    file_path = Path(root) / file
                    rel_path = file_path.relative_to(DATA_FOLDER)
                    data_files.append({
                        'path': str(rel_path),
                        'size': file_path.stat().st_size,
                        'modified': datetime.fromtimestamp(file_path.stat().st_mtime).isoformat()
                    })
            
            logger.info(f"[{client_ip}] 请求数据文件列表，找到 {len(data_files)} 个文件")
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': True,
                'files': data_files,
                'timestamp': datetime.now().isoformat()
            }).encode('utf-8'))
            return None
        
        except Exception as e:
            logger.error(f"[{client_ip}] 获取数据文件列表失败: {e}")
            return self._send_json_error(str(e))
    
    def _handle_data_download(self, client_ip):
        """下载数据文件"""
        try:
            file_rel_path = self.path.replace('/api/data/download/', '')
            file_path = DATA_FOLDER / file_rel_path
            
            # 安全检查：防止目录遍历
            if not str(file_path.resolve()).startswith(str(DATA_FOLDER.resolve())):
                logger.warning(f"[{client_ip}] 非法访问: {file_rel_path}")
                return self._send_json_error("Access denied")
            
            if not file_path.exists():
                logger.warning(f"[{client_ip}] 数据文件不存在: {file_rel_path}")
                return self._send_json_error(f"File not found: {file_rel_path}")
            
            logger.info(f"[{client_ip}] 下载数据文件: {file_rel_path}")
            
            self.send_response(200)
            self.send_header('Content-type', 'application/octet-stream')
            self.send_header('Content-Length', str(file_path.stat().st_size))
            self.end_headers()
            
            with open(file_path, 'rb') as f:
                self.wfile.write(f.read())
            
            return None
        
        except Exception as e:
            logger.error(f"[{client_ip}] 下载数据文件失败: {e}")
            return self._send_json_error(str(e))
    
    def _handle_status(self, client_ip):
        """返回服务器状态"""
        try:
            update_count = len(list(UPDATE_PACKAGES_FOLDER.glob('*.zip'))) if UPDATE_PACKAGES_FOLDER.exists() else 0
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': True,
                'status': 'running',
                'update_packages': update_count,
                'data_folder': str(DATA_FOLDER),
                'timestamp': datetime.now().isoformat()
            }).encode('utf-8'))
            return None
        
        except Exception as e:
            logger.error(f"[{client_ip}] 获取状态失败: {e}")
            return self._send_json_error(str(e))
    
    def _handle_root(self):
        """处理根路径"""
        html = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>速维电脑租赁管理系统 - 更新服务器</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #333; }
                .status { background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 10px 0; }
                .api { background: #e8f4f8; padding: 10px; margin: 5px 0; font-family: monospace; }
                .success { color: green; }
                .error { color: red; }
            </style>
        </head>
        <body>
            <h1>✅ 速维电脑租赁管理系统 - 更新服务器</h1>
            
            <div class="status">
                <h2>服务器状态</h2>
                <p id="status">加载中...</p>
            </div>
            
            <div class="status">
                <h2>API 端点</h2>
                <div class="api">/api/status - 获取服务器状态</div>
                <div class="api">/api/updates/list - 获取可用更新列表</div>
                <div class="api">/api/updates/download/{filename} - 下载更新包</div>
                <div class="api">/api/data/list - 获取数据文件列表</div>
                <div class="api">/api/data/download/{filepath} - 下载数据文件</div>
            </div>
            
            <script>
                fetch('/api/status')
                    .then(r => r.json())
                    .then(data => {
                        document.getElementById('status').innerHTML = 
                            '<span class="success">✅ 运行中</span><br>' +
                            '更新包数量: ' + data.update_packages + '<br>' +
                            '数据文件夹: ' + data.data_folder + '<br>' +
                            '时间: ' + data.timestamp;
                    })
                    .catch(e => {
                        document.getElementById('status').innerHTML = 
                            '<span class="error">❌ 连接失败</span>';
                    });
            </script>
        </body>
        </html>
        """
        
        self.send_response(200)
        self.send_header('Content-type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html.encode('utf-8'))
        return None
    
    def _send_json_error(self, error_msg):
        """发送 JSON 错误响应"""
        self.send_response(400)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps({
            'success': False,
            'error': error_msg
        }).encode('utf-8'))
        return None
    
    def log_message(self, format, *args):
        """隐藏默认的日志输出"""
        pass


def get_local_ip():
    """获取本机 IP 地址"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"


def main():
    """启动服务器"""
    port = 9999
    local_ip = get_local_ip()
    
    server_address = ('0.0.0.0', port)
    httpd = HTTPServer(server_address, UpdateServerHandler)
    
    logger.info("=" * 60)
    logger.info("🚀 速维电脑租赁管理系统 - 更新服务器启动")
    logger.info("=" * 60)
    logger.info(f"📍 本机 IP: {local_ip}")
    logger.info(f"🔗 访问地址: http://{local_ip}:{port}")
    logger.info(f"📦 更新包文件夹: {UPDATE_PACKAGES_FOLDER}")
    logger.info(f"📂 数据文件夹: {DATA_FOLDER}")
    logger.info("=" * 60)
    logger.info("其他电脑的 exe 配置服务器地址为:")
    logger.info(f"   http://{local_ip}:{port}")
    logger.info("=" * 60)
    logger.info("按 Ctrl+C 停止服务器")
    logger.info("=" * 60)
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("\n🛑 服务器已停止")
        httpd.shutdown()


if __name__ == '__main__':
    main()
