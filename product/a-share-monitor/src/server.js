const express = require('express');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const initSqlJs = require('sql.js');
const {
  fetchMarketVolume,
  fetchLimitUpSectors,
  fetchHighTurnover,
  fetchSectorCashflow,
  fetchLimitUpStocks,
  fetchLimitDownStocks,
  fetchStrongStocks,
  fetchBreakBoardStocks,
  fetchNewBaseStocks,
  fetchStockDetail,
  fetchIntradayData,
  fetchConvertiblesForStock,
  fetchSectorStocks,
  fetchMainIndices,
  getDataSourceStatus,
  fetchIntradayHistory,
  fetchStockLatest
} = require('./data-api');
const stockList = require('./stocks');

const app = express();
const PORT = 3000;

// 数据库连接
let db = null;
let syncSecurities = null;
let syncTickTrade = null;
let tickTradeSetAbort = null;
let tickTradeGetAbortStatus = null;
const DB_PATH = path.join(__dirname, '../data/users.db');

// 初始化数据库连接
async function initDatabase() {
  const SQL = await initSqlJs();
  
  // 如果数据库文件不存在，自动创建
  if (!fs.existsSync(DB_PATH)) {
    console.log('⚠️  数据库文件不存在，自动创建:', DB_PATH);
    db = new SQL.Database();
    // 创建 users 表
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT '0',
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )
    `);
    // 插入默认管理员账户
    db.run(`INSERT INTO users (user_id, username, password, role, is_active) VALUES ('admin', 'admin', 'admin123', '1', 1)`);
    
    // 创建定时任务表
    db.run(`
      CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        cron TEXT NOT NULL,
        status INTEGER DEFAULT 1,
        last_run DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ 定时任务表已创建');
    
    // 创建自选股表
    db.run(`
      CREATE TABLE IF NOT EXISTS custom_stocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        stock_code TEXT NOT NULL,
        stock_market TEXT NOT NULL,
        type INTEGER DEFAULT 0,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, stock_code, stock_market, type)
      )
    `);
    console.log('✅ 自选股表已创建');
    
    // 创建证券信息表
    db.run(`
      CREATE TABLE IF NOT EXISTS securities (
        code TEXT PRIMARY KEY,
        name TEXT,
        market TEXT,
        category TEXT,
        list_date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ 证券信息表已创建');
    
    // 创建逐笔成交表
    db.run(`
      CREATE TABLE IF NOT EXISTS tick_trade (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_code TEXT NOT NULL,
        trade_date TEXT NOT NULL,
        time TEXT NOT NULL,
        price REAL,
        volume INTEGER,
        amount REAL,
        direction TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.run(`CREATE INDEX IF NOT EXISTS idx_tick_code_date ON tick_trade(stock_code, trade_date)`);
    console.log('✅ 逐笔成交表已创建');
    saveDatabase();
    console.log('✅ 数据库创建成功，默认用户：admin / admin123');
  } else {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('✓ 数据库连接成功:', DB_PATH);
  }
  
  // 确保所有表都存在（无论数据库是新创建还是已存在）
  db.run(`
    CREATE TABLE IF NOT EXISTS custom_stocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      stock_code TEXT NOT NULL,
      stock_market TEXT NOT NULL,
      type INTEGER DEFAULT 0,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, stock_code, stock_market, type)
    )
  `);
  console.log('✅ 自选股表已检查');
  
  db.run(`
    CREATE TABLE IF NOT EXISTS securities (
      code TEXT PRIMARY KEY,
      name TEXT,
      market TEXT,
      category TEXT,
      list_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ 证券信息表已检查');
  
  db.run(`
    CREATE TABLE IF NOT EXISTS tick_trade (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_code TEXT NOT NULL,
      trade_date TEXT NOT NULL,
      time TEXT NOT NULL,
      price REAL,
      volume INTEGER,
      amount REAL,
      direction TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tick_code_date ON tick_trade(stock_code, trade_date)`);
  console.log('✅ 逐笔成交表已检查');
  
  // 保存表结构到数据库文件
  saveDatabase();
  console.log('✅ 数据库表结构已保存');
  
  // 初始化证券同步函数
  // 使用 MyData API 同步模块
  const syncSecuritiesModule = require('./sync-securities-mydata');
  syncSecurities = syncSecuritiesModule.syncAllSecurities;
  console.log('✅ 证券同步功能已初始化（MyData API）');
  
  // 初始化逐笔成交同步函数
  const syncTickTradeModule = require('./sync-ticktrade-mydata');
  syncTickTrade = syncTickTradeModule.syncAllTickTrade;
  tickTradeSetAbort = syncTickTradeModule.setAbort;
  tickTradeGetAbortStatus = syncTickTradeModule.getAbortStatus;
  console.log('✅ 逐笔成交同步功能已初始化（MyData API）');
  
  // 加载并调度数据库中的定时任务
  loadScheduledTasks();
}

// 保存数据库到文件
function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// JSON 解析中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 会话中间件配置
app.use(session({
  secret: 'a-share-monitor-secret-key-2026-fixed',  // 固定密钥，防止重启后 session 失效
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,  // 生产环境设为 true
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000  // 24 小时
  }
}));

// 认证中间件
function requireAuth(req, res, next) {
  if (req.session && req.session.isAuthenticated) {
    return next();
  }
  // 如果是 API 请求，返回 JSON 错误
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ success: false, message: '未登录' });
  }
  // 重定向到登录页
  res.redirect(`/login.html?redirect=${encodeURIComponent(req.originalUrl)}`);
}

// 数据缓存
let marketData = {
  volume: null,
  limitUpSectors: null,
  highTurnover: null,
  sectorCashflow: null,
  lastUpdate: null
};

// 缓存文件路径
const CACHE_DIR = path.join(__dirname, '../cache');
const CACHE_FILE = path.join(CACHE_DIR, 'market-data.json');

// 确保缓存目录存在
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// 加载缓存（支持加载昨天缓存，用于早盘或非交易日）
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf8');
      const cached = JSON.parse(data);
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      
      // 加载今天或昨天的缓存
      if (cached.date === today || cached.date === yesterday) {
        marketData = cached.data;
        marketData.isCached = true; // 标记为缓存数据
        marketData.cachedDate = cached.date;
        console.log('✓ 已加载缓存数据:', cached.date);
      }
    }
  } catch (e) {
    console.error('加载缓存失败:', e.message);
  }
}

// 保存缓存
function saveCache() {
  try {
    const data = {
      date: new Date().toDateString(),
      timestamp: Date.now(),
      data: marketData
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
    console.log('✓ 已保存缓存数据');
  } catch (e) {
    console.error('保存缓存失败:', e.message);
  }
}

// 判断是否在交易时间
function isTradingTime() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  
  if (day === 0 || day === 6) return false;
  if (hour === 9 && minute >= 30) return true;
  if (hour === 10) return true;
  if (hour === 11 && minute <= 30) return true;
  if (hour === 13) return true;
  if (hour === 14) return true;
  if (hour === 15 && minute === 0) return true;
  
  return false;
}

// 判断是否收盘时间
function isCloseToClose() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  return hour === 14 && minute >= 59;
}

// 获取最近交易日（处理周末）
/**
 * 获取最近交易日
 * 逻辑：
 * - 周一至周五：使用今天（交易日当天从开盘就有实时数据）
 * - 周六/周日：使用上周五
 */
function getLatestTradeDate() {
  // 系统时间已是北京时间（CST/UTC+8），直接使用
  const beijingTime = new Date();
  const weekday = beijingTime.getDay();
  
  // 周日，使用周五
  if (weekday === 0) {
    const friday = new Date(beijingTime);
    friday.setDate(beijingTime.getDate() - 2);
    console.log("📅 周日，使用周五:", friday.toISOString().split('T')[0]);
    return friday.toISOString().split('T')[0];
  }
  
  // 周六，使用周五
  if (weekday === 6) {
    const friday = new Date(beijingTime);
    friday.setDate(beijingTime.getDate() - 1);
    console.log("📅 周六，使用周五:", friday.toISOString().split('T')[0]);
    return friday.toISOString().split('T')[0];
  }
  
  // 周一至周五（交易日），使用今天
  const today = beijingTime.toISOString().split('T')[0];
  console.log("📅 交易日，使用今天:", today);
  return today;
}

// 获取全部数据
async function fetchAllData(tradeDate = null) {
  console.log('📡 开始获取实时数据...', tradeDate ? `(日期：${tradeDate})` : '');
  console.log('🔍 开始获取炸板个股...');
  console.log('🔍 开始获取次新个股...');
  
  // 如果指定日期 API 返回 404，自动回退到最近交易日
  let effectiveDate = tradeDate;
  if (tradeDate) {
    try {
      const testUrl = `https://api.mairuiapi.com/hslt/ztgc/${tradeDate.replace(/-/g, '')}/FB1A859B-6832-4F70-AAA2-38274F23FC90`;
      const axios = require('axios');
      const resp = await axios.get(testUrl, { timeout: 5000 });
      if (resp.status === 404 || (resp.data && typeof resp.data === 'string' && resp.data.includes('404'))) {
        console.log('⚠️  API 返回 404，自动回退到最近交易日');
        effectiveDate = null; // 使用 getLatestTradeDate() 计算
      }
    } catch (e) {
      // API 调用失败，使用回退逻辑
      console.log('⚠️  API 测试失败，使用回退逻辑');
      effectiveDate = null;
    }
  }
  
  const [volume, highTurnover, limitUpStocks, limitDownStocks, strongStocks, breakBoardStocks, newBaseStocks] = await Promise.all([
    fetchMarketVolume(),
    fetchHighTurnover(),
    fetchLimitUpStocks(effectiveDate),
    fetchLimitDownStocks(effectiveDate),
    fetchStrongStocks(effectiveDate),
    fetchBreakBoardStocks(effectiveDate),
    fetchNewBaseStocks(effectiveDate)
  ]);
  
  console.log('炸板个股结果:', breakBoardStocks ? breakBoardStocks.length : 'null');
  console.log('次新个股结果:', newBaseStocks ? newBaseStocks.length : 'null');
  
  marketData = {
    volume,
    highTurnover,
    limitUpStocks,
    limitDownStocks,
    strongStocks,
    breakBoardStocks,
    newBaseStocks,
    lastUpdate: new Date().toISOString(),
    tradeDate: tradeDate || await getLatestTradeDate()
  };
  
  console.log('✓ 数据获取完成');
  if (volume) {
    console.log(`  总成交额：${volume.totalAmount} 亿元`);
  }
  if (limitUpStocks && limitUpStocks.length > 0) {
    console.log(`  涨停个股：${limitUpStocks.length} 只`);
  }
  if (limitDownStocks && limitDownStocks.length > 0) {
    console.log(`  跌停个股：${limitDownStocks.length} 只`);
  }
  if (strongStocks && strongStocks.length > 0) {
    console.log(`  强势个股：${strongStocks.length} 只`);
  }
  if (breakBoardStocks && breakBoardStocks.length > 0) {
    console.log(`  炸板个股：${breakBoardStocks.length} 只`);
  }
  if (newBaseStocks && newBaseStocks.length > 0) {
    console.log(`  次新个股：${newBaseStocks.length} 只`);
  }
  if (highTurnover && highTurnover.length > 0) {
    console.log(`  高换手率：${highTurnover.length} 只`);
  }
  
  return marketData;
}

// ==================== 定时任务调度器 ====================
const taskSchedulers = {};

// 将简化的时间格式转换为 cron 表达式（如 "0800" → "0 8 * * *"）
function convertToCron(timeStr) {
  if (!timeStr) return '* * * * *';
  
  // 如果已经是标准 cron 格式（包含空格）
  if (timeStr.includes(' ')) {
    return timeStr;
  }
  
  // 处理 HHMM 格式（如 0800 → 0 8 * * *）
  const match = timeStr.match(/^(\d{2})(\d{2})$/);
  if (match) {
    const hour = parseInt(match[1]);
    const minute = parseInt(match[2]);
    return `${minute} ${hour} * * *`;
  }
  
  // 默认每分钟
  return '* * * * *';
}

// 加载并调度数据库中的定时任务
function loadScheduledTasks() {
  try {
    const result = db.exec('SELECT * FROM scheduled_tasks WHERE status = 1');
    if (result.length === 0) {
      console.log('📅 没有启用的定时任务');
      return;
    }
    
    const tasks = result[0].values.map(row => ({
      id: row[0],
      name: row[1],
      type: row[2],
      cron: row[3],
      status: row[4]
    }));
    
    tasks.forEach(task => {
      // 清理旧的调度器
      if (taskSchedulers[task.id]) {
        taskSchedulers[task.id].stop();
        console.log(`🛑 停止任务：${task.name}`);
      }
      
      // 转换 cron 表达式
      const cronExpr = convertToCron(task.cron);
      
      // 创建新的调度器
      taskSchedulers[task.id] = cron.schedule(cronExpr, async () => {
        console.log(`⏰ 执行定时任务：${task.name} (${task.type})`);
        
        if (task.type === 'sync-securities') {
          try {
            const result = await syncSecurities(db);
            console.log('✅ 证券同步完成:', result);
            db.run(`UPDATE scheduled_tasks SET last_run=datetime('now') WHERE id='${task.id}'`);
            saveDatabase();
          } catch (err) {
            console.error('❌ 证券同步失败:', err.message);
          }
        }
        
        if (task.type === 'sync-tick-trade') {
          try {
            const result = await syncTickTrade(db);
            console.log('✅ 逐笔成交同步完成:', result);
            db.run(`UPDATE scheduled_tasks SET last_run=datetime('now') WHERE id='${task.id}'`);
            saveDatabase();
          } catch (err) {
            console.error('❌ 逐笔成交同步失败:', err.message);
          }
        }
      }, {
        scheduled: true,
        timezone: 'Asia/Shanghai'
      });
      
      console.log(`✅ 定时任务已调度：${task.name} (${task.cron} → ${cronExpr})`);
    });
    
    console.log(`📅 共调度 ${tasks.length} 个定时任务`);
  } catch (error) {
    console.error('加载定时任务失败:', error.message);
  }
}

// 定时任务：每分钟检查，收盘时保存缓存
cron.schedule('* * * * *', async () => {
  if (isCloseToClose()) {
    saveCache();
  }
});

// API 路由 - 每次都获取最新数据
app.get('/api/market-volume', async (req, res) => {
  if (isTradingTime()) {
    const volume = await fetchMarketVolume();
    marketData.volume = volume;
    marketData.lastUpdate = new Date().toISOString();
  }
  res.json(marketData.volume || {});
});


app.get('/api/limit-up-sectors', async (req, res) => {
  if (isTradingTime()) {
    const sectors = await fetchLimitUpSectors();
    marketData.limitUpSectors = sectors;
    marketData.lastUpdate = new Date().toISOString();
  }
  res.json(marketData.limitUpSectors || []);
});

// 板块成分股 API
app.get('/api/sector/:name', async (req, res) => {
  const result = await fetchSectorStocks(req.params.name);
  res.json(result);
});

app.get('/api/high-turnover', async (req, res) => {
  if (isTradingTime()) {
    const stocks = await fetchHighTurnover();
    marketData.highTurnover = stocks;
    marketData.lastUpdate = new Date().toISOString();
  }
  res.json(marketData.highTurnover || []);
});

app.get('/api/sector-cashflow', async (req, res) => {
  if (isTradingTime()) {
    const cashflow = await fetchSectorCashflow();
    marketData.sectorCashflow = cashflow;
    marketData.lastUpdate = new Date().toISOString();
  }
  res.json(marketData.sectorCashflow || []);
});

app.get('/api/all', async (req, res) => {
  const tradeDate = req.query.tradeDate || null;
  
  if (isTradingTime() || tradeDate) {
    await fetchAllData(tradeDate);
  }
  res.json(marketData);
});

// 数据源状态 API
app.get('/api/data-sources', (req, res) => {
  res.json(getDataSourceStatus());
});

// 获取主要指数数据 API
app.get('/api/indices', async (req, res) => {
  const result = await fetchMainIndices();
  res.json(result);
});

// 批量获取股票行情 API（自选股页面使用）
app.get('/api/stocks/batch', async (req, res) => {
  const codes = (req.query.codes || '').trim();
  
  if (!codes) {
    return res.json({ success: false, message: '请提供股票代码' });
  }
  
  const codeList = codes.split(',').filter(c => c.trim());
  
  if (codeList.length === 0) {
    return res.json({ success: true, data: {} });
  }
  
  try {
    // 构建查询字符串（添加市场前缀）
    const stockCodes = codeList.map(code => {
      // 已经有前缀的直接返回
      if (code.startsWith('sh') || code.startsWith('sz') || code.startsWith('bj') || code.startsWith('hk')) return code;
      // 港股：5 位数字
      if (/^\d{5}$/.test(code)) return 'hk' + code;
      // 北交所股票（以8或4开头）
      if (code.startsWith('8') || code.startsWith('4')) return 'bj' + code;
      // 上海股票/ETF/指数（6、9、5开头，以及51开头的上海ETF）
      if (code.startsWith('6') || code.startsWith('9') || code.startsWith('50') || code.startsWith('51') || code.startsWith('56')) return 'sh' + code;
      // 深圳ETF（15、16、159开头）
      if (code.startsWith('15') || code.startsWith('16') || code.startsWith('159')) return 'sz' + code;
      // 深圳股票（包括创业板0、3开头）
      if (code.startsWith('0') || code.startsWith('3')) return 'sz' + code;
      // 其他默认上海
      return 'sh' + code;
    }).join(',');
    
    const response = await txSearchApi.get(`http://qt.gtimg.cn/q=${stockCodes}`);
    const text = iconv.decode(response.data, 'gbk');
    const lines = text.split('\n');
    
    const result = {};
    
    for (const line of lines) {
      const match = line.match(/v_(\w+)="([^"]+)"/);
      if (match) {
        const fullCode = match[1];  // 如 sh600519, bj832566
        const parts = match[2].split('~');
        
        // 提取原始代码（去掉市场前缀 sh/sz/bj）
        const code = fullCode.replace(/^(sh|sz|bj|hk)/, '');
        
        const price = parseFloat(parts[3]) || 0;
        const prevClose = parseFloat(parts[4]) || 0;
        const open = parseFloat(parts[5]) || 0;
        const volume = parseFloat(parts[6]) || 0;
        const high = parseFloat(parts[33]) || 0;
        const low = parseFloat(parts[34]) || 0;
        const amount = parseFloat(parts[37]) || 0;  // 万元
        
        result[code] = {
          code: code,
          name: parts[1] || '',
          price: price,
          prevClose: prevClose,
          open: open,
          high: high,
          low: low,
          volume: volume,
          amount: amount * 10000,  // 转换为元
          change: price - prevClose,
          changePercent: prevClose > 0 ? ((price - prevClose) / prevClose * 100).toFixed(2) : 0
        };
      }
    }
    
    res.json({ success: true, data: result, count: Object.keys(result).length });
  } catch (error) {
    console.error('批量获取股票数据失败:', error.message);
    res.json({ success: false, message: '获取数据失败', data: {} });
  }
});

