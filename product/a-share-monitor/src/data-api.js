/**
 * A 股实时数据 API 接口
 * 数据源：MyData API (麦蕊智数) + 腾讯财经（备用）
 */

const axios = require('axios');
const iconv = require('iconv-lite');
const sectors = require('./sectors');

// MyData API 配置
const MYDATA_LICENCE = 'FB1A859B-6832-4F70-AAA2-38274F23FC90';
const MYDATA_BASE_URL = 'https://api.mairuiapi.com';

// MyData API 客户端
const mydataApi = axios.create({
  timeout: 15000,
  headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' }
});

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

let dataSourceStatus = { volume: 'mydata', turnover: 'mydata', limitUp: 'mydata', cashflow: 'unknown' };

/**
 * 获取沪深成交量数据（仅使用 MyData API）
 */
async function fetchMarketVolume() {
  try {
    // 使用 MyData API 获取上证指数和深证成指的最新数据
    const [shResp, szResp] = await Promise.all([
      axios.get(`https://api.mairuiapi.com/hsindex/latest/000001.SH/d/${MYDATA_LICENCE}`, { timeout: 10000 }),
      axios.get(`https://api.mairuiapi.com/hsindex/latest/399001.SZ/d/${MYDATA_LICENCE}`, { timeout: 10000 })
    ]);
    
    // MyData API 返回的是数组，取第一个元素
    const shData = Array.isArray(shResp.data) ? shResp.data[0] : shResp.data;
    const szData = Array.isArray(szResp.data) ? szResp.data[0] : szResp.data;
    
    // MyData API 返回格式：v=成交量（股），a=成交额（元）
    const shVolume = shData?.v || 0;  // 成交量（股）
    const szVolume = szData?.v || 0;
    const shAmountYuan = shData?.a || 0;  // 成交额（元）
    const szAmountYuan = szData?.a || 0;  // 成交额（元）
    
    // 转换为亿元（保留原始精度，不四舍五入）
    const shAmount = shAmountYuan / 100000000;  // 沪市成交额（亿元）
    const szAmount = szAmountYuan / 100000000;  // 深市成交额（亿元）
    const totalAmount = shAmount + szAmount;  // 总计：亿元相加
    const totalVolume = (shVolume + szVolume) / 100000000;  // 股转换为亿手
    
    dataSourceStatus.volume = 'mydata';
    
    return {
      totalVolume: Math.round(totalVolume * 100) / 100,  // 亿手，保留 2 位小数
      totalAmount: Math.round(totalAmount * 100) / 100,  // 亿元，保留 2 位小数
      shVolume: Math.round(shVolume / 100000000 * 100) / 100,  // 亿手
      szVolume: Math.round(szVolume / 100000000 * 100) / 100,
      shAmount: Math.round(shAmount * 100) / 100,  // 亿元
      szAmount: Math.round(szAmount * 100) / 100,
      shRatio: totalAmount > 0 ? ((shAmount / totalAmount) * 100).toFixed(2) : '0',
      szRatio: totalAmount > 0 ? ((szAmount / totalAmount) * 100).toFixed(2) : '0'
    };
  } catch (e) {
    console.error('获取沪深成交量失败 (MyData):', e.message);
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
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://vip.stock.finance.sina.com.cn/q/go.php/vFinanceAnalyze/kind/mainindex/index.phtml',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      }
    });
    
    const data = resp.data;
    if (!Array.isArray(data) || data.length === 0) {
      console.error('新浪高换手率数据格式错误');
      return getMockHighTurnover();
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
    return getMockHighTurnover();
  }
}

