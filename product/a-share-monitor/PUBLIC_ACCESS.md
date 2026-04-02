# 公网访问配置指南

## 方案一：云服务器直接访问（推荐）

如果你有云服务器（阿里云、腾讯云、华为云等）：

### 1. 配置安全组/防火墙

在云控制台开放 3000 端口：

**阿里云：**
- 控制台 → 云服务器 ECS → 安全组 → 配置规则
- 添加规则：端口 3000，授权对象 0.0.0.0/0

**腾讯云：**
- 控制台 → 云服务器 → 安全组 → 防火墙
- 添加规则：TCP 3000，来源 0.0.0.0/0

**华为云：**
- 控制台 → 弹性云服务器 → 安全组 → 入站规则
- 添加规则：端口 3000，源地址 0.0.0.0/0

### 2. 启动服务

```bash
cd /root/.openclaw-user1/workspace/project/a-share-monitor
npm start
```

### 3. 访问地址

```
http://<你的公网 IP>:3000
```

---

## 方案二：内网穿透（适用于家庭宽带/无公网 IP）

### 2.1 使用 Cloudflare Tunnel（免费推荐）

```bash
# 1. 安装 cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared

# 2. 创建隧道（需要 Cloudflare 账号）
cloudflared tunnel login

# 3. 创建隧道
cloudflared tunnel create a-share-monitor

# 4. 配置隧道
cat > ~/.cloudflared/config.yml << EOF
tunnel: a-share-monitor
credentials-file: /root/.cloudflared/xxx.json
ingress:
  - hostname: a-share.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
EOF

# 5. 启动隧道
cloudflared tunnel run a-share-monitor
```

访问地址：`https://a-share.yourdomain.com`

### 2.2 使用 frp（需要 VPS）

**VPS 端配置（frps.ini）：**
```ini
[common]
bind_port = 7000
token = your_secret_token
```

**本地端配置（frpc.ini）：**
```ini
[common]
server_addr = <VPS 公网 IP>
server_port = 7000
token = your_secret_token

[a-share-monitor]
type = tcp
local_ip = 127.0.0.1
local_port = 3000
remote_port = 3000
```

**启动：**
```bash
# VPS 端
./frps -c frps.ini

# 本地端
./frpc -c frpc.ini
```

访问地址：`http://<VPS 公网 IP>:3000`

### 2.3 使用 ngrok（快速测试）

```bash
# 下载 ngrok
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar xzf ngrok-v3-stable-linux-amd64.tgz

# 启动（需要注册获取 authtoken）
./ngrok config add-authtoken <your_token>
./ngrok http 3000
```

访问地址：`https://xxx.ngrok.io`（临时域名）

---

## 方案三：使用 Nginx 反向代理（生产环境推荐）

### 1. 安装 Nginx

```bash
sudo apt-get update
sudo apt-get install nginx -y
```

### 2. 配置 Nginx

```bash
sudo nano /etc/nginx/sites-available/a-share-monitor
```

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名或公网 IP

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 3. 启用配置

```bash
sudo ln -s /etc/nginx/sites-available/a-share-monitor /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. 配置 HTTPS（可选，使用 Let's Encrypt）

```bash
sudo apt-get install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

---

## 方案四：使用 PM2 后台运行（生产环境）

### 1. 安装 PM2

```bash
npm install -g pm2
```

### 2. 启动服务

```bash
cd /root/.openclaw-user1/workspace/project/a-share-monitor
pm2 start src/server.js --name a-share-monitor
```

### 3. 设置开机自启

```bash
pm2 startup
pm2 save
```

### 4. 管理命令

```bash
pm2 status          # 查看状态
pm2 logs            # 查看日志
pm2 restart a-share-monitor  # 重启
pm2 stop a-share-monitor     # 停止
```

---

## 安全建议

### 1. 添加访问密码（简单认证）

修改 `src/server.js`，在文件开头添加：

```javascript
// 添加基础认证
const USERNAME = 'admin';
const PASSWORD = 'your_password';  // 修改为强密码

app.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Access"');
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

### 2. 配置防火墙（Linux）

```bash
# 允许 3000 端口
sudo ufw allow 3000/tcp

# 查看状态
sudo ufw status
```

### 3. 限制访问 IP（可选）

在 Nginx 配置中添加：

```nginx
location / {
    allow 192.168.1.0/24;  # 允许特定网段
    deny all;              # 拒绝其他
    proxy_pass http://127.0.0.1:3000;
}
```

---

## 快速检查清单

- [ ] 确认服务器有公网 IP 或已配置内网穿透
- [ ] 开放防火墙/安全组 3000 端口
- [ ] 测试本地访问正常（http://localhost:3000）
- [ ] 测试公网 IP 访问
- [ ] （可选）配置域名和 HTTPS
- [ ] （可选）添加访问认证
- [ ] （推荐）使用 PM2 后台运行

---

## 常见问题

### Q: 端口被占用怎么办？
A: 修改 `src/server.js` 中的 `PORT = 3000` 为其他端口

### Q: 如何查看公网 IP？
A: 运行 `curl ifconfig.me` 或在云控制台查看

### Q: 访问速度慢怎么办？
A: 考虑使用 CDN 或选择离用户更近的服务器区域

### Q: 如何限制访问频率？
A: 安装 `express-rate-limit` 中间件进行限流
