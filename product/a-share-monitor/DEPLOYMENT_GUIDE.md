# A 股监控系统 - 部署指南

## 📋 系统概述

A 股监控系统是一个基于 Node.js 的股票数据监控和管理平台，提供以下功能：

- 📊 实时股票行情监控（涨停、跌停、强势股等）
- 📈 分时图和 K 线图展示
- 💼 自选股管理（支持分组）
- 📝 逐笔成交明细
- 👥 多用户支持
- ⏰ 定时任务调度

## 🗂️ 数据说明

### 数据库表结构

| 表名 | 说明 | 主要字段 |
|------|------|---------|
| `users` | 用户账户管理 | user_id, username, password, role, is_active |
| `custom_stocks` | 用户自选股 | user_id, stock_code, stock_market, type |
| `custom_groups` | 自选股分组 | user_id, name, icon, color, type |
| `securities` | 证券基础信息 | code, name, market, category, list_date |
| `tick_trade` | 逐笔成交数据 | stock_code, trade_date, time, price, volume |
| `scheduled_tasks` | 定时任务 | id, name, type, cron, status |

### 数据类型说明

#### 1. 用户数据 (users)
- **user_id**: 用户唯一标识
- **username**: 用户名（唯一）
- **password**: 密码（明文存储，建议生产环境加密）
- **role**: 角色（0=普通用户，1=管理员）
- **is_active**: 是否激活（1=激活，0=禁用）

#### 2. 自选股分组 (custom_groups)
- **type**: 分组类型
  - `type=0`: 持仓
  - `type=1`: 我的自选股（默认分组）
  - `type=2+`: 用户自定义分组
- **icon**: 分组图标（emoji）
- **color**: 分组颜色（十六进制）

#### 3. 自选股 (custom_stocks)
- **type**: 关联的分组类型（一对一关联）
- **stock_code**: 股票代码（不含市场前缀）
- **stock_market**: 市场（sh/sz/bj）

#### 4. 证券信息 (securities)
- **category**: 证券类别
  - 沪深 A 股
  - 基金 (ETF)
  - 可转债
  - 沪深指数
- **market**: 市场（sh/sz/bj）

## 🚀 快速部署

### 前置要求

- Node.js v16+ 
- npm 或 yarn
- SQLite3（自动安装）

### 1. 安装依赖

```bash
cd /root/.openclaw/workspace/product/a-share-monitor
npm install
```

### 2. 初始化数据库

```bash
node scripts/init-database.js
```

输出示例：
```
🚀 开始初始化 A 股监控系统数据库...

✅ 创建 users 表（用户管理）
✅ 创建 scheduled_tasks 表（定时任务）
✅ 创建 custom_stocks 表（自选股）
✅ 创建 securities 表（证券信息）
✅ 创建 tick_trade 表（逐笔成交）
✅ 创建 custom_groups 表（自选股分组）
✅ 创建 custom_stocks 索引
✅ 创建 tick_trade 索引
✅ 创建 custom_groups 索引
✅ 插入默认管理员账户：admin / admin123

🎉 数据库初始化完成!
📁 数据库文件：/root/.openclaw/workspace/product/a-share-monitor/data/users.db

📋 数据库表说明:
   - users: 用户账户管理
   - scheduled_tasks: 定时任务调度
   - custom_stocks: 用户自选股
   - custom_groups: 自选股分组
   - securities: 证券基础信息
   - tick_trade: 逐笔成交数据

🔐 默认管理员账户:
   用户名：admin
   密码：admin123

⚠️  请首次登录后修改密码!
```

### 3. 同步证券信息（可选）

```bash
node scripts/sync-securities.js
```

此脚本会从 MyData API 同步全市场证券信息到数据库。

### 4. 启动服务器

```bash
node src/server.js
```

或使用启动脚本：
```bash
./start.sh
```

### 5. 访问系统

浏览器访问：`http://localhost:3000`

默认管理员账户：
- 用户名：`admin`
- 密码：`admin123`

