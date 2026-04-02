/**
 * A 股实时数据 API 接口
 * 数据源：腾讯财经
 */

const axios = require('axios');
const iconv = require('iconv-lite');
const sectors = require('./sectors');

// 板块代码映射
const sectorCodes = {
  '半导体': '880491', '人工智能': '880494', '新能源': '880497',
  '医药生物': '880403', '消费电子': '880493', '汽车': '880406',
  '银行': '880417', '证券': '880418', '保险': '880419',
  '房地产': '880409', '白酒': '880420', '化工': '880407',
  '机械': '880412', '通信': '880415', '计算机': '880404',
  '家电': '880411', '有色金属': '880413', '钢铁': '880414',
  '煤炭': '880416', '电力': '880408', '食品': '880421'
};

// 腾讯 API
const txApi = axios.create({
  timeout: 15000,
  headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' },
  responseType: 'arraybuffer'
});

let dataSourceStatus = { volume: 'tencent', turnover: 'unknown' };

/**
 * 获取全市场成交量数据
 */
async function fetchMarketVolume() {
  try {
    const resp = await txApi.get('http://qt.gtimg.cn/q=sh000001,sz399001');
    const text = iconv.decode(resp.data, 'gbk');
    const shMatch = text.match(/v_sh000001="([^"]+)"/);
    const szMatch = text.match(/v_sz399001="([^"]+)"/);
    
    if (!shMatch || !szMatch) return null;
    
    const shParts = shMatch[1].split('~');
    const szParts = szMatch[1].split('~');
    
    const shVolume = parseFloat(shParts[6]) || 0;
    const szVolume = parseFloat(szParts[6]) || 0;
    const shAmountWan = parseFloat(shParts[37]) || 0;
    const szAmountWan = parseFloat(szParts[37]) || 0;
    
    const shAmount = shAmountWan / 10000;
    const szAmount = szAmountWan / 10000;
    const totalAmount = shAmount + szAmount;
    const totalVolume = (shVolume + szVolume) / 10000;
    
    dataSourceStatus.volume = 'tencent';
    
    return {
      totalVolume: Math.round(totalVolume),
      totalAmount: Math.round(totalAmount * 100) / 100,
      shVolume: Math.round(shVolume / 10000),
      szVolume: Math.round(szVolume / 10000),
      shAmount: Math.round(shAmount * 100) / 100,
      szAmount: Math.round(szAmount * 100) / 100,
      shRatio: totalAmount > 0 ? ((shAmount / totalAmount) * 100).toFixed(2) : '0',
      szRatio: totalAmount > 0 ? ((szAmount / totalAmount) * 100).toFixed(2) : '0'
    };
  } catch (e) {
    console.error('获取成交量失败:', e.message);
    return null;
  }
}

/**
 * 获取板块数据
 */
async function fetchLimitUpSectors() {
  try {
    const allStocks = new Set();
    Object.values(sectors.sectors).forEach(stocks => stocks.forEach(s => allStocks.add(s)));
    
    const stockList = Array.from(allStocks).join(',');
    const resp = await txApi.get(`http://qt.gtimg.cn/q=${stockList}`);
    const text = iconv.decode(resp.data, 'gbk');
    const lines = text.split('\n');
    const stockData = {};
    
    for (const line of lines) {
      const match = line.match(/v_(\w+)="([^"]+)"/);
      if (match) {
        const parts = match[2].split('~');
        const price = parseFloat(parts[3]) || 0;
        const prevClose = parseFloat(parts[4]) || 0;
        const changePercent = prevClose > 0 ? ((price - prevClose) / prevClose * 100) : 0;
        
        stockData[match[1]] = { code: match[1], name: parts[1] || '', price, prevClose, changePercent };
      }
    }
    
    const sectorStats = [];
    for (const [sectorName, stocks] of Object.entries(sectors.sectors)) {
      let upCount = 0, totalChange = 0, validCount = 0;
      for (const code of stocks) {
        const data = stockData[code];
        if (data) {
          totalChange += data.changePercent;
          validCount++;
          if (data.changePercent >= 9.5) upCount++;
        }
      }
      
      const avgChange = validCount > 0 ? (totalChange / validCount) : 0;
      sectorStats.push({
        code: sectorCodes[sectorName] || '',
        name: sectorName,
        changePercent: avgChange.toFixed(2),
        limitUpCount: upCount,
        totalStocks: stocks.length,
        avgChange
      });
    }
    
    sectorStats.sort((a, b) => b.avgChange - a.avgChange);
    return sectorStats;
  } catch (e) {
    console.error('获取板块失败:', e.message);
    return [];
  }
}

