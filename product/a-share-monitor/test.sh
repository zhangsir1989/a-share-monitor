#!/bin/bash
# A 股实时监控系统 - 自测脚本

echo "======================================"
echo "A 股实时监控系统 - 自测"
echo "======================================"
echo ""

BASE_URL="http://localhost:3000"

# 测试 1: 检查服务器是否运行
echo "[测试 1] 检查服务器状态..."
if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL" | grep -q "200"; then
    echo "✓ 服务器运行正常"
else
    echo "✗ 服务器未运行"
    exit 1
fi

# 测试 2: 测试主页
echo ""
echo "[测试 2] 测试主页访问..."
if curl -s "$BASE_URL/" | grep -q "A 股实时监控"; then
    echo "✓ 主页访问正常"
else
    echo "✗ 主页访问失败"
fi

# 测试 3: 测试成交量 API
echo ""
echo "[测试 3] 测试成交量 API..."
VOLUME=$(curl -s "$BASE_URL/api/market-volume")
if echo "$VOLUME" | grep -q "totalAmount"; then
    echo "✓ 成交量 API 正常"
    echo "  总成交额：$(echo "$VOLUME" | grep -o '"totalAmount":[0-9.]*' | cut -d: -f2) 亿元"
else
    echo "✗ 成交量 API 失败"
fi

# 测试 4: 测试涨停板块 API
echo ""
echo "[测试 4] 测试涨停板块 API..."
LIMIT_UP=$(curl -s "$BASE_URL/api/limit-up-sectors")
if echo "$LIMIT_UP" | grep -q "limitUpCount"; then
    echo "✓ 涨停板块 API 正常"
    echo "  板块数量：$(echo "$LIMIT_UP" | grep -o '"name"' | wc -l)"
else
    echo "✗ 涨停板块 API 失败"
fi

# 测试 5: 测试高换手率 API
echo ""
echo "[测试 5] 测试高换手率 API..."
TURNOVER=$(curl -s "$BASE_URL/api/high-turnover")
if echo "$TURNOVER" | grep -q "turnoverRate"; then
    echo "✓ 高换手率 API 正常"
    echo "  股票数量：$(echo "$TURNOVER" | grep -o '"code"' | wc -l)"
else
    echo "✗ 高换手率 API 失败"
fi

# 测试 6: 测试资金流 API
echo ""
echo "[测试 6] 测试板块资金流 API..."
CASHFLOW=$(curl -s "$BASE_URL/api/sector-cashflow")
if echo "$CASHFLOW" | grep -q "mainNetInflow"; then
    echo "✓ 资金流 API 正常"
    echo "  板块数量：$(echo "$CASHFLOW" | grep -o '"name"' | wc -l)"
else
    echo "✗ 资金流 API 失败"
fi

# 测试 7: 测试全部数据 API
echo ""
echo "[测试 7] 测试全部数据 API..."
ALL=$(curl -s "$BASE_URL/api/all")
if echo "$ALL" | grep -q "lastUpdate"; then
    echo "✓ 全部数据 API 正常"
    LAST_UPDATE=$(echo "$ALL" | grep -o '"lastUpdate":"[^"]*"' | cut -d'"' -f4)
    echo "  最后更新：$LAST_UPDATE"
else
    echo "✗ 全部数据 API 失败"
fi

# 测试 8: 测试静态资源
echo ""
echo "[测试 8] 测试静态资源..."
if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/css/style.css" | grep -q "200"; then
    echo "✓ CSS 文件访问正常"
else
    echo "✗ CSS 文件访问失败"
fi

if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/js/app.js" | grep -q "200"; then
    echo "✓ JS 文件访问正常"
else
    echo "✗ JS 文件访问失败"
fi

echo ""
echo "======================================"
echo "自测完成！"
echo "======================================"
echo ""
echo "访问地址：$BASE_URL"
echo ""
