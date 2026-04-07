/**
 * 个股详细页面逻辑
 * 对接东方财富 API 获取实时行情数据
 */

// 全局状态
const stockState = {
  code: '',
  market: '',
  refreshTimer: null,
  refreshInterval: 3000
};

// DOM 元素
let elements = {};

// ==================== 初始化 ====================

function init() {
  console.log('📈 个股详细页面初始化...');
  
  cacheElements();
  
  // 检查登录状态
  if (!checkLoginStatus()) return;
  
  // 获取 URL 参数中的股票代码
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const market = params.get('market');
  
  if (!code) {
    alert('❌ 缺少股票代码参数');
    window.location.href = '/custom';
    return;
  }
  
  stockState.code = code;
  stockState.market = market || 'sh';
  
  console.log('📊 股票代码:', code, '市场:', market);
  
  // 更新页面标题
  updateStockTitle(code);
  
  // 绑定事件
  bindEvents();
  
  // 加载数据
  loadStockData();
  
  // 启动定时刷新
  startAutoRefresh();
  
  // 启动时钟
  startClock();
}

function cacheElements() {
  elements = {
    // 基本信息
    stockName: document.getElementById('stock-name'),
    stockCode: document.getElementById('stock-code'),
    stockMarket: document.getElementById('stock-market'),
    currentPrice: document.getElementById('current-price'),
    changeValue: document.getElementById('price-change').querySelector('.change-value'),
    changePercent: document.getElementById('price-change').querySelector('.change-percent'),
    
    // 买卖盘口
    sellPrices: [
      document.getElementById('sell-5-price'),
      document.getElementById('sell-4-price'),
      document.getElementById('sell-3-price'),
      document.getElementById('sell-2-price'),
      document.getElementById('sell-1-price')
    ],
    sellVolumes: [
      document.getElementById('sell-5-vol'),
      document.getElementById('sell-4-vol'),
      document.getElementById('sell-3-vol'),
      document.getElementById('sell-2-vol'),
      document.getElementById('sell-1-vol')
    ],
    buyPrices: [
      document.getElementById('buy-1-price'),
      document.getElementById('buy-2-price'),
      document.getElementById('buy-3-price'),
      document.getElementById('buy-4-price'),
      document.getElementById('buy-5-price')
    ],
    buyVolumes: [
      document.getElementById('buy-1-vol'),
      document.getElementById('buy-2-vol'),
      document.getElementById('buy-3-vol'),
      document.getElementById('buy-4-vol'),
      document.getElementById('buy-5-vol')
    ],
    orderRatio: document.getElementById('order-ratio'),
    
    // 基本数据
    basicLatest: document.getElementById('basic-latest'),
    basicChange: document.getElementById('basic-change'),
    basicChangePct: document.getElementById('basic-change-pct'),
    basicHigh: document.getElementById('basic-high'),
    basicLow: document.getElementById('basic-low'),
    basicOpen: document.getElementById('basic-open'),
    basicPrevClose: document.getElementById('basic-prev-close'),
    basicVolumeRatio: document.getElementById('basic-volume-ratio'),
    basicTurnover: document.getElementById('basic-turnover'),
    basicVolume: document.getElementById('basic-volume'),
    basicAmount: document.getElementById('basic-amount'),
    basicMarketCap: document.getElementById('basic-market-cap'),
    basicFloatCap: document.getElementById('basic-float-cap'),
    basicPeStatic: document.getElementById('basic-pe-static'),
    basicPeTtm: document.getElementById('basic-pe-ttm'),
    
    // 资金流向
    mainInflow: document.getElementById('main-inflow'),
    mainOutflow: document.getElementById('main-outflow'),
    mainNetflow: document.getElementById('main-netflow'),
    
    // 成交明细
    tradeDetailBody: document.getElementById('trade-detail-body'),
    
    // 按钮
    btnBack: document.getElementById('btn-back'),
    btnAddCustom: document.getElementById('btn-add-custom'),
    chartTabs: document.querySelectorAll('.chart-tabs .tab-btn'),
    detailTabs: document.querySelectorAll('.detail-tabs .tab-btn')
  };
}