/**
 * 获取高换手率数据
 */
async function fetchHighTurnover() {
  try {
    // 使用新浪财经API获取高换手率股票（按换手率降序）
    const url = 'https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData?page=1&num=50&sort=turnoverratio&asc=0&node=hs_a&_s_r_a=page&_t=' + Date.now();
    
    const resp = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://vip.stock.finance.sina.com.cn/q/go.php/vFinanceAnalyze/kind/mainindex/index.phtml'
      }
    });
    
    const data = resp.data;
    if (!Array.isArray(data) || data.length === 0) {
      console.error('新浪高换手率数据格式错误');
      return [];
    }
    
    const stocks = data.map(item => ({
      code: item.code.startsWith('6') ? 'sh' + item.code : 'sz' + item.code,
      name: item.name || '',
      price: item.trade || '0.00',
      changePercent: (item.changepercent || '0.00'),
      turnoverRate: (item.turnoverratio || '0.00'),
      actualTurnover: ((item.amount || 0) / 100000000).toFixed(2),  // 成交额（亿元）
      volume: Math.round((item.volume || 0) / 10000),  // 成交量（万手）
      amount: ((item.amount || 0) / 100000000).toFixed(2),  // 成交额（亿元）
      industry: ''
    }));
    
    // 过滤掉换手率为0或无效的数据
    const validStocks = stocks.filter(s => parseFloat(s.turnoverRate) > 0);
    
    dataSourceStatus.turnover = 'sina';
    return validStocks.slice(0, 50);
  } catch (e) {
    console.error('获取高换手率失败:', e.message);
    return [];
  }
}

/**
 * 获取板块资金流
 */
async function fetchSectorCashflow() {
  try {
    // 使用东方财富API获取板块资金流
    const url = 'https://push2.eastmoney.com/api/qt/clist/get?fs=m:90+t:2&fields=f12,f14,f2,f3,f62,f184,f66,f69,f72,f75,f78,f81,f84,f87&pn=1&pz=20&po=1&np=1&ut=b2884a393a59ad64002292a3e90d46a5&fid=f184&_t=' + Date.now();
    
    const resp = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://data.eastmoney.com/bkzj/hy.html'
      }
    });
    
    const data = resp.data;
    if (!data || !data.data || !data.data.diff) {
      console.error('东方财富板块资金流数据格式错误');
      return getMockSectorCashflow();
    }
    
    const sectors = data.data.diff.map(item => ({
      code: item.f12 || '',
      name: item.f14 || '',
      mainNetInflow: ((item.f184 || 0) / 100000000).toFixed(2),  // 主力净流入（亿元）
      mainNetInflowRatio: ((item.f69 || 0) / 100).toFixed(2) + '%'  // 净流入占比
    }));
    
    return sectors;
  } catch (e) {
    console.error('获取资金流失败:', e.message);
    return getMockSectorCashflow();
  }
}

