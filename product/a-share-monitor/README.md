# A 股实时监控系统

实时监控 A 股市场成交量、高换手率股票等数据，数据来源于腾讯财经和新浪财经。

## 功能特性

- 📈 **全市场成交量监控** - 实时展示总成交额、成交量、沪深分布（腾讯财经实时数据）
- ⚡ **高换手率 TOP50** - 展示换手率最高的 50 只股票（新浪财经实时数据）
- 📊 **板块行情** - 展示行业板块涨跌幅排行
- 💰 **资金流分析** - 板块资金流入流出情况
- 🔄 **自动刷新** - 支持 1-10 秒刷新频率，可自定义
- 💾 **数据缓存** - 收盘时自动缓存数据

## 系统要求

- Node.js v16+ (推荐 v18+)
- 内存：最低 512MB，推荐 1GB
- 磁盘空间：最低 100MB
- 网络：需要访问东方财富 API

## 安装步骤

### Windows

1. 安装 Node.js：https://nodejs.org/ 下载 LTS 版本
2. 解压项目到目录（如 `D:\a-share-monitor\`）
3. 双击 `start.bat` 启动
4. 浏览器访问 http://localhost:3000

### Linux

```bash
# 1. 安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. 进入项目目录
cd a-share-monitor

# 3. 安装依赖
npm install --registry=https://registry.npmmirror.com

# 4. 启动服务
npm start

# 5. 访问 http://localhost:3000
```

### macOS

```bash
# 1. 安装 Node.js (使用 Homebrew)
brew install node

# 2. 进入项目目录并安装依赖
cd a-share-monitor && npm install

# 3. 启动服务
npm start

# 4. 访问 http://localhost:3000
```

## 配置说明

### 修改端口

编辑 `src/server.js` 第 10 行：
```javascript
const PORT = 3000; // 修改为所需端口
```

### 刷新频率

- 通过页面顶部下拉菜单选择（1 秒/2 秒/3 秒/5 秒/10 秒）
- 设置自动保存到浏览器本地存储

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/market-volume | GET | 获取市场成交量数据 |
| /api/limit-up-sectors | GET | 获取涨停板块数据 |
| /api/high-turnover | GET | 获取高换手率股票 |
| /api/sector-cashflow | GET | 获取板块资金流 |
| /api/all | GET | 获取全部数据 |

## 数据源

- 东方财富 API (http://push2.eastmoney.com)
- 腾讯财经 (备用)

## 交易时间

- 上午：9:30 - 11:30
- 下午：13:00 - 15:00
- 周末及法定节假日休市

## 注意事项

1. 本系统仅供学习参考，不构成投资建议
2. 数据来源于公开 API，可能存在延迟
3. 请勿频繁请求，避免触发 API 限流
4. 建议刷新间隔不低于 3 秒

## 技术栈

- 前端：HTML5 + CSS3 + JavaScript (原生)
- 后端：Node.js + Express
- 数据源：东方财富 API
- 存储：本地 JSON 文件缓存

## 许可证

MIT License

## 更新日志

### v1.0.0 (2026-03-31)
- 初始版本发布
- 实现核心监控功能
- 支持自动刷新和数据缓存