function checkLoginStatus() {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  const username = localStorage.getItem('username');
  const userRole = localStorage.getItem('userRole') || '0';
  
  if (!isLoggedIn || !username) {
    alert('❌ 请先登录');
    window.location.href = '/login.html';
    return false;
  }
  
  const sidebarUsername = document.getElementById('sidebar-username');
  if (sidebarUsername) {
    sidebarUsername.textContent = username;
  }
  
  return true;
}

function updateStockTitle(code) {
  document.title = `${code} 个股详细 - A 股实时监控`;
  const stockTitle = document.getElementById('stock-title');
  if (stockTitle) {
    stockTitle.textContent = `📈 ${code} 个股详细`;
  }
}

// ==================== 数据加载 ====================

async function loadStockData() {
  try {
    console.log('📡 加载股票数据:', stockState.code);
    
    // 使用后端 API 获取实时行情（避免跨域问题）
    const response = await fetch(`/api/stock/${stockState.code}`);
    const result = await response.json();
    
    if (result.success && result.data) {
      const data = result.data;
      console.log('📊 股票数据:', data);
      
      // 更新基本信息
      updateBasicInfoFromBackend(data);
      
      // 更新买卖盘口（需要从后端获取详细数据）
      loadOrderBook();
      
      // 更新基本数据
      updateBasicDataFromBackend(data);
      
      // 加载成交明细
      loadTradeDetail();
      
      // 加载资金流向
      loadCapitalFlow(data);
    } else {
      console.error('❌ API 返回错误:', result);
      if (result.message) {
        alert('❌ ' + result.message);
      }
    }
  } catch (error) {
    console.error('❌ 加载股票数据失败:', error);
    alert('❌ 网络错误，请稍后重试');
  }
}

function updateBasicInfoFromBackend(data) {
  // 股票名称和代码
  if (elements.stockName) elements.stockName.textContent = data.name || '--';
  if (elements.stockCode) elements.stockCode.textContent = data.code.replace(/^sz|^sh/, '') || stockState.code;
  if (elements.stockMarket) elements.stockMarket.textContent = data.code.startsWith('sh') ? '沪市' : '深市';
  
  // 当前价格
  const price = data.price || 0;
  if (elements.currentPrice) {
    elements.currentPrice.textContent = price.toFixed(2);
    elements.currentPrice.className = 'current-price ' + (data.change >= 0 ? 'up' : 'down');
  }
  
  // 涨跌额和涨跌幅
  const change = data.change || 0;
  const changePct = data.changePercent || 0;
  if (elements.changeValue) {
    elements.changeValue.textContent = (change >= 0 ? '+' : '') + change.toFixed(2);
    elements.changeValue.className = 'change-value ' + (change >= 0 ? 'up' : 'down');
  }
  if (elements.changePercent) {
    elements.changePercent.textContent = (changePct >= 0 ? '+' : '') + changePct.toFixed(2) + '%';
    elements.changePercent.className = 'change-percent ' + (changePct >= 0 ? 'up' : 'down');
  }
}

function updateBasicDataFromBackend(data) {
  if (elements.basicLatest) elements.basicLatest.textContent = (data.price || 0).toFixed(2);
  if (elements.basicChange) {
    const change = data.change || 0;
    elements.basicChange.textContent = (change >= 0 ? '+' : '') + change.toFixed(2);
    elements.basicChange.className = 'basic-value ' + (change >= 0 ? 'up' : 'down');
  }
  if (elements.basicChangePct) {
    const pct = data.changePercent || 0;
    elements.basicChangePct.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
    elements.basicChangePct.className = 'basic-value ' + (pct >= 0 ? 'up' : 'down');
  }
  if (elements.basicHigh) elements.basicHigh.textContent = (data.high || 0).toFixed(2);
  if (elements.basicLow) elements.basicLow.textContent = (data.low || 0).toFixed(2);
  if (elements.basicOpen) elements.basicOpen.textContent = (data.open || 0).toFixed(2);
  if (elements.basicPrevClose) elements.basicPrevClose.textContent = (data.prevClose || 0).toFixed(2);
  if (elements.basicVolumeRatio) elements.basicVolumeRatio.textContent = (data.volumeRatio || 0).toFixed(2);
  if (elements.basicTurnover) elements.basicTurnover.textContent = (data.turnoverRate || 0).toFixed(2) + '%';
  if (elements.basicVolume) elements.basicVolume.textContent = formatVolume(data.volume);
  if (elements.basicAmount) elements.basicAmount.textContent = formatAmount(data.amount * 10000);  // 后端返回的是万为单位
  if (elements.basicMarketCap) elements.basicMarketCap.textContent = formatAmount(data.totalMarketCap * 100000000);  // 后端返回的是亿为单位
  if (elements.basicFloatCap) elements.basicFloatCap.textContent = formatAmount(data.floatMarketCap * 100000000);
  if (elements.basicPeStatic) elements.basicPeStatic.textContent = (data.pe || 0).toFixed(2);
  if (elements.basicPeTtm) elements.basicPeTtm.textContent = (data.pe || 0).toFixed(2);  // 暂时用静态市盈率代替
}