// 股票搜索 API - 从全市场实时检索
const axios = require('axios');
const iconv = require('iconv-lite');

// 腾讯 API 客户端（用于搜索）
const txSearchApi = axios.create({
  timeout: 15000,
  maxRedirects: 5,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Referer': 'https://gu.qq.com/',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
  },
  responseType: 'arraybuffer'
});

app.get('/api/stock/search', async (req, res) => {
  let query = (req.query.q || '').trim();
  const queryUpper = query.toUpperCase();
  
  if (!query) {
    return res.json({ success: false, message: '请输入搜索内容' });
  }
  
  try {
    // 使用腾讯财经搜索 API 获取全市场匹配结果（跟随重定向）
    const searchUrl = `http://smartbox.gtimg.cn/s3/?v=2&q=${encodeURIComponent(query)}&t=all&c=1`;
    const resp = await txSearchApi.get(searchUrl, { 
      maxRedirects: 5,
      timeout: 5000
    });
    // 腾讯返回的是 UTF-8 编码的 JSON 风格字符串（包含 Unicode 转义）
    const text = resp.data.toString('utf8');
    
    console.log('🔍 搜索响应:', text.substring(0, 100));
    
    // 解析返回结果，格式：v_hint="us~tour.oq~途牛~tn~GP^sz~002145~钛能化学~tnhx~GP-A^..."
    const match = text.match(/v_hint="([^"]+)"/);
    if (!match || !match[1]) {
      return res.json({ success: true, data: [], count: 0, total: 0, source: 'tencent-empty' });
    }
    
    // 解析 Unicode 转义字符
    const hintStr = match[1].replace(/\\u([0-9a-fA-F]{4})/g, (m, code) => {
      return String.fromCharCode(parseInt(code, 16));
    });
    
    const results = [];
    const items = hintStr.split('^');
    
    for (const item of items) {
      // 解析每个结果：market~code~name~pinyin~type
      const parts = item.split('~');
      if (parts.length >= 4) {
        const market = parts[0];
        const code = parts[1];
        const name = parts[2];
        const pinyin = parts[3] || '';
        
        // A 股：sh/sz + 6 位数字
        if ((market === 'sh' || market === 'sz') && /^\d{6}$/.test(code)) {
          results.push({
            code: code,
            name: name,
            market: market,
            pinyin: pinyin.toUpperCase()
          });
        }
        // 港股：hk + 5 位数字
        else if (market === 'hk' && /^\d{5}$/.test(code)) {
          results.push({
            code: code,
            name: name,
            market: 'hk',
            pinyin: pinyin.toUpperCase()
          });
        }
      }
    }
    
    // 排序：按代码排序
    results.sort((a, b) => a.code.localeCompare(b.code));
    
    // 最多返回 20 条
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json({
      success: true,
      data: results.slice(0, 20),
      count: results.length,
      total: results.length,
      source: 'tencent-full-market'
    });
    return;
    
  } catch (e) {
    console.error('全市场搜索失败:', e.message);
  }
  
  // 降级到本地列表搜索
  const localResults = stockList.filter(stock => {
    if (stock.code.toUpperCase().startsWith(queryUpper)) return true;
    if (stock.name.includes(query)) return true;
    if (stock.pinyin && stock.pinyin.startsWith(queryUpper) && queryUpper.length >= 2) return true;
    return false;
  }).slice(0, 20);
  
  res.json({
    success: true,
    data: localResults,
    count: localResults.length,
    total: localResults.length,
    source: 'local-fallback'
  });
});