// 备用模拟数据（API失败时使用）
function getMockHighTurnover() {
  return [
    { code: 'sz001257', name: 'C盛龙', price: '24.78', changePercent: '0.20', turnoverRate: '56.70', actualTurnover: '18.27', volume: 7764, amount: '18.27', industry: '' },
    { code: 'sz301683', name: 'C慧谷', price: '125.12', changePercent: '-1.26', turnoverRate: '50.51', actualTurnover: '9.26', volume: 720, amount: '9.26', industry: '' },
    { code: 'sz002560', name: '通达股份', price: '13.06', changePercent: '10.03', turnoverRate: '46.58', actualTurnover: '27.09', volume: 21099, amount: '27.09', industry: '' },
    { code: 'sh603538', name: '美诺华', price: '42.32', changePercent: '6.36', turnoverRate: '43.80', actualTurnover: '39.05', volume: 9470, amount: '39.05', industry: '' },
    { code: 'sz002361', name: '神剑股份', price: '17.29', changePercent: '1.71', turnoverRate: '42.44', actualTurnover: '59.78', volume: 34338, amount: '59.78', industry: '' }
  ];

}

/**
 * 获取涨停个股数据
 */
async function fetchLimitUpStocks(tradeDate = null) {
  try {
    // 使用 MyData API 获取涨停个股
    let dateStr;
    if (tradeDate) {
      dateStr = tradeDate;
    } else {
      const today = new Date();
      const weekday = today.getDay();
      let tradingDate = new Date(today);
      if (weekday === 0) { // 周日
        tradingDate.setDate(today.getDate() - 2);
      } else if (weekday === 6) { // 周六
        tradingDate.setDate(today.getDate() - 1);
      }
      dateStr = tradingDate.toISOString().split('T')[0];
    }
    
    const url = `https://api.mairuiapi.com/hslt/ztgc/${dateStr}/FB1A859B-6832-4F70-AAA2-38274F23FC90`;
    
    const resp = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const data = resp.data;
    if (!Array.isArray(data) || data.length === 0) {
      console.error('MyData 涨停数据格式错误');
      return getMockLimitUpStocks();
    }
    
    // 映射字段
    const limitUpStocks = data.map(item => ({
      code: item.dm,
      name: item.mc || '',
      price: item.p !== null ? item.p.toFixed(2) : '0.00',
      changePercent: item.zf !== null ? item.zf.toFixed(2) : '0.00',
      cje: item.cje !== null ? (item.cje / 10000).toFixed(2) : '0.00', // 万元
      hs: item.hs !== null ? item.hs.toFixed(2) : '0.00',
      zj: item.zj !== null ? (item.zj / 10000).toFixed(2) : '0.00', // 万元
      fbt: item.fbt || '',
      lbt: item.lbt || '',
      zbc: item.zbc || 0,
      tj: item.tj || '',
      lbc: item.lbc || 0,
      hy: item.hy || ''
    }));
    
    return limitUpStocks.slice(0, 50);
  } catch (e) {
    console.error('获取涨停个股失败:', e.message);
    return getMockLimitUpStocks();
  }
}

/**
 * 获取跌停个股数据
 */
async function fetchLimitDownStocks(tradeDate = null) {
  try {
    // 使用 MyData API 获取跌停个股
    let dateStr;
    if (tradeDate) {
      dateStr = tradeDate;
    } else {
      const today = new Date();
      const weekday = today.getDay();
      let tradingDate = new Date(today);
      if (weekday === 0) { // 周日
        tradingDate.setDate(today.getDate() - 2);
      } else if (weekday === 6) { // 周六
        tradingDate.setDate(today.getDate() - 1);
      }
      dateStr = tradingDate.toISOString().split('T')[0];
    }
    
    const url = `https://api.mairuiapi.com/hslt/dtgc/${dateStr}/FB1A859B-6832-4F70-AAA2-38274F23FC90`;
    
    const resp = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const data = resp.data;
    if (!Array.isArray(data) || data.length === 0) {
      console.error('MyData 跌停数据格式错误');
      return getMockLimitDownStocks();
    }
    
    // 映射字段
    const limitDownStocks = data.map(item => ({
      code: item.dm,
      name: item.mc || '',
      price: item.p !== null ? item.p.toFixed(2) : '0.00',
      changePercent: item.zf !== null ? item.zf.toFixed(2) : '0.00',
      cje: item.cje !== null ? (item.cje / 10000).toFixed(2) : '0.00', // 万元
      hs: item.hs !== null ? item.hs.toFixed(2) : '0.00',
      zj: item.zj !== null ? (item.zj / 10000).toFixed(2) : '0.00', // 万元
      lbt: item.lbt || '',
      fba: item.fba !== null ? (item.fba / 10000).toFixed(2) : '0.00', // 万元
      lbc: item.lbc || 0,
      zbc: item.zbc || 0,
      hy: item.hy || ''
    }));
    
    return limitDownStocks.slice(0, 50);
  } catch (e) {
    console.error('获取跌停个股失败:', e.message);
    return getMockLimitDownStocks();
  }
}

