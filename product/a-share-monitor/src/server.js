const express = require('express');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const {
  fetchMarketVolume,
  fetchLimitUpSectors,
  fetchHighTurnover,
  fetchSectorCashflow,
  fetchStockDetail,
  fetchIntradayData,
  fetchConvertiblesForStock,
  fetchSectorStocks,
  getDataSourceStatus
} = require('./data-api');
const stockList = require('./stocks');

const app = express();
const PORT = 3000;

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

// 加载缓存
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf8');
      const cached = JSON.parse(data);
      const today = new Date().toDateString();
      if (cached.date === today) {
        marketData = cached.data;
        console.log('✓ 已加载缓存数据');
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

// 获取全部数据
async function fetchAllData() {
  console.log('📡 开始获取实时数据...');
  
  const [volume, limitUpSectors, highTurnover, sectorCashflow] = await Promise.all([
    fetchMarketVolume(),
    fetchLimitUpSectors(),
    fetchHighTurnover(),
    fetchSectorCashflow()
  ]);
  
  marketData = {
    volume,
    limitUpSectors,
    highTurnover,
    sectorCashflow,
    lastUpdate: new Date().toISOString()
  };
  
  console.log('✓ 数据获取完成');
  if (volume) {
    console.log(`  总成交额：${volume.totalAmount} 亿元`);
  }
  if (limitUpSectors && limitUpSectors.length > 0) {
    console.log(`  涨停板块：${limitUpSectors.length} 个`);
  }
  if (highTurnover && highTurnover.length > 0) {
    console.log(`  高换手率：${highTurnover.length} 只`);
  }
  if (sectorCashflow && sectorCashflow.length > 0) {
    console.log(`  资金流：${sectorCashflow.length} 个板块`);
  }
  
  return marketData;
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
  if (isTradingTime()) {
    await fetchAllData();
  }
  res.json(marketData);
});

// 数据源状态 API
app.get('/api/data-sources', (req, res) => {
  res.json(getDataSourceStatus());
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
      if (code.startsWith('sh') || code.startsWith('sz') || code.startsWith('bj')) return code;
      // 北交所股票（以8或4开头）
      if (code.startsWith('8') || code.startsWith('4')) return 'bj' + code;
      // 上海股票/ETF/指数
      if (code.startsWith('6') || code.startsWith('9') || code.startsWith('5')) return 'sh' + code;
      // 深圳股票（包括创业板）
      if (code.startsWith('0') || code.startsWith('3')) return 'sz' + code;
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
        const code = fullCode.replace(/^(sh|sz|bj)/, '');
        
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
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': '*/*'
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
    const resp = await txSearchApi.get(searchUrl, { maxRedirects: 5 });
    // 腾讯返回的是 UTF-8 编码的 JSON 风格字符串（包含 Unicode 转义）
    const text = resp.data.toString('utf8');
    
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
        
        // 过滤：只返回 A 股（sh/sz + 6 位数字代码）
        if ((market === 'sh' || market === 'sz') && /^\d{6}$/.test(code)) {
          results.push({
            code: code,
            name: name,
            market: market,
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
    
  } catch (e) {
    console.error('全市场搜索失败:', e.message);
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
  }
});

// 个股行情 API（支持代码和名称搜索）
app.get('/api/stock/:query', async (req, res) => {
  let query = req.params.query.trim();
  const queryUpper = query.toUpperCase();
  
  // 提取代码（支持 sh/sz 前缀）
  const codeMatch = query.match(/(SH|SZ)?(\d{6})/i);
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

// 证券行情页面
app.get('/stock', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/stock.html'));
});

// 分时图 API
app.get('/api/intraday/:code', async (req, res) => {
  const result = await fetchIntradayData(req.params.code);
  res.json(result);
});

// 可转债 API
app.get('/api/convertibles/:stockCode', async (req, res) => {
  const result = await fetchConvertiblesForStock(req.params.stockCode);
  res.json(result);
});

// 静态文件
app.use(express.static(path.join(__dirname, '../public')));

// 主页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
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
  console.log('');
  
  loadCache();
  fetchAllData();
});