// 个股行情 API（支持代码和名称搜索）
app.get('/api/stock/:query', async (req, res) => {
  let query = req.params.query.trim();
  const queryUpper = query.toUpperCase();
  
  // 提取代码（支持 sh/sz/hk 前缀）
  const codeMatch = query.match(/(SH|SZ|HK)?(\d{5,6})/i);
  if (codeMatch) {
    const code = codeMatch[1] ? codeMatch[0] : codeMatch[2];
    const result = await fetchStockDetail(code);
    res.json(result);
    return;
  }
  
  // 如果是中文或拼音，先搜索找到代码
  const stocks = require('./stocks');
  const searchResults = stocks.filter(stock => {
    // 名称包含匹配（中文搜索）
    if (stock.name.includes(query)) return true;
    // 拼音完全匹配
    if (stock.pinyin === queryUpper) return true;
    // 拼音前缀匹配（如输入 SHZ 匹配 SHZS）
    if (stock.pinyin.startsWith(queryUpper) && queryUpper.length >= 2) return true;
    // 拼音包含匹配（如输入 ZS 匹配所有 ZS 开头的）
    if (stock.pinyin.includes(queryUpper) && queryUpper.length >= 2) return true;
    return false;
  });
  
  if (searchResults.length > 0) {
    // 返回第一个匹配的股票
    const searchResult = searchResults[0];
    const result = await fetchStockDetail(searchResult.code);
    res.json(result);
  } else {
    res.json({ success: false, message: '未找到该股票，请输入 6 位股票代码' });
  }
});

// 证券行情页面
// 自选股页面
app.get('/custom', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/custom.html'));
});

// 持仓页面
app.get('/positions', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/positions.html'));
});

// 证券行情页面
app.get('/stock', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/stock.html'));
});

// 分时图 API - 使用 MyData 实时数据接口 + 历史数据
app.get('/api/intraday/:code', async (req, res) => {
  const code = req.params.code.replace(/^(sh|sz|bj|hk)/, '');
  const market = req.params.code.match(/^(sh|sz|bj|hk)/)?.[1] || (code.startsWith('6') ? 'sh' : 'sz');
  
  try {
    const MYDATA_LICENCE = 'FB1A859B-6832-4F70-AAA2-38274F23FC90';
    
    // 1. 获取实时数据（最新 5 条 1 分钟线）
    const realtimeUrl = `https://api.mairuiapi.com/hsstock/latest/${code}.${market.toUpperCase()}/1/n/${MYDATA_LICENCE}?lt=5`;
    console.log('📊 MyData 分时实时 API:', realtimeUrl);
    
    const realtimeResp = await axios.get(realtimeUrl, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    const realtimeData = realtimeResp.data;
    
    // 2. 获取历史数据（5 分钟 K 线，用于填充图表）
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const historyUrl = `https://api.mairuiapi.com/hsstock/history/${code}.${market.toUpperCase()}/5/n/${MYDATA_LICENCE}?st=${today}&et=${today}&lt=48`;
    console.log('📊 MyData 分时历史 API:', historyUrl);
    
    const historyResp = await axios.get(historyUrl, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    const historyData = historyResp.data;
    
    // 3. 合并数据：历史数据 + 实时数据覆盖
    let intradayData = [];
    
    if (Array.isArray(historyData) && historyData.length > 0) {
      // 转换历史数据格式
      intradayData = historyData.map(item => {
        const timeMatch = item.t.match(/(\d{2}):(\d{2}):\d{2}/);
        return {
          time: timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : '00:00',
          price: item.c || 0,
          open: item.o || 0,
          high: item.h || 0,
          low: item.l || 0,
          volume: item.v || 0,
          amount: item.a || 0,
          prevClose: item.pc || 0
        };
      });
    }
    
    // 用实时数据覆盖对应时间点的数据
    if (Array.isArray(realtimeData) && realtimeData.length > 0) {
      const realtimeMap = new Map();
      realtimeData.forEach(item => {
        const timeMatch = item.t.match(/(\d{2}):(\d{2}):\d{2}/);
        if (timeMatch) {
          const time = `${timeMatch[1]}:${timeMatch[2]}`;
          realtimeMap.set(time, {
            time: time,
            price: item.c || 0,
            open: item.o || 0,
            high: item.h || 0,
            low: item.l || 0,
            volume: item.v || 0,
            amount: item.a || 0,
            prevClose: item.pc || 0
          });
        }
      });
      
      // 覆盖历史数据中的对应时间点
      intradayData = intradayData.map(item => {
        return realtimeMap.get(item.time) || item;
      });
      
      // 添加实时数据中新增的时间点（不在历史数据中的）
      realtimeMap.forEach((item, time) => {
        if (!intradayData.find(d => d.time === time)) {
          intradayData.push(item);
        }
      });
    }
    
    // 按时间排序
    intradayData.sort((a, b) => a.time.localeCompare(b.time));
    
    if (intradayData.length === 0) {
      return res.json({ success: false, message: '无分时数据', data: [] });
    }
    
    res.json({
      success: true,
      prevClose: intradayData[0]?.prevClose || 0,
      data: intradayData,
      source: 'mydata',
      tradeDate: new Date().toISOString().slice(0, 10)
    });
    
  } catch (error) {
    console.error('❌ 分时图 API 失败:', error.message);
    // 降级使用 5 分钟 K 线
    return res.json(await fetchIntradayHistoryFallback(code, market));
  }
});

// 分时图降级方案（5 分钟 K 线）
async function fetchIntradayHistoryFallback(code, market) {
  try {
    const result = await fetchIntradayHistory(code, market);
    return result;
  } catch (e) {
    return { success: false, message: '获取失败', data: [] };
  }
}

// 逐笔成交 API（代理东方财富接口）
app.get('/api/stock/:code/trades', async (req, res) => {
  try {
    const code = req.params.code.replace(/^(sh|sz)/, '');
    const market = code.startsWith('6') ? '1' : '0';
    const secid = `${market}.${code}`;
    const count = parseInt(req.query.count) || 5000;
    
    const url = `https://push2.eastmoney.com/api/qt/stock/details/get?secid=${secid}&pos=-1&cnt=${count}&fltt=2&invt=2&fields=f19,f20,f17,f16,f21`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://quote.eastmoney.com/'
      }
    });
    
    const result = await response.json();
    
    if (result.rc === 0 && result.data && result.data.details) {
      res.json({ success: true, data: result.data.details });
    } else {
      res.json({ success: true, data: [] });
    }
  } catch (error) {
    console.error('获取逐笔成交失败:', error.message);
    res.status(500).json({ success: false, message: '获取逐笔成交失败' });
  }
});

