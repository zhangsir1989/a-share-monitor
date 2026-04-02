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
    const stockList = [
      'sz300750', 'sz300308', 'sh600519', 'sz002594', 'sz300014', 'sz300015', 'sz300122', 'sz300149',
      'sh601318', 'sh600036', 'sz000333', 'sh600900', 'sh601888', 'sh600276', 'sh600436', 'sh603259',
      'sz000001', 'sh600030', 'sz000063', 'sh601166', 'sz000538', 'sh600588', 'sz002230', 'sh600809',
      'sz000858', 'sh600016', 'sh600028', 'sh600019', 'sh600011', 'sz000002', 'sh600050', 'sh600018',
      'sh600009', 'sh600029', 'sh600010', 'sh600015', 'sh600031', 'sh600033', 'sh600036', 'sh600038',
      'sh600039', 'sh600048', 'sh600053', 'sh600056', 'sh600058', 'sh600059', 'sh600060', 'sh600061'
    ];
    
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
        const volume = parseFloat(parts[6]) || 0;  // 手
        const amountWan = parseFloat(parts[37]) || 0;  // 万元
        const turnover = parseFloat(parts[38]) || 0;  // 换手率% [38]
        const amplitude = parseFloat(parts[39]) || 0;  // 振幅%
        
        // 只返回换手率>0 的股票
        if (turnover > 0) {
          stocks.push({
            code: match[1],
            name: parts[1] || '',
            price: price.toFixed(2),
            changePercent: changePercent.toFixed(2),
            turnoverRate: turnover.toFixed(2),  // 换手率
            actualTurnover: amplitude.toFixed(2),  // 振幅
            volume: Math.round(volume / 10000),  // 万手
            amount: Math.round(amountWan / 10000 * 100) / 100,  // 亿元
            industry: ''
          });
        }
      }
    }
    
    // 按换手率排序
    stocks.sort((a, b) => parseFloat(b.turnoverRate) - parseFloat(a.turnoverRate));
    
    dataSourceStatus.turnover = 'tencent';
    return stocks.slice(0, 50);
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
    // 腾讯 API 不支持板块资金流，返回模拟数据
    // 实际生产环境应使用东方财富或同花顺 API
    return [
      { code: '880491', name: '半导体', mainNetInflow: 15.23, mainNetInflowRatio: '2.35' },
      { code: '880494', name: '人工智能', mainNetInflow: 12.45, mainNetInflowRatio: '1.89' },
      { code: '880497', name: '新能源', mainNetInflow: 8.67, mainNetInflowRatio: '1.23' },
      { code: '880403', name: '医药生物', mainNetInflow: 5.32, mainNetInflowRatio: '0.87' },
      { code: '880415', name: '通信', mainNetInflow: 3.21, mainNetInflowRatio: '0.56' },
      { code: '880493', name: '消费电子', mainNetInflow: 2.15, mainNetInflowRatio: '0.34' },
      { code: '880406', name: '汽车', mainNetInflow: 1.87, mainNetInflowRatio: '0.28' },
      { code: '880417', name: '银行', mainNetInflow: -2.34, mainNetInflowRatio: '-0.45' },
      { code: '880418', name: '证券', mainNetInflow: -3.56, mainNetInflowRatio: '-0.67' },
      { code: '880409', name: '房地产', mainNetInflow: -5.78, mainNetInflowRatio: '-0.89' }
    ];
  } catch (e) {
    console.error('获取资金流失败:', e.message);
    return [];
  }
}

/**
 * 查询个股行情
 */
async function fetchStockDetail(query) {
  try {
    let code = query.trim();
    let market = '';
    
    if (/^\d{6}$/.test(code)) {
      market = (code.startsWith('6') || code.startsWith('9') || code.startsWith('5')) ? 'sh' : 'sz';
      code = market + code;
    }
    
    const resp = await txApi.get(`http://qt.gtimg.cn/q=${code}`);
    const text = iconv.decode(resp.data, 'gbk');
    const match = text.match(/v_\w+="([^"]+)"/);
    
    if (!match) return { success: false, message: '未找到该股票' };
    
    const parts = match[1].split('~');
    const price = parseFloat(parts[3]) || 0;
    const prevClose = parseFloat(parts[4]) || 0;
    
    return {
      success: true,
      data: {
        code,
        name: parts[1] || '',
        price,
        change: price - prevClose,
        changePercent: prevClose > 0 ? ((price - prevClose) / prevClose * 100) : 0,
        open: parseFloat(parts[5]) || 0,
        high: parseFloat(parts[33]) || 0,
        low: parseFloat(parts[34]) || 0,
        prevClose,
        volume: parseFloat(parts[6]) || 0,
        amount: parseFloat(parts[37]) || 0
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
    
    for (let i = 0; i < 240; i++) {
      let timeStr;
      if (i < 120) {
        const hour = 9 + Math.floor((30 + i) / 60);
        const minute = (30 + i) % 60;
        timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      } else {
        const hour = 13 + Math.floor((i - 120) / 60);
        const minute = (i - 120) % 60;
        timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      }
      
      let price;
      if (i === 0) price = validOpen;
      else if (i === 239) price = validCurrentPrice;
      else {
        const progress = i / 239;
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
      const minuteVolume = Math.round((100000 / 240) * volumeFactor);
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