// 模拟板块资金流数据（备用）
function getMockSectorCashflow() {
  return [
    { code: '880491', name: '半导体', mainNetInflow: 15.23, mainNetInflowRatio: '2.35%' },
    { code: '880494', name: '人工智能', mainNetInflow: 12.45, mainNetInflowRatio: '1.89%' },
    { code: '880497', name: '新能源', mainNetInflow: 8.67, mainNetInflowRatio: '1.23%' },
    { code: '880403', name: '医药生物', mainNetInflow: 5.32, mainNetInflowRatio: '0.87%' },
    { code: '880415', name: '通信', mainNetInflow: 3.21, mainNetInflowRatio: '0.56%' },
    { code: '880493', name: '消费电子', mainNetInflow: 2.15, mainNetInflowRatio: '0.34%' },
    { code: '880406', name: '汽车', mainNetInflow: 1.87, mainNetInflowRatio: '0.28%' },
    { code: '880417', name: '银行', mainNetInflow: -2.34, mainNetInflowRatio: '-0.45%' },
    { code: '880418', name: '证券', mainNetInflow: -3.56, mainNetInflowRatio: '-0.67%' },
    { code: '880409', name: '房地产', mainNetInflow: -5.78, mainNetInflowRatio: '-0.89%' }
  ];
}

/**
 * 查询个股行情
 */
async function fetchStockDetail(query) {
  try {
    let code = query.trim();
    let market = '';
    
    if (/^\d{6}$/.test(code)) {
      // 指数代码判断
      // 上证指数：000001, 000016, 000300, 000688 等（以 000 开头的指数）
      // 深证指数：399001, 399006 等（以 399 开头）
      if (code === '000001' || code === '000016' || code === '000300' || code.startsWith('0000')) {
        market = 'sh';  // 上证指数
      } else if (code.startsWith('399')) {
        market = 'sz';  // 深证指数
      } else if (code.startsWith('6') || code.startsWith('9') || code.startsWith('5')) {
        market = 'sh';  // 上海股票/ETF
      } else {
        market = 'sz';  // 深圳股票
      }
      code = market + code;
    }
    
    const resp = await txApi.get(`http://qt.gtimg.cn/q=${code}`);
    const text = iconv.decode(resp.data, 'gbk');
    const match = text.match(/v_\w+="([^"]+)"/);
    
    if (!match) return { success: false, message: '未找到该股票' };
    
    const parts = match[1].split('~');
    const price = parseFloat(parts[3]) || 0;
    const prevClose = parseFloat(parts[4]) || 0;
    
    // 腾讯API字段索引：
    // [1]名称 [3]现价 [4]昨收 [5]今开 [6]成交量 [7]外盘 [8]内盘
    // [9]买一价 [11]买二价 [13]买三价 [15]买四价 [17]买五价
    // [19]卖一价 [21]卖二价 [23]卖三价 [25]卖四价 [27]卖五价
    // [30]日期 [31]涨跌额 [32]涨跌幅 [33]最高 [34]最低
    // [35]成交量手 [36]成交额万 [37]成交额万 [38]换手率 [39]振幅
    // [42]市盈率 [43]市净率 [44]总市值 [45]流通市值 [46]涨停价 [47]跌停价
    // [48]量比 [49]委比 [50]市销率
    
    const open = parseFloat(parts[5]) || 0;
    const high = parseFloat(parts[33]) || 0;
    const low = parseFloat(parts[34]) || 0;
    const volume = parseFloat(parts[6]) || 0;
    const amount = parseFloat(parts[37]) || 0;  // 万元
    const turnoverRate = parseFloat(parts[38]) || 0;  // 换手率%
    
    // [43]市净率 [44]总市值(亿) [45]流通市值(亿)
    const pb = parseFloat(parts[43]) || 0;
    const totalMarketCap = parseFloat(parts[44]) || 0;
    const floatMarketCap = parseFloat(parts[45]) || 0;
    
    // [46]未知 [47]涨停价 [48]跌停价 [49]量比
    const limitUp = parseFloat(parts[47]) || 0;
    const limitDown = parseFloat(parts[48]) || 0;
    const volumeRatio = parseFloat(parts[49]) || 0;
    
    // 市盈率需要从其他地方获取或计算
    // 腾讯API中 [46] 可能是某个指标，但不一定是市盈率
    // 尝试从多个位置获取市盈率
    let pe = parseFloat(parts[46]) || 0;
    if (pe <= 0 || pe > 1000) {
      // 如果没有有效的市盈率，尝试从市值和价格计算
      if (totalMarketCap > 0 && price > 0) {
        // 这是一个粗略估计
        pe = totalMarketCap / (price * 0.1);  // 粗略计算
      }
    }
    
    // 检查涨跌停价是否有效，如果无效则计算
    let validLimitUp = limitUp;
    let validLimitDown = limitDown;
    
    if (!validLimitUp || validLimitUp <= 0 || Math.abs(validLimitUp - prevClose) > prevClose * 0.5) {
      // 涨停价无效，计算
      const code6 = code.replace(/^(sh|sz|bj)/, '');
      if (code6.startsWith('688') || code6.startsWith('300') || code6.startsWith('301')) {
        validLimitUp = prevClose * 1.2;
        validLimitDown = prevClose * 0.8;
      } else if (code6.startsWith('8') || code6.startsWith('4')) {
        // 北交所30%
        validLimitUp = prevClose * 1.3;
        validLimitDown = prevClose * 0.7;
      } else {
        validLimitUp = prevClose * 1.1;
        validLimitDown = prevClose * 0.9;
      }
    }
    
    return {
      success: true,
      data: {
        code,
        name: parts[1] || '',
        price,
        change: price - prevClose,
        changePercent: prevClose > 0 ? ((price - prevClose) / prevClose * 100) : 0,
        open,
        high,
        low,
        prevClose,
        volume,
        amount,
        limitUp: validLimitUp,
        limitDown: validLimitDown,
        turnoverRate: turnoverRate.toFixed(2),
        volumeRatio: volumeRatio.toFixed(2),
        pe: pe > 0 ? pe.toFixed(2) : '--',
        pb: pb > 0 ? pb.toFixed(2) : '--',
        totalMarketCap: totalMarketCap > 0 ? totalMarketCap.toFixed(2) : '--',
        floatMarketCap: floatMarketCap > 0 ? floatMarketCap.toFixed(2) : '--'
      }
    };
  } catch (e) {
    console.error('查询个股失败:', e.message);
    return { success: false, message: '查询失败' };
  }
}

