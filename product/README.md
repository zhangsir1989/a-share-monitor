# 系统目录结构说明

## 📁 总目录

**位置：** `/root/.openclaw-user1/workspace/systems/`

---

## 1️⃣ A 股实时监控系统

**文件夹：** `a-share-monitor/`

**功能：** 实时监控 A 股市场数据，提供可视化监控界面

### 目录结构
```
a-share-monitor/
├── src/                      # 后端源代码
│   ├── server.js            # Express 服务器
│   ├── data-api.js          # 数据接口层
│   ├── sectors.js           # 板块分类数据
│   └── stocks.js            # 股票列表数据
├── public/                   # 前端静态文件
│   ├── index.html           # 首页
│   ├── stock.html           # 行情页
│   ├── css/
│   │   ├── style.css        # 首页样式
│   │   └── stock.css        # 行情页样式
│   └── js/
│       ├── app.js           # 首页逻辑
│       └── stock.js         # 行情页逻辑
├── cache/                    # 缓存目录
│   └── market-data.json     # 市场数据缓存
├── docs/                     # 需求文档
│   ├── 系统需求功能说明.doc  # Word 版需求文档
│   ├── 系统需求功能说明.md   # Markdown 版需求文档
│   ├── 系统需求功能说明-v2.1.html  # HTML 版需求文档
│   ├── 功能对比和更新说明.md # 功能对比文档
│   └── requirements.md      # 英文需求文档
├── node_modules/             # 依赖包
├── package.json             # 依赖配置
└── 启动脚本
    ├── start.sh             # Linux 启动脚本
    └── start.bat            # Windows 启动脚本
```

### 启动方式
```bash
cd /root/.openclaw-user1/workspace/systems/a-share-monitor
node src/server.js
```

### 访问地址
- 首页：`http://localhost:3000`
- 行情：`http://localhost:3000/stock`

---

## 2️⃣ A 股利好公告推送系统

**文件夹：** `a-share-news-pusher/`

**功能：** 自动抓取 A 股上市公司利好公告，通过飞书推送

### 目录结构
```
a-share-news-pusher/
├── a-share-good-news.js     # 主脚本
└── docs/                     # 需求文档
    └── requirements.md      # 系统需求文档
```

### 启动方式
```bash
# 手动执行
cd /root/.openclaw-user1/workspace/systems/a-share-news-pusher
node a-share-good-news.js

# 定时任务（已配置）
# 每个交易日 20:00 自动执行
```

### 定时任务
```bash
# 查看配置
crontab -l

# 输出：
0 20 * * 1-5 cd /root/.openclaw-user1/workspace/systems/a-share-news-pusher && node a-share-good-news.js
```

---

## 📊 系统对比

| 项目 | A 股监控系统 | A 股利好推送系统 |
|------|-------------|-----------------|
| **英文名** | a-share-monitor | a-share-news-pusher |
| **类型** | Web 应用 | 定时脚本 |
| **端口** | 3000 | 无 |
| **运行方式** | 持续运行 | 定时执行 |
| **执行时间** | 交易时间实时 | 交易日 20:00 |
| **推送渠道** | 无 | 飞书 |
| **依赖** | Express/Axios 等 | 无（原生模块） |
| **文件数** | ~1050 | 2 |

---

## 📝 文档位置

### A 股监控系统文档
| 文档名称 | 路径 |
|---------|------|
| 系统需求功能说明.doc | `a-share-monitor/docs/系统需求功能说明.doc` |
| 系统需求功能说明.md | `a-share-monitor/docs/系统需求功能说明.md` |
| 系统需求功能说明-v2.1.html | `a-share-monitor/docs/系统需求功能说明-v2.1.html` |
| 功能对比和更新说明.md | `a-share-monitor/docs/功能对比和更新说明.md` |
| requirements.md (英文) | `a-share-monitor/docs/requirements.md` |
| MIGRATION.md | `a-share-monitor/MIGRATION.md` |

### A 股利好推送系统文档
| 文档名称 | 路径 |
|---------|------|
| requirements.md | `a-share-news-pusher/docs/requirements.md` |

---

## 🔧 维护命令

### A 股监控系统
```bash
# 启动
cd /root/.openclaw-user1/workspace/systems/a-share-monitor
node src/server.js

# 后台启动
nohup node src/server.js > /tmp/a-share-monitor.log 2>&1 &

# 停止
lsof -ti:3000 | xargs kill -9

# 查看日志
tail -f /tmp/a-share-monitor.log
```

### A 股利好推送系统
```bash
# 手动执行
cd /root/.openclaw-user1/workspace/systems/a-share-news-pusher
node a-share-good-news.js

# 查看定时任务
crontab -l

# 修改定时任务
crontab -e
```

---

## ✅ 整理完成

- ✅ 两个系统已分离到独立文件夹
- ✅ 每个系统都有英文名称
- ✅ 每个系统都有 `docs/` 需求文档文件夹
- ✅ 所有需求文档已移植到对应目录
- ✅ 旧目录已清理
- ✅ 定时任务已更新路径

---

**整理时间：** 2026-04-01 03:03 UTC