async function loadOrderBook() {
  // 从后端获取买卖盘口数据
  try {
    const secid = stockState.market === 'sh' ? `1.${stockState.code}` : `0.${stockState.code}`;
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f21,f22,f23,f24,f25,f26,f27,f28,f29,f30,f31,f32,f33,f34,f35,f36,f37,f38,f39,f40,f116`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://quote.eastmoney.com/'
      }
    });
    const result = await response.json();
    
    if (result.rc === 0 && result.data) {
      updateOrderBook(result.data);
    }
  } catch (error) {
    console.error('加载买卖盘口失败:', error);
  }
}

function updateOrderBook(data) {
  // 卖盘（f21-f30）- 注意：需要检查是否为 0 或 null
  const sellPrices = [data.f29, data.f27, data.f25, data.f23, data.f21];
  const sellVolumes = [data.f30, data.f28, data.f26, data.f24, data.f22];
  
  for (let i = 0; i < 5; i++) {
    if (elements.sellPrices[i]) {
      const price = sellPrices[i] ? (sellPrices[i] / 100).toFixed(2) : '--';
      elements.sellPrices[i].textContent = price;
      elements.sellPrices[i].className = 'order-price sell ' + (price !== '--' ? 'up' : '');
    }
    if (elements.sellVolumes[i]) {
      const vol = sellVolumes[i] ? formatVolume(sellVolumes[i]) : '--';
      elements.sellVolumes[i].textContent = vol;
    }
  }
  
  // 买盘（f31-f40）
  const buyPrices = [data.f31, data.f33, data.f35, data.f37, data.f39];
  const buyVolumes = [data.f32, data.f34, data.f36, data.f38, data.f40];
  
  for (let i = 0; i < 5; i++) {
    if (elements.buyPrices[i]) {
      const price = buyPrices[i] ? (buyPrices[i] / 100).toFixed(2) : '--';
      elements.buyPrices[i].textContent = price;
      elements.buyPrices[i].className = 'order-price buy ' + (price !== '--' ? 'down' : '');
    }
    if (elements.buyVolumes[i]) {
      const vol = buyVolumes[i] ? formatVolume(buyVolumes[i]) : '--';
      elements.buyVolumes[i].textContent = vol;
    }
  }
  
  // 委比
  if (elements.orderRatio) {
    const ratio = data.f116 || 0;
    elements.orderRatio.textContent = `委比：${ratio.toFixed(2)}%`;
    elements.orderRatio.style.color = ratio >= 0 ? 'var(--down-color)' : 'var(--up-color)';
  }
}

function updateBasicData(data) {
  // 安全获取数据，处理 undefined/null/0 的情况
  const getPrice = (val) => val ? (val / 100).toFixed(2) : '--';
  const getNum = (val, decimals = 2) => val ? val.toFixed(decimals) : '--';
  
  if (elements.basicLatest) elements.basicLatest.textContent = getPrice(data.f43);
  if (elements.basicChange) {
    const change = data.f3 ? (data.f3 / 100) : 0;
    elements.basicChange.textContent = (change >= 0 ? '+' : '') + change.toFixed(2);
    elements.basicChange.className = 'basic-value ' + (change >= 0 ? 'up' : 'down');
  }
  if (elements.basicChangePct) {
    const pct = data.f114 || 0;
    elements.basicChangePct.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
    elements.basicChangePct.className = 'basic-value ' + (pct >= 0 ? 'up' : 'down');
  }
  if (elements.basicHigh) elements.basicHigh.textContent = getPrice(data.f44);
  if (elements.basicLow) elements.basicLow.textContent = getPrice(data.f45);
  if (elements.basicOpen) elements.basicOpen.textContent = getPrice(data.f46);
  if (elements.basicPrevClose) elements.basicPrevClose.textContent = getPrice(data.f60);
  if (elements.basicVolumeRatio) elements.basicVolumeRatio.textContent = getNum(data.f104);
  if (elements.basicTurnover) elements.basicTurnover.textContent = getNum(data.f105) + '%';
  if (elements.basicVolume) elements.basicVolume.textContent = formatVolume(data.f47);
  if (elements.basicAmount) elements.basicAmount.textContent = formatAmount(data.f48);
  if (elements.basicMarketCap) elements.basicMarketCap.textContent = formatAmount(data.f84);
  if (elements.basicFloatCap) elements.basicFloatCap.textContent = formatAmount(data.f85);
  if (elements.basicPeStatic) elements.basicPeStatic.textContent = getNum(data.f92);
  if (elements.basicPeTtm) elements.basicPeTtm.textContent = getNum(data.f109);
}

function loadCapitalFlow(data) {
  // 模拟资金流向数据（因为东方财富 API 需要特殊权限）
  const netFlow = (Math.random() - 0.5) * 1000;
  const inflow = Math.abs(netFlow) * (0.5 + Math.random() * 0.5);
  const outflow = inflow - netFlow;
  
  if (elements.mainInflow) elements.mainInflow.textContent = '+' + formatAmount(inflow * 10000);
  if (elements.mainOutflow) elements.mainOutflow.textContent = '-' + formatAmount(outflow * 10000);
  if (elements.mainNetflow) {
    elements.mainNetflow.textContent = (netFlow >= 0 ? '+' : '-') + formatAmount(Math.abs(netFlow) * 10000);
    elements.mainNetflow.className = 'capital-value net ' + (netFlow >= 0 ? 'inflow' : 'outflow');
  }
  
  // 更新资金柱状图
  updateCapitalBars(netFlow);
}

function updateCapitalBars(netFlow) {
  const total = Math.abs(netFlow);
  const superLarge = (Math.random() - 0.3) * total;
  const large = (Math.random() - 0.2) * total;
  const medium = (Math.random() - 0.1) * total;
  const small = total - Math.abs(superLarge) - Math.abs(large) - Math.abs(medium);
  
  const bars = [
    { el: document.getElementById('bar-super'), val: document.getElementById('val-super'), value: superLarge },
    { el: document.getElementById('bar-big'), val: document.getElementById('val-big'), value: large },
    { el: document.getElementById('bar-medium'), val: document.getElementById('val-medium'), value: medium },
    { el: document.getElementById('bar-small'), val: document.getElementById('val-small'), value: small }
  ];
  
  bars.forEach(bar => {
    if (bar.el && bar.val) {
      const pct = Math.min(100, Math.abs(bar.value) / total * 100);
      bar.el.style.width = pct + '%';
      bar.val.textContent = (bar.value >= 0 ? '+' : '-') + formatAmount(Math.abs(bar.value) * 10000);
      bar.val.className = 'bar-value ' + (bar.value >= 0 ? 'inflow' : 'outflow');
    }
  });
}

async function loadTradeDetail() {
  try {
    const secid = stockState.market === 'sh' ? `1.${stockState.code}` : `0.${stockState.code}`;
    const url = `https://push2.eastmoney.com/api/qt/stock/details/get?secid=${secid}&pos=-1&cnt=50&fltt=2&invt=2&fields=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13,f14,f15,f16,f17,f18,f19,f20,f21,f22,f23`;
    
    const response = await fetch(url, { timeout: 5000 });
    const result = await response.json();
    
    console.log('📝 成交明细响应:', result);
    
    if (result.rc === 0 && result.data && result.data.details && result.data.details.length > 0) {
      renderTradeDetail(result.data.details);
    } else {
      if (elements.tradeDetailBody) {
        elements.tradeDetailBody.innerHTML = '<tr><td colspan="5" class="loading">暂无数据</td></tr>';
      }
    }
  } catch (error) {
    console.error('加载成交明细失败:', error);
    if (elements.tradeDetailBody) {
      elements.tradeDetailBody.innerHTML = '<tr><td colspan="5" class="loading">加载失败</td></tr>';
    }
  }
}

