#!/bin/bash
#
# HTML 自动校验脚本
# 用法：./auto-validate.sh [目录]
#
# 在修改任何 HTML 文件后，必须运行此脚本进行校验
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(dirname "$SCRIPT_DIR")"
TARGET_DIR="${1:-$WORKSPACE_DIR/product/a-share-monitor/public}"

echo "╔════════════════════════════════════════╗"
echo "║   HTML 自动校验流程                     ║"
echo "╚════════════════════════════════════════╝"
echo ""

# 检查目标目录是否存在
if [ ! -d "$TARGET_DIR" ]; then
    echo "❌ 错误：目录不存在 - $TARGET_DIR"
    exit 1
fi

# 查找所有 HTML 文件
HTML_FILES=$(find "$TARGET_DIR" -name "*.html" -type f 2>/dev/null | wc -l)

if [ "$HTML_FILES" -eq 0 ]; then
    echo "⚠️  警告：未找到 HTML 文件"
    exit 0
fi

echo "📁 校验目录：$TARGET_DIR"
echo "📄 HTML 文件数：$HTML_FILES"
echo ""

# 运行校验工具
echo "════════════════════════════════════════"
echo "开始校验..."
echo "════════════════════════════════════════"
echo ""

cd "$WORKSPACE_DIR"
if node scripts/validate-html.js "$TARGET_DIR"; then
    echo ""
    echo "╔════════════════════════════════════════╗"
    echo "║   ✅ 校验通过！                         ║"
    echo "╚════════════════════════════════════════╝"
    exit 0
else
    echo ""
    echo "╔════════════════════════════════════════╗"
    echo "║   ❌ 校验失败！请修复错误后重新提交     ║"
    echo "╚════════════════════════════════════════╝"
    echo ""
    echo "常见错误："
    echo "  1. <script> 标签未闭合"
    echo "  2. <link> 标签格式错误"
    echo "  3. <meta> 标签格式错误"
    echo ""
    echo "修复后请重新运行：./scripts/auto-validate.sh"
    exit 1
fi
