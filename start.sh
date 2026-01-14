#!/bin/bash
# OnlyOffice 服务快速启动脚本 (Bash)
# 用于 Linux/macOS 系统

echo "========================================"
echo "OnlyOffice 服务启动脚本"
echo "========================================"
echo ""

# 检查 Docker 是否运行
echo "检查 Docker 状态..."
if docker ps > /dev/null 2>&1; then
    echo "✓ Docker 正在运行"
else
    echo "✗ Docker 未运行，请先启动 Docker"
    exit 1
fi

# 检查 docker-compose 是否可用
echo "检查 docker-compose 是否可用..."
if command -v docker-compose > /dev/null 2>&1; then
    echo "✓ docker-compose 可用"
else
    echo "✗ docker-compose 不可用"
    exit 1
fi

# 创建必要的目录
echo "创建必要的目录..."
directories=(
    "data/logs"
    "data/app"
    "data/lib"
    "data/db"
    "data/minio"
)

for dir in "${directories[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        echo "  创建目录: $dir"
    fi
done
echo "✓ 目录检查完成"

# 检查配置文件
echo "检查配置文件..."
if [ ! -f "officeServer/config.json" ]; then
    echo "✗ 配置文件不存在: officeServer/config.json"
    echo "  请确保配置文件存在"
    exit 1
fi
echo "✓ 配置文件存在"

# 启动服务
echo ""
echo "启动 Docker 服务..."
echo "  这将启动以下服务:"
echo "    - MinIO (端口 9000, 9001)"
echo "    - OnlyOffice Server (端口 3333)"
echo "    - API Server (端口 3001)"
echo ""

docker-compose up -d

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "✓ 服务启动成功！"
    echo "========================================"
    echo ""
    echo "服务访问地址:"
    echo "  - MinIO Console: http://localhost:9001"
    echo "    (用户名: minioadmin, 密码: minioadmin)"
    echo "  - OnlyOffice Server: http://localhost:3333"
    echo "  - API Server: http://localhost:3001"
    echo ""
    echo "查看服务状态: docker-compose ps"
    echo "查看日志: docker-compose logs -f"
    echo "停止服务: docker-compose down"
else
    echo ""
    echo "✗ 服务启动失败"
    echo "请检查错误信息并重试"
    exit 1
fi