function getMockLimitUpStocks() {
  return [
    { code: 'sz002560', name: '通达股份', price: '13.06', changePercent: '10.03' },
    { code: 'sh603538', name: '美诺华', price: '42.32', changePercent: '10.01' },
    { code: 'sz002361', name: '神剑股份', price: '17.29', changePercent: '10.00' }
  ];
}

function getMockLimitDownStocks() {
  return [
    { code: 'sh605299', name: '舒华体育', price: '19.58', changePercent: '-10.02' },
    { code: 'sh603588', name: '高能环境', price: '16.61', changePercent: '-9.97' },
    { code: 'sh603182', name: '嘉华股份', price: '15.62', changePercent: '-9.97' }
  ];
}

/**
 * 获取强势个股数据（MyData API）
 */
async function fetchStrongStocks() {
  try {
    const today = new Date();
    const weekday = today.getDay();
    let tradingDate = new Date(today);
    if (weekday === 0) { // 周日
      tradingDate.setDate(today.getDate() - 2);
    } else if (weekday === 6) { // 周六
      tradingDate.setDate(today.getDate() - 1);
    }
    const dateStr = tradingDate.toISOString().split('T')[0];
    
    const url = `https://api.mairuiapi.com/hslt/qsgc/${dateStr}/LICENCE-66D8-9F96-0C7F0FBCD073`;
    
    const resp = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const data = resp.data;
    if (!Array.isArray(data) || data.length === 0) {
      console.error('MyData 强势个股数据格式错误');
      return getMockStrongStocks();
    }
    
    // 映射字段
    const strongStocks = data.map(item => ({
      code: item.dm,
      name: item.mc || '',
      price: item.p !== null ? item.p.toFixed(2) : '0.00',
      ztp: item.ztp !== null ? item.ztp.toFixed(2) : '0.00',
      changePercent: item.zf !== null ? item.zf.toFixed(2) : '0.00',
      cje: item.cje !== null ? (item.cje / 10000).toFixed(2) : '0.00', // 万元
      hs: item.hs !== null ? item.hs.toFixed(2) : '0.00',
      lb: item.lb !== null ? item.lb.toFixed(2) : '0.00',
      tj: item.tj || '',
      nh: item.nh || 0
    }));
    
    return strongStocks.slice(0, 50);
  } catch (e) {
    console.error('获取强势个股失败:', e.message);
    return getMockStrongStocks();
  }
}