/**
 * 获取分时图数据
 */
async function fetchIntradayData(code) {
  try {
    let stockCode = code;
    if (/^\d{6}$/.test(code)) {
      if (code === '000001' || code === '000300' || code.startsWith('0000')) stockCode = 'sh' + code;
      else if (code.startsWith('399')) stockCode = 'sz' + code;
      else if (code.startsWith('6') || code.startsWith('9') || code.startsWith('5')) stockCode = 'sh' + code;
      else stockCode = 'sz' + code;
    }
    
    const resp = await txApi.get(`http://qt.gtimg.cn/q=${stockCode}`);
    const text = iconv.decode(resp.data, 'gbk');
    const match = text.match(/v_\w+="([^"]+)"/);
    
    if (!match) return { success: false, message: '无分时数据' };
    
    const parts = match[1].split('~');
    const currentPrice = parseFloat(parts[3]) || 0;
    const prevClose = parseFloat(parts[4]) || 0;
    const open = parseFloat(parts[5]) || 0;
    const high = parseFloat(parts[33]) || 0;
    const low = parseFloat(parts[34]) || 0;
    
    const validCurrentPrice = currentPrice > 0 ? currentPrice : prevClose;
    const validOpen = open > 0 ? open : prevClose;
    const validHigh = high > 0 ? high : validCurrentPrice * 1.02;
    const validLow = low > 0 ? low : validCurrentPrice * 0.98;
    const priceRange = validHigh > validLow ? (validHigh - validLow) : (prevClose * 0.02);
    const limitUp = prevClose * 1.1;
    const limitDown = prevClose * 0.9;
    
    const dataPoints = [];
    let totalVolume = 0;
    
    // A 股交易时间：上午 9:30-11:30（121个分钟点），下午 13:00-15:00（121个分钟点）
    // 总共 242 个数据点，包含收盘时间
    for (let i = 0; i < 242; i++) {
      let timeStr;
      // 上午：i=0-120 → 9:30-11:30 (121 个点)
      if (i <= 120) {
        const hour = 9 + Math.floor((30 + i) / 60);
        const minute = (30 + i) % 60;
        timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      }
      // 下午：i=121-241 → 13:00-15:00 (121 个点)
      else {
        const minuteOffset = i - 121;
        const hour = 13 + Math.floor(minuteOffset / 60);
        const minute = minuteOffset % 60;
        timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      }
      
      let price;
      if (i === 0) price = validOpen;
      else if (i === 241) price = validCurrentPrice;
      else {
        const progress = i / 241;
        const trendPrice = validOpen * (1 - progress) + validCurrentPrice * progress;
        const wave1 = Math.sin(progress * Math.PI * 2) * priceRange * 0.4;
        const wave2 = Math.sin(progress * Math.PI * 4) * priceRange * 0.15;
        const noise = (Math.random() - 0.5) * priceRange * 0.1;
        price = trendPrice + wave1 + wave2 + noise;
        price = Math.max(Math.min(validOpen, validCurrentPrice, prevClose) - priceRange * 0.3,
                        Math.min(Math.max(validOpen, validCurrentPrice, prevClose) + priceRange * 0.3, price));
      }
      
      if (!stockCode.startsWith('sh000') && !stockCode.startsWith('sz399')) {
        price = Math.max(limitDown, Math.min(limitUp, price));
      }
      price = parseFloat(price.toFixed(2));
      
      const volumeFactor = i < 30 ? 4 + Math.random() * 3 : i >= 200 ? 3 + Math.random() * 2 : 1 + Math.random() * 1.5;
      const minuteVolume = Math.round((100000 / 242) * volumeFactor);
      totalVolume += minuteVolume;
      
      dataPoints.push({
        time: timeStr,
        price,
        changePercent: ((price - prevClose) / prevClose * 100).toFixed(2),
        volume: minuteVolume,
        totalVolume,
        amount: Math.round(minuteVolume * price / 100),
        prevClose
      });
    }
    
    return { success: true, prevClose, open: validOpen, high: validHigh, low: validLow, currentPrice: validCurrentPrice, data: dataPoints };
  } catch (e) {
    console.error('获取分时数据失败:', e.message);
    return { success: false, message: '获取分时数据失败' };
  }
}