// 买卖五档 API（使用 MyData API）
app.get('/api/stock/:code/five', async (req, res) => {
  try {
    const code = req.params.code.replace(/^(sh|sz|bj)/, '');
    const MYDATA_LICENCE = 'FB1A859B-6832-4F70-AAA2-38274F23FC90';
    
    const url = `https://api.mairuiapi.com/hsstock/real/five/${code}/${MYDATA_LICENCE}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error(`❌ MyData 五档 API 请求失败: ${response.status}`);
      return res.json({ success: false, message: '获取五档数据失败' });
    }
    
    const data = await response.json();
    
    if (data && data.ps && data.pb) {
      // MyData 五档数据格式转换
      // ps: 卖价数组 [卖1, 卖2, 卖3, 卖4, 卖5]
      // pb: 买价数组 [买1, 买2, 买3, 买4, 买5]
      // vs: 卖量数组 [卖1量, 卖2量, ...]
      // vb: 买量数组 [买1量, 买2量, ...]
      const orderBook = {
        sell1: { price: parseFloat(data.ps[0]) || 0, volume: parseInt(data.vs[0]) || 0 },
        sell2: { price: parseFloat(data.ps[1]) || 0, volume: parseInt(data.vs[1]) || 0 },
        sell3: { price: parseFloat(data.ps[2]) || 0, volume: parseInt(data.vs[2]) || 0 },
        sell4: { price: parseFloat(data.ps[3]) || 0, volume: parseInt(data.vs[3]) || 0 },
        sell5: { price: parseFloat(data.ps[4]) || 0, volume: parseInt(data.vs[4]) || 0 },
        buy1: { price: parseFloat(data.pb[0]) || 0, volume: parseInt(data.vb[0]) || 0 },
        buy2: { price: parseFloat(data.pb[1]) || 0, volume: parseInt(data.vb[1]) || 0 },
        buy3: { price: parseFloat(data.pb[2]) || 0, volume: parseInt(data.vb[2]) || 0 },
        buy4: { price: parseFloat(data.pb[3]) || 0, volume: parseInt(data.vb[3]) || 0 },
        buy5: { price: parseFloat(data.pb[4]) || 0, volume: parseInt(data.vb[4]) || 0 },
        weibi: 0
      }; 
      res.json({ success: true, data: orderBook });
    } else {
      res.json({ success: false, message: '五档数据格式错误' });
    }
  } catch (error) {
    console.error('获取买卖五档失败:', error.message);
    res.status(500).json({ success: false, message: '获取买卖五档失败' });
  }
});

// 资金流向计算 API（使用 MyData API）
app.get('/api/stock/:code/capital-flow', async (req, res) => {
  try {
    const code = req.params.code;
    const codeNum = code.replace(/^(sh|sz|bj)/, '');
    const market = code.startsWith('sh') ? 'sh' : (code.startsWith('bj') ? 'bj' : 'sz');
    
    // MyData API Licence
    const MYDATA_LICENCE = 'FB1A859B-6832-4F70-AAA2-38274F23FC90';
    
    // 1. 获取股票基本信息（获取流通市值）
    const basicResult = await fetchStockDetail(code);
    let floatMarketCap = 0;
    
    if (basicResult.success && basicResult.data) {
      floatMarketCap = (basicResult.data.floatMarketCap || 0) * 100000000; // 亿元转元
    }
    
    console.log(`📊 ${code} 流通市值: ${floatMarketCap} 元`);
    
    // 2. 使用 MyData API 获取逐笔成交数据
    const tradesUrl = `https://api.mairuiapi.com/hsrl/zbjy/${codeNum}/${MYDATA_LICENCE}`;
    
    const tradesResponse = await fetch(tradesUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });
    
    if (!tradesResponse.ok) {
      console.error(`❌ MyData API 请求失败: ${tradesResponse.status}`);
      return res.json({ success: false, message: '获取成交数据失败' });
    }
    
    const trades = await tradesResponse.json();
    
    if (!Array.isArray(trades) || trades.length === 0) {
      console.log(`⚠️ 无逐笔成交数据`);
      return res.json({ success: false, message: '无成交数据' });
    }
    
    console.log(`📊 获取到 ${trades.length} 条逐笔成交（MyData API）`);
    
    // 3. 计算资金流向（MyData 字段: d=日期, t=时间, v=成交量-股, p=成交价, ts=方向）
    const capital = {
      superLarge: { inflow: 0, outflow: 0, count: 0 },
      large: { inflow: 0, outflow: 0, count: 0 },
      medium: { inflow: 0, outflow: 0, count: 0 },
      small: { inflow: 0, outflow: 0, count: 0 }
    };
    
    let validCount = 0;
    
    trades.forEach(trade => {
      const time = trade.t || '';  // MyData: t 字段
      
      // 排除集合竞价（9:15-9:25, 14:57-15:00）
      const match = time.match(/(\d{1,2}):(\d{2}):(\d{2})/);
      if (match) {
        const hour = parseInt(match[1]);
        const minute = parseInt(match[2]);
        if ((hour === 9 && minute >= 15 && minute <= 25) || (hour === 14 && minute >= 57)) {
          return;
        }
      }
      
      validCount++;
      
      const volume = trade.v || 0;  // MyData: v 字段（成交量-股）
      const price = trade.p || 0;    // MyData: p 字段（成交价）
      const amount = volume * price;  // 元
      const direction = trade.ts || 0;  // MyData: ts 字段（0中性, 1买入, 2卖出）
      
      // 判断订单类型（使用流通市值比例）
      let orderType = 'small';
      
      if (floatMarketCap > 0) {
        const percentage = amount / floatMarketCap;  // 占流通市值比例
        
        // 特大单：> 0.02% 流通市值
        if (percentage > 0.0002) orderType = 'superLarge';
        // 大单：0.005% ~ 0.02% 流通市值
        else if (percentage > 0.00005) orderType = 'large';
        // 中单：0.001% ~ 0.005% 流通市值
        else if (percentage > 0.00001) orderType = 'medium';
        // 小单：< 0.001% 流通市值
      } else {
        // 无流通市值时，使用固定金额阈值作为降级方案
        const amountWan = amount / 10000;  // 万元
        if (amountWan >= 100) orderType = 'superLarge';
        else if (amountWan >= 20) orderType = 'large';
        else if (amountWan >= 5) orderType = 'medium';
      }
      
      // 统计资金
      if (direction === 1) {
        capital[orderType].inflow += amount;
        capital[orderType].count++;
      } else if (direction === 2) {
        capital[orderType].outflow += amount;
        capital[orderType].count++;
      }
    });
    
    console.log(`✅ 有效订单: ${validCount}`);
    
    // 转换为亿元
    const toYi = (val) => val / 100000000;
    
    res.json({
      success: true,
      data: {
        superLarge: {
          inflow: toYi(capital.superLarge.inflow),
          outflow: toYi(capital.superLarge.outflow),
          net: toYi(capital.superLarge.inflow - capital.superLarge.outflow),
          count: capital.superLarge.count
        },
        large: {
          inflow: toYi(capital.large.inflow),
          outflow: toYi(capital.large.outflow),
          net: toYi(capital.large.inflow - capital.large.outflow),
          count: capital.large.count
        },
        medium: {
          inflow: toYi(capital.medium.inflow),
          outflow: toYi(capital.medium.outflow),
          net: toYi(capital.medium.inflow - capital.medium.outflow),
          count: capital.medium.count
        },
        small: {
          inflow: toYi(capital.small.inflow),
          outflow: toYi(capital.small.outflow),
          net: toYi(capital.small.inflow - capital.small.outflow),
          count: capital.small.count
        },
        mainInflow: toYi(capital.superLarge.inflow + capital.large.inflow),
        mainOutflow: toYi(capital.superLarge.outflow + capital.large.outflow),
        mainNetflow: toYi(capital.superLarge.inflow + capital.large.inflow - capital.superLarge.outflow - capital.large.outflow),
        totalVolume: validCount
      }
    });
    
  } catch (error) {
    console.error('计算资金流向失败:', error.message);
    res.status(500).json({ success: false, message: '计算资金流向失败: ' + error.message });
  }
});

// 逐笔成交 API（获取全部明细，带订单类型分类）
app.get('/api/stock/:code/tick-trades', async (req, res) => {
  try {
    const code = req.params.code;
    const codeNum = code.replace(/^(sh|sz|bj)/, '');
    const limit = parseInt(req.query.limit) || 10;  // 默认返回10条
    const allData = req.query.all === 'true';  // 是否返回全部数据
    
    // MyData API Licence
    const MYDATA_LICENCE = 'FB1A859B-6832-4F70-AAA2-38274F23FC90';
    
    // 1. 获取流通市值
    const basicResult = await fetchStockDetail(code);
    let floatMarketCap = 0;
    if (basicResult.success && basicResult.data) {
      floatMarketCap = (basicResult.data.floatMarketCap || 0) * 100000000; // 亿元转元
    }
    
    // 2. 使用 MyData API 获取逐笔成交数据
    const tradesUrl = `https://api.mairuiapi.com/hsrl/zbjy/${codeNum}/${MYDATA_LICENCE}`;
    
    const tradesResponse = await fetch(tradesUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });
    
    if (!tradesResponse.ok) {
      return res.json({ success: false, message: '获取成交数据失败' });
    }
    
    const trades = await tradesResponse.json();
    
    if (!Array.isArray(trades) || trades.length === 0) {
      return res.json({ success: true, data: [], total: 0 });
    }
    
    // 3. 处理逐笔成交数据，添加订单类型分类
    // MyData 字段: d=日期, t=时间, v=成交量-股, p=成交价, ts=方向(0中性,1买入,2卖出)
    const processedTrades = trades
      .filter(trade => {
        // 排除集合竞价时间
        const time = trade.t || '';
        const match = time.match(/(\d{1,2}):(\d{2}):(\d{2})/);
        if (match) {
          const hour = parseInt(match[1]);
          const minute = parseInt(match[2]);
          if ((hour === 9 && minute >= 15 && minute <= 25) || (hour === 14 && minute >= 57)) {
            return false;
          }
        }
        return true;
      })
      .map(trade => {
        const volume = trade.v || 0;
        const price = trade.p || 0;
        const amount = volume * price;  // 元
        const amountWan = amount / 10000;  // 万元
        
        // 订单类型分类（使用流通市值比例）
        let orderType = 'small';
        if (floatMarketCap > 0) {
          const percentage = amount / floatMarketCap;
          if (percentage > 0.0002) orderType = 'superLarge';
          else if (percentage > 0.00005) orderType = 'large';
          else if (percentage > 0.00001) orderType = 'medium';
        } else {
          if (amountWan >= 100) orderType = 'superLarge';
          else if (amountWan >= 20) orderType = 'large';
          else if (amountWan >= 5) orderType = 'medium';
        }
        
        // 方向
        let direction = 'neutral';
        if (trade.ts === 1) direction = 'buy';
        else if (trade.ts === 2) direction = 'sell';
        
        return {
          date: trade.d || '',
          time: trade.t || '',
          volume: volume,
          price: price,
          amount: amountWan,  // 万元
          direction: direction,
          orderType: orderType
        };
      });
    
    // 截止15:01的数据（按时间升序：时间从小到大）
    const sortedTrades = processedTrades.sort((a, b) => {
      // 按时间升序排列（小到大）
      return (a.time || '').localeCompare(b.time || '');
    });
    
    // 返回最新10条（取最后10条，因为按时间升序排列后最新的是在末尾）
    const resultTrades = allData ? sortedTrades : sortedTrades.slice(-limit);
    
    res.json({
      success: true,
      data: resultTrades,
      total: sortedTrades.length,
      showing: resultTrades.length
    });
    
  } catch (error) {
    console.error('获取逐笔成交失败:', error.message);
    res.status(500).json({ success: false, message: '获取逐笔成交失败: ' + error.message });
  }
});

// 可转债 API
app.get('/api/convertibles/:stockCode', async (req, res) => {
  const result = await fetchConvertiblesForStock(req.params.stockCode);
  res.json(result);
});

// 登录页面（公开访问）
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

// 静态文件（登录页面相关资源公开）
app.use('/css', express.static(path.join(__dirname, '../public/css')));
app.use('/js', express.static(path.join(__dirname, '../public/js')));

// 其他静态资源需要认证
app.use((req, res, next) => {
  if (req.session && req.session.isAuthenticated) {
    express.static(path.join(__dirname, '../public'))(req, res, next);
  } else {
    // 未登录重定向到登录页
    if (req.path !== '/login.html' && !req.path.startsWith('/api/')) {
      res.redirect(`/login.html?redirect=${encodeURIComponent(req.originalUrl)}`);
    } else {
      next();
    }
  }
});