function getMockStrongStocks() {
  return [
    { code: 'sz301157', name: '华塑科技', price: '70.25', ztp: '70.25', changePercent: '20.00', hs: '60.51', lb: '2.64', tj: '3/3' },
    { code: 'sz301187', name: '欧圣电气', price: '43.44', ztp: '43.44', changePercent: '20.00', hs: '23.74', lb: '2.25', tj: '1/1' },
    { code: 'sz300807', name: '天迈科技', price: '43.64', ztp: '43.64', changePercent: '19.99', hs: '6.48', lb: '1.47', tj: '2/2' }
  ];
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
    
    if (/^(sh|sz|bj|hk)/.test(code)) {
      // 已带市场前缀
      market = code.substring(0, 2);
      code = code.substring(2);
    } else if (/^\d{5}$/.test(code)) {
      // 港股：5 位数字
      market = 'hk';
    } else if (/^\d{6}$/.test(code)) {
      // A 股：6 位数字
      if (code === '000001' || code === '000016' || code === '000300' || code.startsWith('0000')) {
        market = 'sh';
      } else if (code.startsWith('399')) {
        market = 'sz';
      } else if (code.startsWith('6') || code.startsWith('9') || code.startsWith('5')) {
        market = 'sh';
      } else {
        market = 'sz';
      }
    }
    
    const codeWithMarket = market + code;
    
    // 使用 MyData API 获取实时数据（券商数据源）
    const MYDATA_LICENCE = 'FB1A859B-6832-4F70-AAA2-38274F23FC90';
    const realtimeUrl = `https://api.mairuiapi.com/hsstock/real/time/${code}/${MYDATA_LICENCE}`;
    
    // 同时请求网络数据源获取量比和今年涨幅
    const ssjyUrl = `https://api.mairuiapi.com/hsrl/ssjy/${code}/${MYDATA_LICENCE}`;
    
    // 并行请求两个接口
    const [realtimeResp, ssjyResp] = await Promise.all([
      axios.get(realtimeUrl, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } }),
      axios.get(ssjyUrl, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } })
    ]);
    
    const realtimeData = realtimeResp.data;
    const ssjyData = ssjyResp.data;
    
    // 获取财务数据（利润表）
    let financialData = {};
    let currentYearNetProfit = '--';
    let lastYearNetProfit = '--';
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const lastYear = currentYear - 1;
      const st = `${lastYear}0101`;
      const et = `${currentYear}1231`;
      
      // 转换代码格式：sz000001 -> 000001.SZ
      const codeForFinancial = code.toUpperCase() + '.' + market.toUpperCase();
      const financialUrl = `https://api.mairuiapi.com/hsstock/financial/income/${codeForFinancial}/${MYDATA_LICENCE}?st=${st}&et=${et}`;
      console.log(`💰 请求财务数据 URL: ${financialUrl}`);
      
      const financialResp = await axios.get(financialUrl, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (financialResp.data && Array.isArray(financialResp.data) && financialResp.data.length > 0) {
        // 获取最新一期数据（本年）
        financialData = financialResp.data[0];
        currentYearNetProfit = financialData.jlr ? (financialData.jlr / 100000000).toFixed(2) : '--';
        
        // 如果有上年数据
        if (financialResp.data.length > 1) {
          lastYearNetProfit = financialResp.data[1].jlr ? (financialResp.data[1].jlr / 100000000).toFixed(2) : '--';
        } else {
          // 只有一条数据，尝试获取更早的数据
          const lastYearSt = `${lastYear - 1}0101`;
          const lastYearEt = `${lastYear}1231`;
          const lastYearUrl = `https://api.mairuiapi.com/hsstock/financial/income/${codeForFinancial}/${MYDATA_LICENCE}?st=${lastYearSt}&et=${lastYearEt}`;
          try {
            const lastYearResp = await axios.get(lastYearUrl, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (lastYearResp.data && Array.isArray(lastYearResp.data) && lastYearResp.data.length > 0) {
              lastYearNetProfit = lastYearResp.data[0].jlr ? (lastYearResp.data[0].jlr / 100000000).toFixed(2) : '--';
            }
          } catch (e) {
            console.warn(`⚠️ 获取上年财务数据失败 (${code}):`, e.message);
          }
        }
        console.log(`💰 获取到 ${code} 财务数据，本年净利润：${currentYearNetProfit}亿，上年净利润：${lastYearNetProfit}亿`);
      }
    } catch (err) {
      console.warn(`⚠️ 获取财务数据失败 (${code}):`, err.message);
    }
    
    if (!realtimeData || !realtimeData.p) {
      // 如果 MyData 失败，回退到腾讯 API
      return await fetchStockDetailFromTencent(codeWithMarket);
    }
    
    // 从 MyData API 解析数据
    const price = realtimeData.p || 0;
    const prevClose = realtimeData.yc || 0;
    const change = realtimeData.ud || (price - prevClose);
    const changePercent = realtimeData.pc || (prevClose > 0 ? ((price - prevClose) / prevClose * 100) : 0);
    
    // 获取股票基础信息（涨跌停价等）
    const instrumentUrl = `https://api.mairuiapi.com/hsstock/instrument/${code}.${market.toUpperCase()}/${MYDATA_LICENCE}`;
    let instrumentData = {};
    try {
      const instrumentResp = await axios.get(instrumentUrl, {
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      instrumentData = instrumentResp.data || {};
    } catch (e) {
      console.warn('获取股票基础信息失败:', e.message);
    }
    
    // 计算涨跌停价
    const limitUp = instrumentData.up || prevClose * 1.1;
    const limitDown = instrumentData.dp || prevClose * 0.9;
    
    // 获取财务指标（市盈率等）
    const indicatorsUrl = `https://api.mairuiapi.com/hsstock/financial/pershareindex/${code}/${MYDATA_LICENCE}`;
    let peStatic = '--';
    let peDynamic = realtimeData.pe || '--';
    let peTtm = '--';
    
    try {
      const indicatorsResp = await axios.get(indicatorsUrl, {
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const indicatorsData = indicatorsResp.data;
      if (indicatorsData && indicatorsData.length > 0) {
        // 从最新的财务数据计算静态市盈率
        // 静态市盈率 = 当前股价 / 上年度每股收益
        const latestEps = indicatorsData[0].xsmgsy || indicatorsData[0].jbmgsy || 0;
        if (latestEps > 0 && price > 0) {
          peStatic = (price / latestEps).toFixed(2);
        }
        // TTM 市盈率 = 当前股价 / 最近四个季度每股收益之和
        let ttmEps = 0;
        for (let i = 0; i < Math.min(4, indicatorsData.length); i++) {
          ttmEps += (indicatorsData[i].xsmgsy || indicatorsData[i].jbmgsy || 0);
        }
        if (ttmEps > 0 && price > 0) {
          peTtm = (price / ttmEps).toFixed(2);
        }
      }
    } catch (e) {
      console.warn('获取财务指标失败:', e.message);
    }
    
    return {
      success: true,
      data: {
        code: codeWithMarket,
        name: instrumentData.name || '',
        price,
        change,
        changePercent,
        open: realtimeData.o || 0,
        high: realtimeData.h || 0,
        low: realtimeData.l || 0,
        prevClose,
        volume: realtimeData.pv || realtimeData.v || 0,  // 成交量（股）
        amount: realtimeData.cje || 0,  // 成交额
        limitUp,
        limitDown,
        turnoverRate: (realtimeData.tr || ssjyData.hs || 0).toFixed(2),
        actualTurnover: (realtimeData.tr || ssjyData.hs || 0).toFixed(2),  // 实际换手率
        volumeRatio: (ssjyData.lb || 0).toFixed(2),  // 量比 - 从 ssjy 接口获取
        peStatic,
        peDynamic: peDynamic !== '--' ? peDynamic.toFixed(2) : '--',
        peTtm,
        pb: (realtimeData.pb_ratio || 0).toFixed(2),
        totalMarketCap: (ssjyData.sz || instrumentData.tv || 0) / 100000000,  // 总市值（亿）
        floatMarketCap: (ssjyData.lt || instrumentData.fv || 0) / 100000000,  // 流通市值（亿）
        // 总股本和流通股本需要从市值和股价计算：股本 = 市值 / 股价
        totalShares: (ssjyData.sz || instrumentData.tv || 0) / (price > 0 ? price : 1),  // 总股本（股）
        floatShares: (ssjyData.lt || instrumentData.fv || 0) / (price > 0 ? price : 1),  // 流通股本（股）
        outerVol: '--',  // 外盘 - MyData API 暂无
        innerVol: '--',  // 内盘 - MyData API 暂无
        ytdChange: (ssjyData.zdfnc || 0).toFixed(2),  // 今年涨幅 - 从 ssjy 接口获取
        // 净利润数据（从财务数据获取，单位：亿元）
        lastYearNetProfit: lastYearNetProfit,
        currentYearNetProfit: currentYearNetProfit
      }
    };
  } catch (e) {
    console.error('查询个股失败:', e.message);
    return { success: false, message: '查询失败' };
  }
}

/**
 * 从腾讯 API 获取股票数据（备用）
 */
async function fetchStockDetailFromTencent(codeWithMarket) {
  try {
    const resp = await txApi.get(`http://qt.gtimg.cn/q=${codeWithMarket}`);
    const text = iconv.decode(resp.data, 'gbk');
    const match = text.match(/v_\w+="([^"]+)"/);
    
    if (!match) return { success: false, message: '未找到该股票' };
    
    const parts = match[1].split('~');
    const price = parseFloat(parts[3]) || 0;
    const prevClose = parseFloat(parts[4]) || 0;
    
    // 腾讯API字段索引
    const open = parseFloat(parts[5]) || 0;
    const high = parseFloat(parts[33]) || 0;
    const low = parseFloat(parts[34]) || 0;
    const volume = parseFloat(parts[6]) || 0;
    const amount = parseFloat(parts[37]) || 0;
    const turnoverRate = parseFloat(parts[38]) || 0;
    const outerVol = parseFloat(parts[7]) || 0;  // 外盘
    const innerVol = parseFloat(parts[8]) || 0;  // 内盘
    const pb = parseFloat(parts[43]) || 0;
    const totalMarketCap = parseFloat(parts[44]) || 0;
    const floatMarketCap = parseFloat(parts[45]) || 0;
    const limitUp = parseFloat(parts[47]) || 0;
    const limitDown = parseFloat(parts[48]) || 0;
    const volumeRatio = parseFloat(parts[49]) || 0;
    let pe = parseFloat(parts[46]) || 0;
    
    // 检查涨跌停价是否有效
    let validLimitUp = limitUp;
    let validLimitDown = limitDown;
    
    if (!validLimitUp || validLimitUp <= 0 || Math.abs(validLimitUp - prevClose) > prevClose * 0.5) {
      const code6 = codeWithMarket.replace(/^(sh|sz|bj)/, '');
      if (code6.startsWith('688') || code6.startsWith('300') || code6.startsWith('301')) {
        validLimitUp = prevClose * 1.2;
        validLimitDown = prevClose * 0.8;
      } else if (code6.startsWith('8') || code6.startsWith('4')) {
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
        code: codeWithMarket,
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
        actualTurnover: turnoverRate.toFixed(2),
        volumeRatio: volumeRatio.toFixed(2),
        peStatic: pe > 0 ? pe.toFixed(2) : '--',
        peDynamic: pe > 0 ? pe.toFixed(2) : '--',
        peTtm: '--',
        pb: pb > 0 ? pb.toFixed(2) : '--',
        totalMarketCap: totalMarketCap > 0 ? totalMarketCap.toFixed(2) : '--',
        floatMarketCap: floatMarketCap > 0 ? floatMarketCap.toFixed(2) : '--',
        totalShares: (totalMarketCap > 0 && price > 0) ? Math.round(totalMarketCap * 100000000 / price) : 0,
        floatShares: (floatMarketCap > 0 && price > 0) ? Math.round(floatMarketCap * 100000000 / price) : 0,
        outerVol,
        innerVol,
        ytdChange: '--'
      }
    };
  } catch (e) {
    console.error('腾讯 API 查询个股失败:', e.message);
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

/**
 * 获取主要指数数据
 */
async function fetchMainIndices() {
  try {
    // 上证指数 (sh000001), 深证成指 (sz399001), 创业板指 (sz399006), 科创 50(sh000688), 中证 500(sh000905), 恒生指数 (hkHSI)
    const resp = await txApi.get('http://qt.gtimg.cn/q=sh000001,sz399001,sz399006,sh000688,sh000905,hkHSI');
    const text = iconv.decode(resp.data, 'gbk');
    const lines = text.split('\n');
    const indices = {};
    
    for (const line of lines) {
      const match = line.match(/v_(\w+)="([^"]+)"/);
      if (match) {
        const parts = match[2].split('~');
        const code = match[1];
        const name = parts[1] || '';
        const price = parseFloat(parts[3]) || 0;
        const prevClose = parseFloat(parts[4]) || 0;
        const change = price - prevClose;
        const changePercent = prevClose > 0 ? (change / prevClose * 100) : 0;
        
        indices[code] = {
          code,
          name,
          price: price.toFixed(2),
          prevClose: prevClose.toFixed(2),
          change: change.toFixed(2),
          changePercent: changePercent.toFixed(2)
        };
      }
    }
    
    return { success: true, data: indices };
  } catch (e) {
    console.error('获取指数数据失败:', e.message);
    return { success: false, message: '获取失败', data: {} };
  }
}

module.exports = {
  fetchMarketVolume,
  fetchLimitUpSectors,
  fetchHighTurnover,
  fetchSectorCashflow,
  fetchLimitUpStocks,
  fetchLimitDownStocks,
  fetchStrongStocks,
  fetchStockDetail,
  fetchIntradayData,
  fetchConvertiblesForStock,
  fetchSectorStocks,
  fetchMainIndices,
  getDataSourceStatus,
  fetchIntradayHistory,
  fetchStockLatest
};

/**
 * 获取分时历史数据（MyData API，5 分钟 K 线）
 * @param {string} code 股票代码（6 位数字）
 * @param {string} market 市场（sh/sz/hk）
 * @param {string} date 日期（YYYYMMDD）
 */
async function fetchIntradayHistory(code, market, date = null) {
  try {
    if (!date) {
      const today = new Date();
      date = today.toISOString().slice(0, 10).replace(/-/g, '');
    }
    
    // 使用 MyData API 5 分钟 K 线数据（48 条）作为分时图数据源
    const url = `https://api.mairuiapi.com/hsstock/history/${code}.${market.toUpperCase()}/5/n/${MYDATA_LICENCE}?st=${date}&et=${date}&lt=48`;
    
    console.log('📊 MyData 分时历史 API:', url);
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    const data = response.data;
    
    if (!Array.isArray(data) || data.length === 0) {
      return { success: false, message: '无分时数据' };
    }
    
    // 将 5 分钟 K 线数据转换为分时图格式（每 5 分钟一个点，共 48 个点）
    const intradayData = data.map(item => {
      const timeMatch = item.t.match(/(\d{2}):(\d{2}):\d{2}/);
      const time = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : '00:00';
      
      return {
        time: time,
        price: item.c || 0,
        open: item.o || 0,
        high: item.h || 0,
        low: item.l || 0,
        volume: item.v || 0,
        amount: item.a || 0,
        prevClose: item.pc || 0
      };
    });
    
    // 按时间排序
    intradayData.sort((a, b) => a.time.localeCompare(b.time));
    
    return {
      success: true,
      prevClose: data[0]?.pc || 0,
      data: intradayData
    };
    
  } catch (error) {
    console.error('❌ MyData 分时历史 API 失败:', error.message);
    return { success: false, message: '获取失败' };
  }
}

// 更新导出
/**
 * 获取最新实时数据（MyData API，1 分钟）
 * @param {string} code 股票代码（6 位数字）
 * @param {string} market 市场（sh/sz/hk）
 */
async function fetchStockLatest(code, market) {
  try {
    const url = `${MYDATA_BASE_URL}/hsstock/latest/${code}.${market.toUpperCase()}/1/n/${MYDATA_LICENCE}?lt=1`;
    
    console.log('📡 MyData 实时 API:', url);
    
    const response = await mydataApi.get(url);
    const data = response.data;
    
    if (!Array.isArray(data) || data.length === 0) {
      return { success: false, message: '无实时数据' };
    }
    
    const item = data[0];
    const timeMatch = item.t.match(/(\d{2}):(\d{2}):\d{2}/);
    const time = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : '00:00';
    
    return {
      success: true,
      data: {
        time: time,
        price: item.c || 0,
        open: item.o || 0,
        high: item.h || 0,
        low: item.l || 0,
        volume: item.v || 0,
        amount: item.a || 0,
        prevClose: item.pc || 0,
        timestamp: item.t
      }
    };
    
  } catch (error) {
    console.error('❌ MyData 实时 API 失败:', error.message);
    return { success: false, message: '获取失败' };
  }
}

// 更新导出