function renderTradeDetail(details) {
  if (!elements.tradeDetailBody) return;
  
  if (!details || details.length === 0) {
    elements.tradeDetailBody.innerHTML = '<tr><td colspan="5" class="loading">暂无数据</td></tr>';
    return;
  }
  
  const html = details.map(trade => {
    const price = trade.f20 ? (trade.f20 / 100).toFixed(2) : '--';
    const volume = trade.f17 ? formatVolume(trade.f17) : '--';
    const amount = trade.f16 ? formatAmount(trade.f16) : '--';
    const nature = trade.f21 || 0; // 0:中性 1:买 2:卖
    const time = trade.f19 || '--';
    
    const natureText = nature === 1 ? 'B 买' : (nature === 2 ? 'S 卖' : 'N 中性');
    const natureClass = nature === 1 ? 'buy' : (nature === 2 ? 'sell' : 'neutral');
    
    return `<tr>
      <td>${time}</td>
      <td class="price">${price}</td>
      <td class="volume">${volume}</td>
      <td class="volume">${amount}</td>
      <td class="nature ${natureClass}">${natureText}</td>
    </tr>`;
  }).join('');
  
  elements.tradeDetailBody.innerHTML = html;
}

// ==================== 工具函数 ====================

function formatVolume(vol) {
  if (!vol) return '--';
  if (vol >= 100000000) return (vol / 100000000).toFixed(2) + '亿';
  if (vol >= 10000) return (vol / 10000).toFixed(2) + '万';
  return vol.toString();
}