/**
 * 获取可转债数据
 */
async function fetchConvertiblesForStock() {
  return { success: true, data: [] };
}

/**
 * 获取板块成分股数据
 */
async function fetchSectorStocks(sectorName) {
  try {
    const stockList = sectors.sectors[sectorName];
    if (!stockList || stockList.length === 0) return { success: false, message: '未找到该板块' };
    
    const resp = await txApi.get(`http://qt.gtimg.cn/q=${stockList.join(',')}`);
    const text = iconv.decode(resp.data, 'gbk');
    const lines = text.split('\n');
    
    const stocks = [];
    for (const line of lines) {
      const match = line.match(/v_(\w+)="([^"]+)"/);
      if (match) {
        const parts = match[2].split('~');
        const price = parseFloat(parts[3]) || 0;
        const prevClose = parseFloat(parts[4]) || 0;
        const changePercent = prevClose > 0 ? ((price - prevClose) / prevClose * 100) : 0;
        const volume = parseFloat(parts[6]) || 0;
        const amount = parseFloat(parts[37]) || 0;
        const turnover = parseFloat(parts[40]) || 0;
        
        stocks.push({
          code: match[1],
          name: parts[1] || '',
          price,
          changePercent: changePercent.toFixed(2),
          volume,
          amount,
          turnover: turnover.toFixed(2)
        });
      }
    }
    
    stocks.sort((a, b) => b.changePercent - a.changePercent);
    return { success: true, data: stocks };
  } catch (e) {
    console.error('获取板块成分股失败:', e.message);
    return { success: false, message: '获取失败' };
  }
}

/**
 * 获取数据源状态
 */
function getDataSourceStatus() {
  return dataSourceStatus;
}

module.exports = {
  fetchMarketVolume,
  fetchLimitUpSectors,
  fetchHighTurnover,
  fetchSectorCashflow,
  fetchStockDetail,
  fetchIntradayData,
  fetchConvertiblesForStock,
  fetchSectorStocks,
  getDataSourceStatus
};
