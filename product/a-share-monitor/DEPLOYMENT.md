# 🎉 A 股实时监控系统 - 公网访问配置完成

## ✅ 配置状态

| 项目 | 状态 |
|------|------|
| 服务运行 | ✅ 正常（PM2 管理） |
| 防火墙 | ✅ 已开放 3000 端口 |
| 开机自启 | ✅ 已配置 |
| 公网访问 | ✅ 已就绪 |

---

## 🌐 访问地址

### 公网访问
```
http://118.89.125.15:3000
```

### 局域网访问
```
http://10.0.0.17:3000
```

### 本地访问
```
http://localhost:3000
```

---

## 📋 PM2 管理命令

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs a-share-monitor

# 重启服务
pm2 restart a-share-monitor

# 停止服务
pm2 stop a-share-monitor

# 删除服务
pm2 delete a-share-monitor

# 查看监控
pm2 monit
```

---

## 🔧 常用操作

### 更新代码后重启
```bash
cd /root/.openclaw-user1/workspace/project/a-share-monitor
git pull  # 如果有更新
pm2 restart a-share-monitor
```

### 查看实时日志
```bash
pm2 logs a-share-monitor --lines 50
```

### 修改端口
编辑 `src/server.js`，修改 `PORT = 3000` 为其他端口，然后：
```bash
# 开放新端口
iptables -I INPUT -p tcp --dport 新端口 -j ACCEPT

# 重启服务
pm2 restart a-share-monitor
```

---

## 🔒 安全建议

### 1. 添加访问密码（推荐）

编辑 `src/server.js`，在 `const app = express();` 后添加：

```javascript
// 基础认证配置
const USERNAME = 'admin';
const PASSWORD = 'YourStrongPassword123!';  // 修改为强密码

app.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) {
    res.setHeader('WWW-Authenticate', 'Basic realm="A 股监控"');
    return res.status(401).send('需要认证');
  }
  const base64 = auth.split(' ')[1];
  const [user, pass] = Buffer.from(base64, 'base64').toString().split(':');
  if (user !== USERNAME || pass !== PASSWORD) {
    return res.status(401).send('认证失败');
  }
  next();
});
```

然后重启：
```bash
pm2 restart a-share-monitor
```

### 2. 限制访问 IP（可选）

如果只允许特定 IP 访问：
```bash
# 删除开放的 3000 端口
iptables -D INPUT -p tcp --dport 3000 -j ACCEPT

# 只允许特定 IP
iptables -A INPUT -p tcp -s 允许访问的 IP --dport 3000 -j ACCEPT
```

### 3. 配置 HTTPS（可选）

使用 Nginx + Let's Encrypt：
```bash
# 安装 Nginx
yum install nginx -y  # OpenCloudOS/CentOS

# 配置 Nginx 反向代理
# /etc/nginx/conf.d/a-share.conf
server {
    listen 80;
    server_name your-domain.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# 启动 Nginx
systemctl start nginx
systemctl enable nginx
```

---

## 📊 系统信息

- **服务器 IP**: 118.89.125.15
- **操作系统**: OpenCloudOS 9.4
- **Node.js**: v22.14.0
- **PM2**: 已安装
- **服务端口**: 3000
- **工作目录**: `/root/.openclaw-user1/workspace/project/a-share-monitor`

---

## 🐛 故障排查

### 无法访问？

1. 检查服务状态：
   ```bash
   pm2 status
   ```

2. 检查端口监听：
   ```bash
   netstat -tlnp | grep 3000
   ```

3. 检查防火墙：
   ```bash
   iptables -L -n | grep 3000
   ```

4. 查看日志：
   ```bash
   pm2 logs a-share-monitor
   ```

### 服务崩溃？

```bash
# 重启服务
pm2 restart a-share-monitor

# 查看崩溃日志
pm2 logs a-share-monitor --err
```

### 内存占用高？

```bash
# 查看资源使用
pm2 monit

# 重启释放内存
pm2 restart a-share-monitor
```

---

## 📝 日常维护

### 每日检查
```bash
# 服务状态
pm2 status

# 最新日志
pm2 logs a-share-monitor --lines 20
```

### 每周重启（释放内存）
```bash
pm2 restart a-share-monitor
```

### 更新数据缓存
缓存文件位置：`/root/.openclaw-user1/workspace/project/a-share-monitor/cache/`

---

## 📞 技术支持

如遇问题，查看以下日志：
- PM2 日志：`~/.pm2/logs/a-share-monitor-out.log`
- 错误日志：`~/.pm2/logs/a-share-monitor-error.log`
- 应用日志：`/root/.openclaw-user1/workspace/project/a-share-monitor/server.log`

---

**配置完成时间**: 2026-03-31 02:32 UTC
**配置文档**: `/root/.openclaw-user1/workspace/project/a-share-monitor/DEPLOYMENT.md`
