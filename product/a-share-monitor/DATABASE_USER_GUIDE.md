# 🗄️ SQLite 数据库用户管理系统

## 📋 概述

A 股实时监控系统现已集成 SQLite 数据库用户管理，所有用户信息存储在本地数据库文件中。

---

## 📁 数据库位置

**路径：** `/root/.openclaw/workspace/product/a-share-monitor/data/users.db`

**备份建议：** 定期备份此文件以防数据丢失

---

## 📊 用户表结构

### 表名：`users`

| 字段 | 类型 | 长度 | 说明 | 约束 |
|------|------|------|------|------|
| `user_id` | VARCHAR | 12 位 | 用户编号（登录账号） | 主键，NOT NULL |
| `password` | VARCHAR | 12 位 | 密码 | NOT NULL |
| `username` | VARCHAR | 50 位 | 用户昵称/姓名 | NOT NULL |
| `created_at` | DATETIME | - | 创建时间 | 默认 CURRENT_TIMESTAMP |
| `last_login` | DATETIME | - | 最后登录时间 | 可选 |
| `is_active` | INTEGER | - | 是否激活 (1=是，0=否) | 默认 1 |

---

## 👤 默认管理员账户

| 用户编号 | 密码 | 用户名 | 状态 |
|---------|------|--------|------|
| `zhangsir` | `111111` | 管理员 | ✅ 激活 |

⚠️ **安全提示**：首次登录后建议修改默认密码！

---

## 🛠️ 用户管理工具

### 位置
`/root/.openclaw/workspace/product/a-share-monitor/user-manager.js`

### 使用方法

#### 1️⃣ 查看所有用户
```bash
cd /root/.openclaw/workspace/product/a-share-monitor
/usr/local/node-v22.14.0-linux-x64/bin/node user-manager.js list
```

**输出示例：**
```
👥 用户列表:

用户编号           用户名            状态      创建时间                  最后登录
────────────────────────────────────────────────────────────────────────────────
zhangsir       管理员            ✓ 激活    2026-04-03 14:21:14   2026-04-03 14:22:15
```

---

#### 2️⃣ 添加新用户
```bash
/usr/local/node-v22.14.0-linux-x64/bin/node user-manager.js add <用户编号> <密码> <用户名>
```

**示例：**
```bash
/usr/local/node-v22.14.0-linux-x64/bin/node user-manager.js add admin 123456 系统管理员
/usr/local/node-v22.14.0-linux-x64/bin/node user-manager.js add user001 888888 张三
```

**约束：**
- 用户编号：最多 12 位字符
- 密码：最多 12 位字符
- 用户名：最多 50 位字符

---

#### 3️⃣ 重置密码
```bash
/usr/local/node-v22.14.0-linux-x64/bin/node user-manager.js reset <用户编号> <新密码>
```

**示例：**
```bash
/usr/local/node-v22.14.0-linux-x64/bin/node user-manager.js reset zhangsir 888888
```

---

#### 4️⃣ 删除用户
```bash
/usr/local/node-v22.14.0-linux-x64/bin/node user-manager.js del <用户编号>
```

**示例：**
```bash
/usr/local/node-v22.14.0-linux-x64/bin/node user-manager.js del user001
```

⚠️ **警告**：删除后无法恢复！

---

#### 5️⃣ 禁用用户
```bash
/usr/local/node-v22.14.0-linux-x64/bin/node user-manager.js disable <用户编号>
```

**示例：**
```bash
/usr/local/node-v22.14.0-linux-x64/bin/node user-manager.js disable user001
```

被禁用的用户无法登录，但数据保留在数据库中。

---

#### 6️⃣ 启用用户
```bash
/usr/local/node-v22.14.0-linux-x64/bin/node user-manager.js enable <用户编号>
```

**示例：**
```bash
/usr/local/node-v22.14.0-linux-x64/bin/node user-manager.js enable user001
```

---

## 🔧 直接 SQL 操作（高级）

如需直接操作数据库，可使用 SQLite 命令行工具：

```bash
# 连接数据库
sqlite3 /root/.openclaw/workspace/product/a-share-monitor/data/users.db

# 查看所有用户
SELECT * FROM users;

# 添加用户
INSERT INTO users (user_id, password, username) VALUES ('newuser', '123456', '新用户');

# 修改密码
UPDATE users SET password = '888888' WHERE user_id = 'zhangsir';

# 禁用用户
UPDATE users SET is_active = 0 WHERE user_id = 'user001';

# 删除用户
DELETE FROM users WHERE user_id = 'user001';

# 退出
.quit
```