## 📦 数据备份与恢复

### 导出数据（备份）

```bash
node scripts/export-data.js
```

输出文件：
- `data/export/users.json` - 用户数据
- `data/export/custom_stocks.json` - 自选股数据
- `data/export/custom_groups.json` - 分组数据
- `data/export/securities.json` - 证券信息
- `data/export/scheduled_tasks.json` - 定时任务

### 导入数据（恢复）

```bash
node scripts/import-data.js
```

此脚本会从 `data/export/` 目录读取 JSON 文件并导入数据库。

## 🔧 脚本说明

| 脚本 | 用途 | 命令 |
|------|------|------|
| `init-database.js` | 初始化数据库表结构和默认数据 | `node scripts/init-database.js` |
| `sync-securities.js` | 从 MyData API 同步证券信息 | `node scripts/sync-securities.js` |
| `export-data.js` | 导出数据为 JSON（备份） | `node scripts/export-data.js` |
| `import-data.js` | 从 JSON 导入数据（恢复） | `node scripts/import-data.js` |

## 📁 目录结构

```
a-share-monitor/
├── data/                      # 数据目录
│   ├── users.db              # SQLite 数据库
│   └── export/               # 数据导出目录
├── scripts/                   # 部署脚本
│   ├── init-database.js      # 数据库初始化
│   ├── sync-securities.js    # 证券信息同步
│   ├── export-data.js        # 数据导出
│   └── import-data.js        # 数据导入
├── src/                       # 后端源码
│   ├── server.js             # 主服务器
│   ├── data-api.js           # 数据 API
│   ├── group-api.js          # 分组管理 API
│   └── ...
├── public/                    # 前端源码
│   ├── index.html            # 首页
│   ├── custom.html           # 自选股页面
│   ├── positions.html        # 持仓页面
│   ├── stock-detail/         # 股票详情页
│   └── js/                   # 前端 JS
├── docs/                      # 文档
├── DEPLOYMENT_GUIDE.md        # 部署指南（本文件）
├── package.json              # 项目配置
└── start.sh                  # 启动脚本
```

## ⚙️ 配置说明

### MyData API License

在 `src/server.js` 和其他 API 文件中配置：

```javascript
const MYDATA_LICENCE = 'FB1A859B-6832-4F70-AAA2-38274F23FC90';
```

### 服务器端口

默认端口：`3000`

修改端口：编辑 `src/server.js` 中的 `PORT` 变量

### 数据源说明

| 数据类型 | 数据源 | 更新频率 |
|---------|--------|---------|
| 实时行情 | MyData API | 实时 |
| 分时图 | MyData API（历史 + 实时） | 5 分钟/实时 |
| 逐笔成交 | MyData API | 交易时间实时，收盘后 T-1 |
| 证券信息 | MyData API | 手动同步 |

## 🔐 安全建议

1. **修改默认密码**：首次登录后立即修改 admin 账户密码
2. **启用 HTTPS**：生产环境建议使用反向代理（Nginx）配置 HTTPS
3. **数据库备份**：定期备份 `data/users.db` 文件
4. **API 限流**：MyData API 有调用限制，避免频繁请求

## 🐛 常见问题

### 1. 数据库初始化失败

**问题**: `Error: SQLITE_CANTOPEN`

**解决**: 确保 `data/` 目录有写权限
```bash
chmod 755 data/
```

### 2. 端口被占用

**问题**: `Error: listen EADDRINUSE: address already in use :::3000`

**解决**: 修改端口或关闭占用进程
```bash
# 查找占用进程
lsof -i :3000
# 关闭进程
kill -9 <PID>
```

### 3. API 调用失败

**问题**: 获取股票数据失败

**解决**: 
- 检查 MyData License 是否有效
- 检查网络连接
- 查看 `src/server.js` 中的错误日志

## 📞 技术支持

如有问题，请查看日志文件或联系系统管理员。

日志位置：`server.log`

---

**最后更新**: 2026-04-14
**版本**: v1.0.0
