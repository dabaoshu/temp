# OnlyOffice 服务快速启动脚本 (PowerShell)
# 用于 Windows 系统

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "OnlyOffice 服务启动脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Docker 是否运行
Write-Host "检查 Docker 状态..." -ForegroundColor Yellow
try {
    docker ps | Out-Null
    Write-Host "✓ Docker 正在运行" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker 未运行，请先启动 Docker Desktop" -ForegroundColor Red
    exit 1
}

# 检查 docker-compose 是否可用
Write-Host "检查 docker-compose 是否可用..." -ForegroundColor Yellow
try {
    docker-compose --version | Out-Null
    Write-Host "✓ docker-compose 可用" -ForegroundColor Green
} catch {
    Write-Host "✗ docker-compose 不可用" -ForegroundColor Red
    exit 1
}

# 创建必要的目录
Write-Host "创建必要的目录..." -ForegroundColor Yellow
$directories = @(
    "data\logs",
    "data\app",
    "data\lib",
    "data\db",
    "data\minio"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  创建目录: $dir" -ForegroundColor Gray
    }
}
Write-Host "✓ 目录检查完成" -ForegroundColor Green

# 检查配置文件
Write-Host "检查配置文件..." -ForegroundColor Yellow
if (-not (Test-Path "officeServer\config.json")) {
    Write-Host "✗ 配置文件不存在: officeServer\config.json" -ForegroundColor Red
    Write-Host "  请确保配置文件存在" -ForegroundColor Yellow
    exit 1
}
Write-Host "✓ 配置文件存在" -ForegroundColor Green

# 启动服务
Write-Host ""
Write-Host "启动 Docker 服务..." -ForegroundColor Yellow
Write-Host "  这将启动以下服务:" -ForegroundColor Gray
Write-Host "    - MinIO (端口 9000, 9001)" -ForegroundColor Gray
Write-Host "    - OnlyOffice Server (端口 3333)" -ForegroundColor Gray
Write-Host "    - API Server (端口 3001)" -ForegroundColor Gray
Write-Host ""

docker-compose up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✓ 服务启动成功！" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "服务访问地址:" -ForegroundColor Cyan
    Write-Host "  - MinIO Console: http://localhost:9001" -ForegroundColor White
    Write-Host "    (用户名: minioadmin, 密码: minioadmin)" -ForegroundColor Gray
    Write-Host "  - OnlyOffice Server: http://localhost:3333" -ForegroundColor White
    Write-Host "  - API Server: http://localhost:3001" -ForegroundColor White
    Write-Host ""
    Write-Host "查看服务状态: docker-compose ps" -ForegroundColor Yellow
    Write-Host "查看日志: docker-compose logs -f" -ForegroundColor Yellow
    Write-Host "停止服务: docker-compose down" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "✗ 服务启动失败" -ForegroundColor Red
    Write-Host "请检查错误信息并重试" -ForegroundColor Yellow
    exit 1
}