---

## 🔐 登录验证流程

```
用户输入账号密码
       ↓
查询 users 表
       ↓
检查 user_id 是否存在 AND is_active = 1
       ↓
验证 password 是否匹配
       ↓
✓ 成功 → 创建会话，更新 last_login
✗ 失败 → 返回错误信息
```

---

## 📝 使用场景示例

### 场景 1：添加新员工
```bash
# 添加用户
/usr/local/node-v22.14.0-linux-x64/bin/node user-manager.js add li4 654321 李四

# 验证添加成功
/usr/local/node-v22.14.0-linux-x64/bin/node user-manager.js list
```

### 场景 2：员工忘记密码
```bash
# 重置密码
/usr/local/node-v22.14.0-linux-x64/bin/node user-manager.js reset li4 888888

# 通知新员工密码
```

### 场景 3：员工离职
```bash
# 禁用账户（推荐，保留数据）
/usr/local/node-v22.14.0-linux-x64/bin/node user-manager.js disable li4

# 或删除账户（彻底删除）
/usr/local/node-v22.14.0-linux-x64/bin/node user-manager.js del li4
```

### 场景 4：批量添加用户
```bash
#!/bin/bash
# batch-add.sh

/usr/local/node-v22.14.0-linux-x64/bin/node user-manager.js add user001 111111 用户一
/usr/local/node-v22.14.0-linux-x64/bin/node user-manager.js add user002 222222 用户二
/usr/local/node-v22.14.0-linux-x64/bin/node user-manager.js add user003 333333 用户三

echo "批量添加完成！"
```

---

## 🛡️ 安全建议

### 1. 密码管理
- ✅ 定期更换密码（建议每 3 个月）
- ✅ 使用复杂密码（数字 + 字母组合）
- ❌ 不要使用默认密码
- ❌ 不要在多个系统使用相同密码

### 2. 账户管理
- ✅ 离职员工立即禁用账户
- ✅ 定期检查不活跃账户
- ✅ 限制管理员账户数量
- ❌ 不要共享账户

### 3. 数据库备份
```bash
# 备份数据库
cp /root/.openclaw/workspace/product/a-share-monitor/data/users.db \
   /root/.openclaw/workspace/product/a-share-monitor/data/users.db.backup.$(date +%Y%m%d)

# 恢复数据库
cp /root/.openclaw/workspace/product/a-share-monitor/data/users.db.backup.20260403 \
   /root/.openclaw/workspace/product/a-share-monitor/data/users.db
```

### 4. 日志审计
查看服务器日志了解登录情况：
```bash
tail -f /root/.openclaw/workspace/product/a-share-monitor/server.log | grep "登录"
```

---

## 📊 数据库维护

### 查看数据库文件大小
```bash
ls -lh /root/.openclaw/workspace/product/a-share-monitor/data/users.db
```

### 数据库完整性检查
```bash
sqlite3 /root/.openclaw/workspace/product/a-share-monitor/data/users.db "PRAGMA integrity_check;"
```

### 优化数据库
```bash
sqlite3 /root/.openclaw/workspace/product/a-share-monitor/data/users.db "VACUUM;"
```

---

## 🐛 故障排除

### 问题 1：登录提示"用户名或密码错误"
**解决：**
1. 确认用户是否存在：`node user-manager.js list`
2. 确认用户是否激活：检查状态是否为"✓ 激活"
3. 重置密码：`node user-manager.js reset <user_id> <new_password>`

### 问题 2：数据库文件损坏
**解决：**
1. 从备份恢复：`cp users.db.backup users.db`
2. 重新初始化：`node init-db.js`

### 问题 3：无法添加用户
**解决：**
1. 检查用户编号是否重复
2. 检查密码长度是否超过 12 位
3. 检查数据库文件权限：`ls -l data/users.db`

---

## 📝 更新日志

**2026-04-03**
- ✅ 集成 SQLite 数据库
- ✅ 创建用户表（6 个字段）
- ✅ 添加默认管理员账户
- ✅ 实现数据库登录验证
- ✅ 开发用户管理工具
- ✅ 记录最后登录时间

---

## 📞 技术支持

如有问题，请查看：
- 服务器日志：`server.log`
- 数据库文件：`data/users.db`
- 管理工具：`user-manager.js`

---

**文档版本：** v1.0  
**更新时间：** 2026-04-03