function formatAmount(amt) {
  if (!amt) return '--';
  if (amt >= 100000000) return (amt / 100000000).toFixed(2) + '亿';
  if (amt >= 10000) return (amt / 10000).toFixed(2) + '万';
  return amt.toFixed(2);
}

function startAutoRefresh() {
  if (stockState.refreshTimer) {
    clearInterval(stockState.refreshTimer);
  }
  
  stockState.refreshTimer = setInterval(() => {
    // 只在交易时间刷新
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const time = hour * 60 + minute;
    
    // 交易时间：9:30-11:30, 13:00-15:00
    const isTradingTime = (time >= 570 && time <= 690) || (time >= 780 && time <= 900);
    
    if (isTradingTime && now.getDay() >= 1 && now.getDay() <= 5) {
      loadStockData();
      loadTradeDetail();
    }
  }, stockState.refreshInterval);
}

function startClock() {
  function updateClock() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const timeStr = now.toLocaleTimeString('zh-CN', { hour12: false });
    
    const dateEl = document.getElementById('current-date');
    const timeEl = document.getElementById('current-time');
    
    if (dateEl) dateEl.textContent = dateStr;
    if (timeEl) timeEl.textContent = timeStr;
  }
  
  updateClock();
  setInterval(updateClock, 1000);
}

// ==================== 事件绑定 ====================

function bindEvents() {
  // 返回按钮
  if (elements.btnBack) {
    elements.btnBack.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // 尝试返回上一页，如果没有历史记录则跳转到自选股页面
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/custom';
      }
    });
  }
  
  // 加自选按钮
  if (elements.btnAddCustom) {
    elements.btnAddCustom.addEventListener('click', async () => {
      try {
        const response = await fetch('/api/custom-stocks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stock_code: stockState.code,
            stock_market: stockState.market
          })
        });
        
        const result = await response.json();
        if (result.success) {
          alert('✅ 已添加到自选股');
        } else {
          alert('❌ ' + result.message);
        }
      } catch (error) {
        console.error('添加自选股失败:', error);
        alert('❌ 网络错误');
      }
    });
  }
  
  // 图表标签切换
  elements.chartTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      elements.chartTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      // TODO: 切换图表类型
      alert('图表类型切换功能待实现');
    });
  });
  
  // 刷新频率切换
  elements.detailTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      elements.detailTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const interval = parseInt(tab.dataset.refresh) * 1000;
      stockState.refreshInterval = interval;
      startAutoRefresh();
    });
  });
}

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', init);
