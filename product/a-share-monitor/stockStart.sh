#!/bin/bash

# A 股监控系统一键重启脚本
# 功能：检查并清理占用进程，完全重启服务

echo "========================================"
echo "  A 股实时监控系统 - 一键重启脚本"
echo "========================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 项目路径
PROJECT_DIR="/root/.openclaw/workspace/product/a-share-monitor"
SERVER_FILE="src/server.js"
LOG_FILE="server_output.log"
PORT=3000

echo -e "${YELLOW}[1/5]${NC} 检查当前服务状态..."

# 检查是否有 node 进程在运行
NODE_PIDS=$(pgrep -f "node.*${SERVER_FILE}" || echo "")

if [ -n "$NODE_PIDS" ]; then
    echo -e "${YELLOW}      发现运行中的服务进程：${NODE_PIDS}${NC}"
    echo -e "${YELLOW}[2/5]${NC} 停止现有服务..."
    
    # 尝试正常停止
    kill $NODE_PIDS 2>/dev/null
    sleep 2
    
    # 检查是否还有进程
    REMAINING_PIDS=$(pgrep -f "node.*${SERVER_FILE}" || echo "")
    if [ -n "$REMAINING_PIDS" ]; then
        echo -e "${RED}      正常停止失败，强制终止进程...${NC}"
        kill -9 $REMAINING_PIDS 2>/dev/null
        sleep 1
    fi
    
    echo -e "${GREEN}      ✓ 服务已停止${NC}"
else
    echo -e "${GREEN}      ✓ 没有运行中的服务${NC}"
fi

echo ""
echo -e "${YELLOW}[3/5]${NC} 检查端口 ${PORT} 占用情况..."

# 检查端口占用
PORT_PID=$(lsof -t -i:${PORT} 2>/dev/null || netstat -tlnp 2>/dev/null | grep ":${PORT} " | awk '{print $7}' | cut -d'/' -f1 || echo "")

if [ -n "$PORT_PID" ]; then
    echo -e "${RED}      端口 ${PORT} 被进程 ${PORT_PID} 占用${NC}"
    echo -e "${YELLOW}      强制清理占用进程...${NC}"
    kill -9 $PORT_PID 2>/dev/null
    sleep 1
    
    # 再次检查
    REMAINING_PORT_PID=$(lsof -t -i:${PORT} 2>/dev/null || echo "")
    if [ -n "$REMAINING_PORT_PID" ]; then
        echo -e "${RED}      警告：无法清理端口占用，请手动处理${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}      ✓ 端口已释放${NC}"
else
    echo -e "${GREEN}      ✓ 端口 ${PORT} 可用${NC}"
fi

echo ""
echo -e "${YELLOW}[4/5]${NC} 启动新服务..."

# 切换到项目目录
cd $PROJECT_DIR

if [ ! -f "$SERVER_FILE" ]; then
    echo -e "${RED}      错误：找不到服务器文件 ${SERVER_FILE}${NC}"
    exit 1
fi

# 启动服务（后台运行）
nohup node $SERVER_FILE > $LOG_FILE 2>&1 &
NEW_PID=$!

echo -e "${GREEN}      ✓ 服务已启动 (PID: ${NEW_PID})${NC}"

echo ""
echo -e "${YELLOW}[5/5]${NC} 验证服务状态..."

# 等待服务启动
sleep 3

# 检查进程是否存在
if ps -p $NEW_PID > /dev/null 2>&1; then
    echo -e "${GREEN}      ✓ 服务进程运行正常${NC}"
    
    # 检查端口是否监听
    if netstat -tlnp 2>/dev/null | grep -q ":${PORT} "; then
        echo -e "${GREEN}      ✓ 端口 ${PORT} 正在监听${NC}"
    else
        echo -e "${YELLOW}      ⚠ 端口未监听，检查日志...${NC}"
    fi
else
    echo -e "${RED}      ✗ 服务进程已退出，请查看日志${NC}"
    echo ""
    echo -e "${YELLOW}最近日志:${NC}"
    tail -20 $LOG_FILE
    exit 1
fi

echo ""
echo "========================================"
echo -e "  ${GREEN}✓ 服务重启成功！${NC}"
echo "========================================"
echo ""
echo "访问地址："
echo "  本地访问：http://localhost:${PORT}"
echo "  局域网：http://10.0.0.17:${PORT}"
echo ""
echo "日志文件：${PROJECT_DIR}/${LOG_FILE}"
echo ""
echo -e "${YELLOW}提示：${NC}使用 'tail -f ${LOG_FILE}' 查看实时日志"
echo ""