// 登录 API
// 注册 API
app.post('/api/register', async (req, res) => {
  const { username, password, confirmPassword } = req.body;
  
  try {
    // 验证输入
    if (!username || !password) {
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }
    
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: '两次输入的密码不一致' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: '密码长度至少 6 位' });
    }
    
    if (username.length < 3) {
      return res.status(400).json({ success: false, message: '用户名长度至少 3 位' });
    }
    
    // 检查用户名是否已存在
    const existing = db.exec(`SELECT user_id FROM users WHERE user_id = '${username}'`);
    if (existing.length > 0 && existing[0].values.length > 0) {
      return res.status(400).json({ success: false, message: '用户名已存在，请直接登录' });
    }
    
    // 插入新用户
    db.run(`INSERT INTO users (user_id, password, username, role, is_active, created_at) 
            VALUES ('${username}', '${password}', '${username}', 0, 1, CURRENT_TIMESTAMP)`);
    saveDatabase();
    
    console.log(`✅ 用户 ${username} 注册成功`);
    res.json({ success: true, message: '注册成功，请登录' });
  } catch (error) {
    console.error('注册失败:', error.message);
    res.status(500).json({ success: false, message: '系统错误，请稍后重试' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    // 从数据库查询用户
    const results = db.exec(`SELECT user_id, password, username, role FROM users WHERE user_id = '${username}' AND is_active = 1`);
    
    if (results.length > 0 && results[0].values.length > 0) {
      const [userId, dbPassword, dbUsername, userRole] = results[0].values[0];
      const roleValue = userRole || '0';
      
      if (password === dbPassword) {
        // 登录成功
        req.session.isAuthenticated = true;
        req.session.username = dbUsername;
        req.session.userId = userId;
        req.session.userRole = roleValue;
        req.session.loginTime = new Date().toISOString();
        
        // 更新最后登录时间
        try {
          db.run(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = '${userId}'`);
          saveDatabase();
        } catch (e) {
          console.error('更新登录时间失败:', e.message);
        }
        
        const roleText = roleValue === '1' ? '管理员' : '普通用户';
        console.log(`✅ 用户 ${userId} (${dbUsername}, ${roleText}) 登录成功`);
        res.json({ success: true, message: '登录成功', role: roleValue });
      } else {
        console.log(`❌ 登录失败：${username} - 密码错误`);
        res.status(401).json({ success: false, message: '用户名或密码错误' });
      }
    } else {
      console.log(`❌ 登录失败：${username} - 用户不存在`);
      res.status(401).json({ success: false, message: '用户名或密码错误' });
    }
  } catch (error) {
    console.error('登录验证失败:', error.message);
    res.status(500).json({ success: false, message: '系统错误' });
  }
});

// 登出 API
app.get('/api/logout', (req, res) => {
  const username = req.session?.username;
  req.session.destroy();
  console.log(`👋 用户 ${username} 已登出`);
  res.json({ success: true, message: '已退出登录' });
});

// 检查登录状态 API
app.get('/api/auth/status', (req, res) => {
  res.json({ 
    isAuthenticated: req.session?.isAuthenticated || false,
    username: req.session?.username || null,
    userId: req.session?.userId || null,
    userRole: req.session?.userRole || 'user'
  });
});

// ==================== 用户管理 API ====================

// 获取用户列表
app.get('/api/users/list', (req, res) => {
  try {
    const results = db.exec('SELECT user_id, username, password, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC');
    
    if (results.length === 0) {
      return res.json({ success: true, data: [] });
    }
    
    const users = results[0].values.map(row => ({
      user_id: row[0],
      username: row[1],
      password: row[2],
      role: row[3] || '0',
      is_active: row[4],
      created_at: row[5],
      last_login: row[6]
    }));
    
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('获取用户列表失败:', error.message);
    res.status(500).json({ success: false, message: '获取用户列表失败' });
  }
});

// 添加用户
app.post('/api/users/add', (req, res) => {
  const { user_id, username, password, role, is_active } = req.body;
  
  try {
    // 检查用户是否已存在
    const check = db.exec(`SELECT COUNT(*) FROM users WHERE user_id = '${user_id}'`);
    if (check[0].values[0][0] > 0) {
      return res.status(400).json({ success: false, message: '用户编号已存在' });
    }
    
    // 添加用户
    db.run(`INSERT INTO users (user_id, password, username, role, is_active) VALUES ('${user_id}', '${password}', '${username}', '${role || '0'}', ${is_active})`);
    saveDatabase();
    
    const roleText = role === '1' ? '管理员' : '普通用户';
    console.log(`✅ 用户 ${user_id} 已添加 (${roleText})`);
    res.json({ success: true, message: '用户已添加' });
  } catch (error) {
    console.error('添加用户失败:', error.message);
    res.status(500).json({ success: false, message: '添加用户失败' });
  }
});

// 更新用户
app.post('/api/users/update', (req, res) => {
  const { user_id, username, password, role, is_active } = req.body;
  
  try {
    // 检查用户是否存在
    const check = db.exec(`SELECT COUNT(*) FROM users WHERE user_id = '${user_id}'`);
    if (check[0].values[0][0] === 0) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    
    // 更新用户
    db.run(`UPDATE users SET username = '${username}', password = '${password}', role = '${role || '0'}', is_active = ${is_active} WHERE user_id = '${user_id}'`);
    saveDatabase();
    
    const roleText = role === '1' ? '管理员' : '普通用户';
    console.log(`✅ 用户 ${user_id} 已更新 (${roleText})`);
    res.json({ success: true, message: '用户已更新' });
  } catch (error) {
    console.error('更新用户失败:', error.message);
    res.status(500).json({ success: false, message: '更新用户失败' });
  }
});

// 删除用户
app.post('/api/users/delete', (req, res) => {
  const { user_id } = req.body;
  
  try {
    // 检查用户是否存在
    const check = db.exec(`SELECT COUNT(*) FROM users WHERE user_id = '${user_id}'`);
    if (check[0].values[0][0] === 0) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    
    // 不允许删除自己
    if (req.session?.userId === user_id) {
      return res.status(400).json({ success: false, message: '不能删除当前登录的用户' });
    }
    
    // 删除用户
    db.run(`DELETE FROM users WHERE user_id = '${user_id}'`);
    saveDatabase();
    
    console.log(`✅ 用户 ${user_id} 已删除`);
    res.json({ success: true, message: '用户已删除' });
  } catch (error) {
    console.error('删除用户失败:', error.message);
    res.status(500).json({ success: false, message: '删除用户失败' });
  }
});

// 修改密码
app.post('/api/users/change-password', (req, res) => {
  const { user_id, current_password, new_password } = req.body;
  
  try {
    // 验证当前用户
    if (req.session?.userId !== user_id) {
      return res.status(403).json({ success: false, message: '无权修改其他用户的密码' });
    }
    
    // 检查用户是否存在并验证当前密码
    const check = db.exec(`SELECT password FROM users WHERE user_id = '${user_id}'`);
    if (check.length === 0 || check[0].values.length === 0) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    
    const dbPassword = check[0].values[0][0];
    if (current_password !== dbPassword) {
      return res.status(401).json({ success: false, message: '当前密码错误' });
    }
    
    // 验证新密码
    if (!new_password || new_password.length > 12) {
      return res.status(400).json({ success: false, message: '密码长度不能超过 12 位' });
    }
    
    // 更新密码
    db.run(`UPDATE users SET password = '${new_password}' WHERE user_id = '${user_id}'`);
    saveDatabase();
    
    console.log(`✅ 用户 ${user_id} 密码已修改`);
    res.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    console.error('修改密码失败:', error.message);
    res.status(500).json({ success: false, message: '修改密码失败' });
  }
});

// 用户管理页面
app.get('/users', requireAuth, (req, res) => {
  // 检查是否是管理员（role='1'）
  if (req.session?.userRole !== '1') {
    return res.redirect('/change-password');
  }
  res.sendFile(path.join(__dirname, '../public/users.html'));
});

// 修改密码页面
app.get('/change-password', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/change-password.html'));
});

// ==================== 管理员数据管理 API ====================

// 获取服务器监控数据
app.get('/api/admin/server-monitor', (req, res) => {
  try {
    // 检查是否是管理员
    if (req.session?.userRole !== '1') {
      return res.status(403).json({ success: false, message: '无权访问' });
    }
    
    const os = require('os');
    const fs = require('fs');
    
    // 内存信息 - 使用 MemAvailable 计算真实可用内存
    const totalMem = os.totalmem();
    let availableMem = os.freemem();  // 默认使用 freemem
    let usedMem = totalMem - availableMem;
    let memUsage = (usedMem / totalMem * 100).toFixed(2);
    
    // 尝试读取 MemAvailable（更准确的可用内存）
    try {
      const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
      const memAvailableMatch = meminfo.match(/MemAvailable:\s*(\d+)/);
      if (memAvailableMatch) {
        availableMem = parseInt(memAvailableMatch[1]) * 1024;  // kB -> Bytes
        usedMem = totalMem - availableMem;
        memUsage = (usedMem / totalMem * 100).toFixed(2);
      }
    } catch (e) {
      // 降级使用 os.freemem()
    }
    
    // 计算真正的空闲内存（包括可回收的缓存）
    const realFreeMem = availableMem;
    
    // 磁盘信息（读取根目录）
    let diskTotal = 0, diskFree = 0, diskUsed = 0;
    try {
      const df = require('child_process').execSync('df -B1 / | tail -1').toString();
      const parts = df.split(/\s+/);
      diskTotal = parseInt(parts[1]) || 0;
      diskUsed = parseInt(parts[2]) || 0;
      diskFree = parseInt(parts[3]) || 0;
    } catch (e) {
      // 降级方案
      diskTotal = totalMem * 10;  // 估算
      diskFree = diskTotal * 0.5;
      diskUsed = diskTotal - diskFree;
    }
    const diskUsage = (diskUsed / diskTotal * 100).toFixed(2);
    
    // CPU 信息
    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model || 'Unknown';
    const cpuCores = cpus.length;
    
    // 计算 CPU 使用率（通过 /proc/stat 读取）
    let cpuUsage = 0;
    try {
      const statLines = fs.readFileSync('/proc/stat', 'utf8').split('\n');
      const cpuLine = statLines[0].split(/\s+/);
      // user, nice, system, idle, iowait, irq, softirq
      const user = parseInt(cpuLine[1]) || 0;
      const nice = parseInt(cpuLine[2]) || 0;
      const system = parseInt(cpuLine[3]) || 0;
      const idle = parseInt(cpuLine[4]) || 0;
      const iowait = parseInt(cpuLine[5]) || 0;
      const irq = parseInt(cpuLine[6]) || 0;
      const softirq = parseInt(cpuLine[7]) || 0;
      
      const total = user + nice + system + idle + iowait + irq + softirq;
      const used = user + nice + system + irq + softirq;
      cpuUsage = total > 0 ? (used / total * 100).toFixed(2) : 0;
    } catch (e) {
      // 降级方案：使用 loadavg
      const loadAvg = os.loadavg();
      cpuUsage = Math.min(100, (loadAvg[0] / cpuCores * 100)).toFixed(2);
    }
    
    // 系统信息
    const platform = os.platform();
    const arch = os.arch();
    const uptime = os.uptime();
    const hostname = os.hostname();
    
    // 网络信息
    const networkInterfaces = os.networkInterfaces();
    const networkInfo = [];
    for (const [name, interfaces] of Object.entries(networkInterfaces)) {
      for (const iface of interfaces) {
        if (iface.family === 'IPv4' && !iface.internal) {
          networkInfo.push({ name, address: iface.address });
        }
      }
    }
    
    // 进程数
    const processCount = require('child_process').execSync('ps aux | wc -l').toString().trim();
    
    res.json({
      success: true,
      data: {
        memory: {
          total: totalMem,
          used: usedMem,
          free: realFreeMem,
          usage: parseFloat(memUsage)
        },
        disk: {
          total: diskTotal,
          used: diskUsed,
          free: diskFree,
          usage: parseFloat(diskUsage)
        },
        cpu: {
          model: cpuModel,
          cores: cpuCores,
          usage: parseFloat(cpuUsage),
          loadAvg: os.loadavg()
        },
        system: {
          platform,
          arch,
          hostname,
          uptime,
          uptimeStr: formatUptime(uptime)
        },
        network: networkInfo,
        processCount: parseInt(processCount) || 0
      }
    });
  } catch (error) {
    console.error('获取服务器监控数据失败:', error.message);
    res.status(500).json({ success: false, message: '获取监控数据失败' });
  }
});

// 格式化运行时间
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (days > 0) {
    return `${days}天 ${hours}小时 ${minutes}分钟`;
  } else if (hours > 0) {
    return `${hours}小时 ${minutes}分钟 ${secs}秒`;
  } else if (minutes > 0) {
    return `${minutes}分钟 ${secs}秒`;
  }
  return `${secs}秒`;
}

// 获取用户数据（管理员专用）
app.get('/api/admin/users', (req, res) => {
  try {
    // 检查是否是管理员
    if (req.session?.userRole !== '1') {
      return res.status(403).json({ success: false, message: '无权访问' });
    }
    
    const { page = 1, pageSize = 20, keyword = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    const limit = parseInt(pageSize);
    
    let whereClause = '';
    if (keyword) {
      whereClause = `WHERE user_id LIKE '%${keyword}%' OR username LIKE '%${keyword}%'`;
    }
    
    // 查询总数
    const countResult = db.exec(`SELECT COUNT(*) FROM users ${whereClause}`);
    const total = countResult[0]?.values[0]?.[0] || 0;
    
    // 查询数据
    const results = db.exec(`SELECT user_id, username, password, role, is_active, created_at, last_login FROM users ${whereClause} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`);
    
    if (results.length === 0) {
      return res.json({ success: true, data: [], total: 0, page: parseInt(page), pageSize: parseInt(pageSize) });
    }
    
    const users = results[0].values.map(row => ({
      user_id: row[0],
      username: row[1],
      password: row[2],
      role: row[3] || '0',
      is_active: row[4],
      created_at: row[5],
      last_login: row[6]
    }));
    
    res.json({ success: true, data: users, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (error) {
    console.error('获取用户数据失败:', error.message);
    res.status(500).json({ success: false, message: '获取用户数据失败' });
  }
});

// 获取自选股数据（管理员专用）
app.get('/api/admin/custom-stocks', (req, res) => {
  try {
    // 检查是否是管理员
    if (req.session?.userRole !== '1') {
      return res.status(403).json({ success: false, message: '无权访问' });
    }
    
    const { page = 1, pageSize = 20, userId = '', stockCode = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    const limit = parseInt(pageSize);
    
    let whereClause = 'WHERE 1=1';
    if (userId) {
      whereClause += ` AND user_id LIKE '%${userId}%'`;
    }
    if (stockCode) {
      whereClause += ` AND stock_code LIKE '%${stockCode}%'`;
    }
    
    // 查询总数
    const countResult = db.exec(`SELECT COUNT(*) FROM custom_stocks ${whereClause}`);
    const total = countResult[0]?.values[0]?.[0] || 0;
    
    // 查询数据
    const results = db.exec(`SELECT user_id, stock_code, stock_market, added_at FROM custom_stocks ${whereClause} ORDER BY added_at DESC LIMIT ${limit} OFFSET ${offset}`);
    
    if (results.length === 0) {
      return res.json({ success: true, data: [], total: 0, page: parseInt(page), pageSize: parseInt(pageSize) });
    }
    
    const stocks = results[0].values.map(row => ({
      user_id: row[0],
      stock_code: row[1],
      stock_market: row[2],
      added_at: row[3]
    }));
    
    res.json({ success: true, data: stocks, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (error) {
    console.error('获取自选股数据失败:', error.message);
    res.status(500).json({ success: false, message: '获取自选股数据失败' });
  }
});

// ==================== 自选股 API ====================

// 获取用户的自选股列表
app.get('/api/custom-stocks/list', (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    
    // 获取 type 参数，默认为 1（自选股）
    const type = req.query.type || '1';
    
    const results = db.exec(`SELECT stock_code, stock_market, added_at FROM custom_stocks WHERE user_id = '${userId}' AND type = ${type} ORDER BY added_at DESC`);
    
    if (results.length === 0) {
      return res.json({ success: true, data: [] });
    }
    
    const stocks = results[0].values.map(row => ({
      code: row[0],
      market: row[1],
      addedAt: row[2]
    }));
    
    res.json({ success: true, data: stocks });
  } catch (error) {
    console.error('获取自选股列表失败:', error.message);
    res.status(500).json({ success: false, message: '获取自选股列表失败' });
  }
});

// 添加自选股
app.post('/api/custom-stocks/add', (req, res) => {
  try {
    const userId = req.session?.userId;
    console.log('📝 添加自选股 - session userId:', userId, 'body:', req.body);
    
    if (!userId) {
      console.log('⚠️ 用户未登录');
      return res.status(401).json({ success: false, message: '请先登录' });
    }
    
    const { stock_code, stock_market, type } = req.body;
    const stockType = type || 1;  // 默认为自选股
    
    if (!stock_code || !stock_market) {
      console.log('⚠️ 缺少参数:', stock_code, stock_market);
      return res.status(400).json({ success: false, message: '缺少股票代码或市场' });
    }
    
    // 检查是否已存在（同类型下）
    const check = db.exec(`SELECT COUNT(*) FROM custom_stocks WHERE user_id = '${userId}' AND stock_code = '${stock_code}' AND stock_market = '${stock_market}' AND type = ${stockType}`);
    if (check[0].values[0][0] > 0) {
      console.log('⚠️ 股票已存在');
      return res.status(400).json({ success: false, message: '该股票已在列表中' });
    }
    
    // 添加自选股/持仓
    db.run(`INSERT INTO custom_stocks (user_id, stock_code, stock_market, type) VALUES ('${userId}', '${stock_code}', '${stock_market}', ${stockType})`);
    saveDatabase();
    
    console.log(`✅ 用户 ${userId} 添加${stockType === 2 ? '持仓' : '自选股'}：${stock_market}${stock_code}`);
    res.json({ success: true, message: '已添加' });
  } catch (error) {
    console.error('添加自选股失败:', error.message);
    res.status(500).json({ success: false, message: '添加失败' });
  }
});

// 删除自选股/持仓
app.post('/api/custom-stocks/delete', (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    
    const { stock_code, stock_market, type } = req.body;
    const stockType = type || 1;  // 默认为自选股
    
    if (!stock_code || !stock_market) {
      return res.status(400).json({ success: false, message: '缺少股票代码或市场' });
    }
    
    // 删除自选股/持仓
    db.run(`DELETE FROM custom_stocks WHERE user_id = '${userId}' AND stock_code = '${stock_code}' AND stock_market = '${stock_market}' AND type = ${stockType}`);
    saveDatabase();
    
    console.log(`✅ 用户 ${userId} 删除${stockType === 2 ? '持仓' : '自选股'}：${stock_market}${stock_code}`);
    res.json({ success: true, message: '已删除' });
  } catch (error) {
    console.error('删除失败:', error.message);
    res.status(500).json({ success: false, message: '删除失败' });
  }
});

// ==================== 定时任务 API ====================

// 获取定时任务列表
app.get('/api/scheduled-tasks', (req, res) => {
  try {
    if (req.session?.userRole !== '1') {
      return res.status(403).json({ success: false, message: '无权访问' });
    }
    
    // 从数据库读取任务
    const result = db.exec('SELECT * FROM scheduled_tasks ORDER BY created_at DESC');
    
    const tasks = result.length > 0 ? result[0].values.map(row => ({
      id: row[0],
      name: row[1],
      type: row[2],
      cron: row[3],
      status: row[4],
      lastRun: row[5],
      createdAt: row[6]
    })) : [];
    
    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error('获取定时任务失败:', error.message);
    res.status(500).json({ success: false, message: '获取定时任务失败' });
  }
});

// 新增定时任务
app.post('/api/scheduled-tasks', (req, res) => {
  try {
    if (req.session?.userRole !== '1') {
      return res.status(403).json({ success: false, message: '无权访问' });
    }
    
    const { name, type, cron, status } = req.body;
    const id = `task_${Date.now()}`;
    
    db.run(`INSERT INTO scheduled_tasks (id, name, type, cron, status) VALUES ('${id}', '${name}', '${type}', '${cron}', ${status})`);
    saveDatabase();
    
    // 如果任务启用，立即加载调度
    if (status === 1) {
      loadScheduledTasks();
    }
    
    res.json({ success: true, message: '任务已创建', data: { id } });
  } catch (error) {
    console.error('创建定时任务失败:', error.message);
    res.status(500).json({ success: false, message: '创建任务失败' });
  }
});

// 更新定时任务
app.put('/api/scheduled-tasks/:id', (req, res) => {
  try {
    if (req.session?.userRole !== '1') {
      return res.status(403).json({ success: false, message: '无权访问' });
    }
    
    const { id } = req.params;
    const { name, type, cron, status } = req.body;
    
    db.run(`UPDATE scheduled_tasks SET name='${name}', type='${type}', cron='${cron}', status=${status} WHERE id='${id}'`);
    saveDatabase();
    
    // 重新加载调度器
    loadScheduledTasks();
    
    res.json({ success: true, message: '任务已更新' });
  } catch (error) {
    console.error('更新定时任务失败:', error.message);
    res.status(500).json({ success: false, message: '更新任务失败' });
  }
});

// 删除定时任务
app.delete('/api/scheduled-tasks/:id', (req, res) => {
  try {
    if (req.session?.userRole !== '1') {
      return res.status(403).json({ success: false, message: '无权访问' });
    }
    
    const { id } = req.params;
    db.run(`DELETE FROM scheduled_tasks WHERE id='${id}'`);
    saveDatabase();
    
    res.json({ success: true, message: '任务已删除' });
  } catch (error) {
    console.error('删除定时任务失败:', error.message);
    res.status(500).json({ success: false, message: '删除任务失败' });
  }
});

// 执行定时任务
app.post('/api/scheduled-tasks/:id/run', async (req, res) => {
  try {
    if (req.session?.userRole !== '1') {
      return res.status(403).json({ success: false, message: '无权访问' });
    }
    
    const { id } = req.params;
    
    // 根据任务类型执行
    const result = db.exec(`SELECT type FROM scheduled_tasks WHERE id='${id}'`);
    if (result.length === 0) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }
    
    const taskType = result[0].values[0][0];
    
    // 异步执行任务
    if (taskType === 'sync-securities') {
      syncSecurities(db).then(result => {
        console.log('✅ 证券同步完成:', result);
        db.run(`UPDATE scheduled_tasks SET last_run=datetime('now') WHERE id='${id}'`);
        saveDatabase();
      }).catch(err => {
        console.error('❌ 证券同步失败:', err.message);
      });
    }
    
    if (taskType === 'sync-tick-trade') {
      syncTickTrade(db).then(result => {
        console.log('✅ 逐笔成交同步完成:', result);
        db.run(`UPDATE scheduled_tasks SET last_run=datetime('now') WHERE id='${id}'`);
        saveDatabase();
      }).catch(err => {
        console.error('❌ 逐笔成交同步失败:', err.message);
      });
    }
    
    res.json({ success: true, message: '任务已开始执行' });
  } catch (error) {
    console.error('执行定时任务失败:', error.message);
    res.status(500).json({ success: false, message: '执行任务失败' });
  }
});

// 获取证券同步状态
app.get('/api/securities/status', (req, res) => {
  try {
    if (req.session?.userRole !== '1') {
      return res.status(403).json({ success: false, message: '无权访问' });
    }
    
    // 查询证券表统计
    const countResult = db.exec('SELECT COUNT(*) FROM securities');
    const total = countResult[0]?.values[0]?.[0] || 0;
    
    const marketCount = db.exec('SELECT market, COUNT(*) as cnt FROM securities GROUP BY market');
    const byMarket = {};
    if (marketCount.length > 0) {
      marketCount[0].values.forEach(row => {
        byMarket[row[0]] = row[1];
      });
    }
    
    res.json({
      success: true,
      data: {
        total,
        byMarket,
        lastUpdate: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('获取证券状态失败:', error.message);
    res.status(500).json({ success: false, message: '获取状态失败' });
  }
});

// 获取下一个 cron 执行时间
function getNextCronTime(cronExpr) {
  try {
    const next = new Date();
    next.setHours(6, 0, 0, 0);
    if (next <= new Date()) {
      next.setDate(next.getDate() + 1);
    }
    return next.toISOString();
  } catch {
    return null;
  }
}

// 主页（需要登录）
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ==================== 证券信息 API ====================

// 获取证券列表（分页）
app.get('/api/securities', (req, res) => {
  try {
    const { page = 1, pageSize = 20, search = '', market = '', fuzzy = 'false' } = req.query;
    
    // 限制每页最大数量不超过 200
    const safePageSize = Math.min(parseInt(pageSize) || 20, 200);
    const offset = (parseInt(page) - 1) * safePageSize;
    
    let where = 'WHERE 1=1';
    if (search) {
      if (fuzzy === 'true') {
        // 模糊查询：支持证券代码或名称中包含搜索词
        where += ` AND (stock_code LIKE '%${search}%' OR stock_name LIKE '%${search}%')`;
      } else {
        // 精确查询
        where += ` AND (stock_code = '${search}' OR stock_name LIKE '%${search}%')`;
      }
    }
    if (market) {
      where += ` AND market = '${market}'`;
    }
    
    // 总数
    const countResult = db.exec(`SELECT COUNT(*) FROM securities ${where}`);
    const total = countResult[0]?.values[0]?.[0] || 0;
    
    // 数据
    const result = db.exec(`SELECT stock_code, stock_name, market, status, updated_at FROM securities ${where} ORDER BY stock_code LIMIT ${safePageSize} OFFSET ${offset}`);
    
    const data = result.length > 0 ? result[0].values.map(row => ({
      stock_code: row[0],
      stock_name: row[1],
      market: row[2],
      status: row[3],
      updated_at: row[4]
    })) : [];
    
    res.json({ success: true, data, total, page: parseInt(page), pageSize: safePageSize });
  } catch (error) {
    console.error('获取证券列表失败:', error.message);
    res.status(500).json({ success: false, message: '获取证券列表失败' });
  }
});

// 获取证券统计
app.get('/api/securities/stats', (req, res) => {
  try {
    const countResult = db.exec('SELECT COUNT(*) FROM securities');
    const total = countResult[0]?.values[0]?.[0] || 0;
    
    const marketResult = db.exec('SELECT market, COUNT(*) as cnt FROM securities GROUP BY market');
    const byMarket = {};
    if (marketResult.length > 0) {
      marketResult[0].values.forEach(row => {
        byMarket[row[0]] = row[1];
      });
    }
    
    res.json({ success: true, data: { total, byMarket } });
  } catch (error) {
    console.error('获取证券统计失败:', error.message);
    res.status(500).json({ success: false, message: '获取统计失败' });
  }
});

// 获取证券搜索建议
app.get('/api/securities/suggestions', (req, res) => {
  try {
    const { search = '', limit = 10 } = req.query;
    
    if (!search || search.trim().length < 1) {
      return res.json({ success: true, data: [] });
    }
    
    // 模糊查询：支持证券代码或名称
    const where = `WHERE stock_code LIKE '${search}%' OR stock_name LIKE '%${search}%'`;
    const result = db.exec(`SELECT stock_code, stock_name, market FROM securities ${where} ORDER BY stock_code LIMIT ${parseInt(limit)}`);
    
    const data = result.length > 0 ? result[0].values.map(row => ({
      stock_code: row[0],
      stock_name: row[1],
      market: row[2]
    })) : [];
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('获取搜索建议失败:', error.message);
    res.status(500).json({ success: false, message: '获取搜索建议失败' });
  }
});

// 清空所有证券信息
app.post('/api/securities/clear-all', (req, res) => {
  try {
    if (req.session?.userRole !== '1') {
      return res.status(403).json({ success: false, message: '无权访问' });
    }
    
    db.run('DELETE FROM securities');
    saveDatabase();
    
    res.json({ success: true, message: '已清空所有证券信息' });
  } catch (error) {
    console.error('清空证券信息失败:', error.message);
    res.status(500).json({ success: false, message: '清空失败：' + error.message });
  }
});

// ==================== 逐笔成交明细 API ====================

// 查询逐笔成交明细（分页）
app.get('/api/tick-trade', (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      trade_date = '',
      symbol = '',
      market = '',
      direction = '',
      time_start = '',
      time_end = '',
      price_min = '',
      price_max = '',
      volume_min = '',
      volume_max = '',
      amount_min = '',
      amount_max = ''
    } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    const safePageSize = Math.min(parseInt(pageSize) || 20, 200);
    
    // 动态拼接 WHERE 条件
    let where = 'WHERE 1=1';
    const params = [];
    
    if (trade_date) {
      where += ' AND trade_date = ?';
      params.push(trade_date);
    }
    if (symbol) {
      where += ' AND symbol LIKE ?';
      params.push(`%${symbol}%`);
    }
    if (market) {
      where += ' AND market = ?';
      params.push(market);
    }
    if (direction) {
      where += ' AND direction = ?';
      params.push(direction);
    }
    if (time_start) {
      where += ' AND trade_time >= ?';
      params.push(time_start);
    }
    if (time_end) {
      where += ' AND trade_time <= ?';
      params.push(time_end);
    }
    if (price_min) {
      where += ' AND price >= ?';
      params.push(parseFloat(price_min));
    }
    if (price_max) {
      where += ' AND price <= ?';
      params.push(parseFloat(price_max));
    }
    if (volume_min) {
      where += ' AND volume >= ?';
      params.push(parseInt(volume_min));
    }
    if (volume_max) {
      where += ' AND volume <= ?';
      params.push(parseInt(volume_max));
    }
    if (amount_min) {
      where += ' AND amount >= ?';
      params.push(parseFloat(amount_min));
    }
    if (amount_max) {
      where += ' AND amount <= ?';
      params.push(parseFloat(amount_max));
    }
    
    // 总数
    const countResult = db.exec(`SELECT COUNT(*) FROM tick_trade ${where}`);
    const total = countResult[0]?.values[0]?.[0] || 0;
    
    // 数据
    const result = db.exec(`
      SELECT id, trade_date, symbol, market, trade_time, price, volume, amount, direction
      FROM tick_trade ${where}
      ORDER BY trade_date DESC, symbol ASC, trade_time ASC
      LIMIT ${safePageSize} OFFSET ${offset}
    `, params);
    
    const data = result.length > 0 ? result[0].values.map(row => ({
      id: row[0],
      trade_date: row[1],
      symbol: row[2],
      market: row[3],
      trade_time: row[4],
      price: row[5],
      volume: row[6],
      amount: row[7],
      direction: row[8]
    })) : [];
    
    res.json({ success: true, data, total, page: parseInt(page), pageSize: safePageSize });
  } catch (error) {
    console.error('查询逐笔成交失败:', error.message);
    res.status(500).json({ success: false, message: '查询失败：' + error.message });
  }
});

// 同步进度状态
let syncProgressState = {
  running: false,
  current: 0,
  total: 0,
  records: 0,
  startTime: 0
};

// 同步逐笔成交明细
app.post('/api/tick-trade/sync', async (req, res) => {
  try {
    if (req.session?.userRole !== '1') {
      return res.status(403).json({ success: false, message: '无权访问' });
    }
    
    // 如果已有同步任务在运行，拒绝新请求
    if (syncProgressState.running) {
      return res.status(400).json({ success: false, message: '已有同步任务正在运行，请稍后再试' });
    }
    
    console.log('🔄 开始同步逐笔成交明细（MyData API）...');
    
    // 初始化进度状态
    syncProgressState = {
      running: true,
      current: 0,
      total: 0,
      records: 0,
      startTime: Date.now()
    };
    
    // 异步执行同步任务，实时更新进度
    (async () => {
      try {
        // 先获取证券列表更新总数
        const result = db.exec(`
          SELECT COUNT(*) FROM securities 
          WHERE status = 1 
          AND (
            (market = 'sh' AND stock_code LIKE '60____%')
            OR (market = 'sh' AND stock_code LIKE '68____%')
            OR (market = 'sz' AND stock_code LIKE '00____%')
            OR (market = 'sz' AND stock_code LIKE '30____%')
            OR (market = 'sh' AND stock_code LIKE '51____%')
            OR (market = 'sh' AND stock_code LIKE '58____%')
            OR (market = 'sz' AND stock_code LIKE '15____%')
            OR (market = 'sz' AND stock_code LIKE '16____%')
            OR (market = 'sz' AND stock_code LIKE '18____%')
          )
        `);
        const total = result[0]?.values[0]?.[0] || 0;
        syncProgressState.total = total;
        
        console.log(`📊 总共需要同步 ${total} 只证券`);
        
        // 执行同步，传递进度回调
        const syncResult = await syncTickTrade(db, (current, total, records) => {
          // 实时更新进度状态
          syncProgressState.current = current;
          syncProgressState.records = records;
          console.log(`🔄 进度更新：${current}/${total}, 记录：${records}`);
        });
        
        console.log('✅ 逐笔成交同步完成:', syncResult);
        if (syncResult.success) {
          syncProgressState.current = syncResult.totalSecurities;
          syncProgressState.records = syncResult.totalRecords;
        }
        syncProgressState.running = false;
        saveDatabase(); // 保存到磁盘
      } catch (err) {
        console.error('❌ 逐笔成交同步失败:', err.message);
        syncProgressState.running = false;
      }
    })();
    
    res.json({ 
      success: true, 
      message: '同步任务已启动' 
    });
  } catch (error) {
    console.error('同步逐笔成交失败:', error.message);
    res.status(500).json({ success: false, message: '同步失败：' + error.message });
  }
});

// 查询同步进度
app.get('/api/tick-trade/sync-progress', (req, res) => {
  try {
    const duration = syncProgressState.running 
      ? ((Date.now() - syncProgressState.startTime) / 1000)
      : ((syncProgressState.startTime > 0) ? ((Date.now() - syncProgressState.startTime) / 1000) : 0);
    
    res.json({
      success: true,
      data: {
        running: syncProgressState.running,
        current: syncProgressState.current,
        total: syncProgressState.total,
        records: syncProgressState.records,
        duration: duration
      }
    });
  } catch (error) {
    console.error('查询同步进度失败:', error.message);
    res.status(500).json({ success: false, message: '查询进度失败' });
  }
});

// 暂停同步
app.post('/api/tick-trade/pause', (req, res) => {
  try {
    if (req.session?.userRole !== '1') {
      return res.status(403).json({ success: false, message: '无权访问' });
    }
    
    if (!syncProgressState.running) {
      return res.json({ success: true, message: '当前没有同步任务运行' });
    }
    
    // 设置暂停标志
    if (tickTradeSetAbort) {
      tickTradeSetAbort(true);
    }
    syncProgressState.running = false;
    saveDatabase(); // 保存已同步的数据
    
    console.log('⏸️ 用户请求暂停逐笔成交同步');
    res.json({ success: true, message: '同步已暂停' });
  } catch (error) {
    console.error('暂停同步失败:', error.message);
    res.status(500).json({ success: false, message: '暂停失败' });
  }
});

// 获取最新有数据的日期
app.get('/api/tick-trade/latest-date', (req, res) => {
  try {
    const result = db.exec(`
      SELECT MAX(trade_date) as latest_date FROM tick_trade
    `);
    const latestDate = result[0]?.values[0]?.[0] || null;
    
    res.json({
      success: true,
      data: { latestDate }
    });
  } catch (error) {
    console.error('获取最新日期失败:', error.message);
    res.status(500).json({ success: false, message: '获取最新日期失败' });
  }
});

// 获取逐笔成交统计
app.get('/api/tick-trade/stats', (req, res) => {
  try {
    const { trade_date = '' } = req.query;
    
    let where = 'WHERE 1=1';
    const params = [];
    
    if (trade_date) {
      where += ' AND trade_date = ?';
      params.push(trade_date);
    }
    
    // 总记录数
    const countResult = db.exec(`SELECT COUNT(*) FROM tick_trade ${where}`, params);
    const total = countResult[0]?.values[0]?.[0] || 0;
    
    // 按市场统计
    const marketResult = db.exec(`SELECT market, COUNT(*) as cnt FROM tick_trade ${where} GROUP BY market`, params);
    const byMarket = {};
    if (marketResult.length > 0) {
      marketResult[0].values.forEach(row => {
        byMarket[row[0]] = row[1];
      });
    }
    
    // 按方向统计
    const directionResult = db.exec(`SELECT direction, COUNT(*) as cnt FROM tick_trade ${where} GROUP BY direction`, params);
    const byDirection = {};
    if (directionResult.length > 0) {
      directionResult[0].values.forEach(row => {
        byDirection[row[0]] = row[1];
      });
    }
    
    res.json({ 
      success: true, 
      data: { 
        total, 
        byMarket, 
        byDirection,
        trade_date: trade_date || new Date().toISOString().split('T')[0]
      } 
    });
  } catch (error) {
    console.error('获取逐笔成交统计失败:', error.message);
    res.status(500).json({ success: false, message: '获取统计失败：' + error.message });
  }
});

// 清空指定日期的逐笔成交数据
app.post('/api/tick-trade/clear', (req, res) => {
  try {
    if (req.session?.userRole !== '1') {
      return res.status(403).json({ success: false, message: '无权访问' });
    }
    
    const { trade_date } = req.body;
    
    if (!trade_date) {
      return res.status(400).json({ success: false, message: '请指定日期' });
    }
    
    db.run('DELETE FROM tick_trade WHERE trade_date = ?', [trade_date]);
    saveDatabase();
    
    res.json({ success: true, message: `已清空 ${trade_date} 的逐笔成交数据` });
  } catch (error) {
    console.error('清空逐笔成交失败:', error.message);
    res.status(500).json({ success: false, message: '清空失败：' + error.message });
  }
});

// 同步证券信息 API
app.post('/api/securities/sync', async (req, res) => {
  try {
    if (req.session?.userRole !== '1') {
      return res.status(403).json({ success: false, message: '无权访问' });
    }
    
    console.log('🚀 收到证券同步请求（MyData API）');
    
    // 异步执行同步任务
    syncSecurities(db).then(result => {
      console.log('✅ 证券同步后台完成:', result);
      saveDatabase(); // 保存到磁盘
    }).catch(err => {
      console.error('❌ 证券同步后台失败:', err.message);
    });
    
    res.json({ 
      success: true, 
      message: '同步任务已启动，请在后台查看进度' 
    });
  } catch (error) {
    console.error('同步证券失败:', error.message);
    res.status(500).json({ success: false, message: '同步失败：' + error.message });
  }
});

// 自选股页面（需要登录）
app.get('/custom', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/custom.html'));
});

// 持仓页面（需要登录）
app.get('/positions', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/positions.html'));
});

// 数据管理页面（需要登录，管理员专用）
app.get('/data-manager', requireAuth, (req, res) => {
  // 检查是否是管理员
  if (req.session?.userRole !== '1') {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, '../public/data-manager.html'));
});

// 系统管理页面（需要登录，管理员专用）
app.get('/system', requireAuth, (req, res) => {
  // 检查是否是管理员
  if (req.session?.userRole !== '1') {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, '../public/system.html'));
});

// 服务器监控页面（需要登录，管理员专用）
app.get('/server-monitor', requireAuth, (req, res) => {
  // 检查是否是管理员
  if (req.session?.userRole !== '1') {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, '../public/server-monitor.html'));
});

// 定时任务页面（需要登录，管理员专用）
app.get('/scheduled-tasks', requireAuth, (req, res) => {
  if (req.session?.userRole !== '1') {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, '../public/scheduled-tasks.html'));
});

// 证券信息页面（需要登录，管理员专用）
app.get('/securities', requireAuth, (req, res) => {
  if (req.session?.userRole !== '1') {
    // 管理员权限不足，返回错误页面
    return res.status(403).send(`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>无权限访问 - 证券信息管理</title>
  <style>
    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
    .error-container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin: 0 auto; max-width: 500px; }
    .error-code { font-size: 72px; color: #ff6b6b; margin-bottom: 10px; }
    .error-message { font-size: 24px; color: #333; margin-bottom: 20px; }
    .error-desc { color: #666; margin-bottom: 30px; }
    .btn { background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; }
    .btn:hover { background: #0056b3; }
  </style>
</head>
<body>
  <div class="error-container">
    <div class="error-code">403</div>
    <div class="error-message">无权限访问</div>
    <div class="error-desc">此页面仅限管理员访问</div>
    <a href="/" class="btn">返回首页</a>
  </div>
</body>
</html>`);
  }
  res.sendFile(path.join(__dirname, '../public/securities.html'));
});

// 逐笔成交明细页面（需要登录，管理员专用）
app.get('/tick-trade', requireAuth, (req, res) => {

// 分时数据查询页面
app.get('/intraday-data', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/intraday-data.html'));
});

// 资金诊断页面
app.get('/capital-diagnosis', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/stock-detail/capital-diagnosis.html'));
});
  if (req.session?.userRole !== '1') {

// 分时数据查询页面
app.get('/intraday-data', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/intraday-data.html'));
});

// 资金诊断页面
app.get('/capital-diagnosis', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/stock-detail/capital-diagnosis.html'));
});
    return res.redirect('/');

// 分时数据查询页面
app.get('/intraday-data', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/intraday-data.html'));
});

// 资金诊断页面
app.get('/capital-diagnosis', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/stock-detail/capital-diagnosis.html'));
});
  }

// 分时数据查询页面
app.get('/intraday-data', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/intraday-data.html'));
});

// 资金诊断页面
app.get('/capital-diagnosis', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/stock-detail/capital-diagnosis.html'));
});
  res.sendFile(path.join(__dirname, '../public/tick-trade.html'));

// 分时数据查询页面
app.get('/intraday-data', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/intraday-data.html'));
});

// 资金诊断页面
app.get('/capital-diagnosis', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/stock-detail/capital-diagnosis.html'));
});
});

// 分时数据查询页面
app.get('/intraday-data', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/intraday-data.html'));
});

// 资金诊断页面
app.get('/capital-diagnosis', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/stock-detail/capital-diagnosis.html'));
});

// 证券行情页面（需要登录）
app.get('/stock', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/stock.html'));
});

// 获取本机 IP
function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const HOST_IP = getLocalIP();

// 启动服务器
async function startServer() {
  // 初始化数据库
  try {
    await initDatabase();
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error.message);
    console.log('⚠️  将继续启动，但登录功能可能不可用');
  }
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║     A 股实时监控系统启动成功！                        ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log(`║  本地访问：http://localhost:${PORT}                    ║`);
    console.log(`║  局域网访问：http://${HOST_IP}:${PORT}                  ║`);
    console.log(`║  公网访问：http://<你的公网 IP>:${PORT}                ║`);
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('');
    console.log('数据源：东方财富 API、腾讯财经 API');
    console.log('交易时间自动刷新，非交易时间显示缓存数据');
    console.log('用户认证：SQLite 数据库');
    console.log('');
    
    loadCache();
    // 交易时间获取实时数据，非交易时间也获取一次最新 API 数据
    if (isTradingTime()) {
      fetchAllData();
    } else {
      console.log('⏰ 非交易时间，获取最新 API 数据...');
      // 非交易时间也获取一次 API 数据，用于周末复盘查看
      fetchAllData().then(() => {
        saveCache(); // 保存最新数据到缓存
      }).catch(e => {
        console.error('获取 API 数据失败:', e.message);
      });
    }
  });
}

startServer();

// 分时数据查询 API
app.get('/api/intraday-data', (req, res) => {
  try {
    // 确保表存在
    try {
      db.run(`CREATE TABLE IF NOT EXISTS intraday_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_code TEXT NOT NULL,
        trade_date TEXT NOT NULL,
        time TEXT NOT NULL,
        price REAL,
        open REAL,
        high REAL,
        low REAL,
        volume INTEGER,
        amount REAL,
        prevClose REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_intraday_code_date ON intraday_data(stock_code, trade_date)`);
      saveDatabase();
    } catch (e) {
      console.log('⚠️ 表已存在或创建失败:', e.message);
    }
    
    const { page = 1, pageSize = 50, stock_code = '', trade_date = '', market = '' } = req.query;
    const safePage = parseInt(page) || 1;
    const safePageSize = Math.min(parseInt(pageSize) || 50, 500);
    const offset = (safePage - 1) * safePageSize;
    
    // 构建查询条件
    const conditions = [];
    if (stock_code) conditions.push(`stock_code = '${stock_code}'`);
    if (trade_date) conditions.push(`trade_date = '${trade_date}'`);
    if (market) conditions.push(`stock_code LIKE '${market}%'`);
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // 查询总数
    const countResult = db.exec(`SELECT COUNT(*) FROM intraday_data ${whereClause}`);
    const total = countResult.length > 0 ? countResult[0].values[0][0] : 0;
    
    // 查询数据
    const result = db.exec(`
      SELECT stock_code, trade_date, time, price, open, high, low, volume, amount, prevClose
      FROM intraday_data ${whereClause}
      ORDER BY trade_date DESC, time ASC
      LIMIT ${safePageSize} OFFSET ${offset}
    `);
    
    const data = result.length > 0 ? result[0].values.map(row => ({
      stock_code: row[0],
      trade_date: row[1],
      time: row[2],
      price: row[3],
      open: row[4],
      high: row[5],
      low: row[6],
      volume: row[7],
      amount: row[8],
      prevClose: row[9]
    })) : [];
    
    res.json({ success: true, data, total, page: safePage, pageSize: safePageSize });
    
  } catch (error) {
    console.error('分时数据查询失败:', error.message);
    res.status(500).json({ success: false, message: '查询失败' });
  }
});
