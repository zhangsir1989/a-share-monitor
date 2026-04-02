# A 股监控系统 - 迁移文档

## 📁 项目位置

**项目根目录：** `/root/.openclaw-user1/workspace/project/a-share-monitor`

---

## 📂 文件结构

```
project/a-share-monitor/
├── src/
│   ├── server.js          # 主服务器（Express）
│   ├── data-api.js        # 数据接口（腾讯/新浪 API）
│   ├── sectors.js         # 板块数据
│   └── stocks.js          # 股票列表
├── public/
│   ├── index.html         # 首页
│   ├── stock.html         # 证券行情页
│   ├── css/
│   │   ├── style.css      # 首页样式
│   │   └── stock.css      # 行情页样式
│   └── js/
│       ├── app.js         # 首页逻辑
│       └── stock.js       # 行情页逻辑（含分时图）
├── cache/
│   └── market-data.json   # 缓存文件（自动创建）
├── package.json           # 依赖配置
└── package-lock.json      # 依赖锁定
```

---

## 🔧 依赖安装

```bash
cd /root/.openclaw-user1/workspace/project/a-share-monitor
npm install
```

**依赖列表：**
- `express` ^4.18.2 - Web 服务器
- `axios` ^1.6.0 - HTTP 请求
- `iconv-lite` ^0.7.2 - GBK 编码转换
- `node-cron` ^3.0.3 - 定时任务

**Node.js 版本要求：** >=16.0.0

---

## 🚀 服务启动

### 手动启动
```bash
cd /root/.openclaw-user1/workspace/project/a-share-monitor
node src/server.js
```

### 后台启动（生产环境）
```bash
nohup node src/server.js > /tmp/a-share.log 2>&1 &
```

### 停止服务
```bash
lsof -ti:3000 | xargs kill -9
# 或
pkill -f "node src/server.js"
```

---

## 🌐 访问地址

- **首页：** `http://localhost:3000`
- **证券行情：** `http://localhost:3000/stock`
- **API 接口：** `http://localhost:3000/api/all`

---

## 📡 数据源

### 实时数据
- **腾讯财经 API** - 个股行情、成交量
- **新浪财经 API** - 高换手率数据（备用）

### 公告数据（飞书通知）
- **巨潮资讯网** (cninfo.com.cn) - 证监会指定披露
- **上交所** (sse.com.cn)
- **深交所** (szse.cn)

---

## 📅 定时任务

### 1. A 股利好公告推送
**脚本位置：** `/root/.openclaw-user1/workspace/scripts/a-share-good-news.js`

**执行时间：** 每个交易日 20:00（UTC+8）

**推送渠道：** 飞书

**Cron 配置：**
```bash
# 编辑 crontab
crontab -e

# 添加任务（北京时间 20:00）
0 20 * * 1-5 cd /root/.openclaw-user1/workspace && node scripts/a-share-good-news.js
```

---

## ⚙️ 配置说明

### 服务器端口
- **默认端口：** 3000
- **修改位置：** `src/server.js` 第 13 行

### 缓存配置
- **缓存目录：** `cache/`
- **缓存文件：** `market-data.json`
- **缓存策略：** 每日收盘后保存，次日加载

### 刷新间隔
- **默认：** 3 秒
- **修改位置：** `public/js/app.js` 和 `public/js/stock.js`

---

## 🔍 关键功能

### 1. 首页监控 (`public/js/app.js`)
- 成交量（沪市/深市）
- 涨停板块 TOP10
- 板块资金流 TOP20
- 高换手率 TOP50

### 2. 证券行情 (`public/js/stock.js`)
- 股票搜索（支持代码/名称/拼音）
- 分时图绘制（Canvas）
- 可转债关联
- 自动刷新（3 秒）

### 3. 数据接口 (`src/data-api.js`)
- `fetchMarketVolume()` - 成交量
- `fetchLimitUpSectors()` - 涨停板块
- `fetchHighTurnover()` - 高换手率
- `fetchSectorCashflow()` - 资金流
- `fetchStockDetail()` - 个股详情
- `fetchIntradayData()` - 分时图数据
- `fetchConvertiblesForStock()` - 可转债

---

## 📝 修改记录

### 2026-04-01 修复
1. **000001 代码问题** - 默认上证指数（sh），非平安银行（sz）
2. **分时图优化** - 平滑曲线、动态 Y 轴、时间标签
3. **9:15 前数据清空** - 未开盘时不显示实时数据
4. **证券页定时刷新** - 3 秒自动刷新

---

## 🛠️ 故障排查

### 日志查看
```bash
# 实时日志
tail -f /tmp/a-share.log

# 最近 100 行
tail -100 /tmp/a-share.log
```

### 进程检查
```bash
# 查看进程
ps aux | grep "node src/server.js"

# 查看端口
netstat -tlnp | grep 3000
```

### API 测试
```bash
# 测试成交量接口
curl http://localhost:3000/api/all

# 测试个股查询
curl http://localhost:3000/api/stock/000001

# 测试分时图
curl http://localhost:3000/api/intraday/300014
```

---

## 📦 迁移步骤

### 1. 备份数据
```bash
# 备份整个项目
tar -czf a-share-monitor-backup-$(date +%Y%m%d).tar.gz \
  /root/.openclaw-user1/workspace/project/a-share-monitor
```

### 2. 新服务器安装
```bash
# 安装 Node.js（如未安装）
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 复制项目文件
scp -r /root/.openclaw-user1/workspace/project/a-share-monitor \
  user@new-server:/path/to/

# 安装依赖
cd /path/to/a-share-monitor
npm install
```

### 3. 启动服务
```bash
# 后台启动
nohup node src/server.js > /tmp/a-share.log 2>&1 &

# 验证
curl http://localhost:3000/api/all
```

### 4. 配置定时任务
```bash
# 迁移飞书通知脚本
scp /root/.openclaw-user1/workspace/scripts/a-share-good-news.js \
  user@new-server:/path/to/scripts/

# 配置 crontab
crontab -e
# 添加：0 20 * * 1-5 cd /path/to && node scripts/a-share-good-news.js
```

---

## 📞 联系方式

**负责人：** 营长
**用户：** 用户 1
**时区：** Asia/Shanghai

---

**文档生成时间：** 2026-04-01 02:03 UTC
