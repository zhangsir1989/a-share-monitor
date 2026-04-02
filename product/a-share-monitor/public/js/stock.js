// 证券行情页面逻辑

// 页面状态
const pageState = {
  refreshInterval: 3,
  isPaused: false,
  timer: null,
  currentStockCode: null
};

// DOM 元素
const elements = {
  currentDate: document.getElementById('current-date'),
  currentTime: document.getElementById('current-time'),
  stockInput: document.getElementById('stock-input'),
  searchBtn: document.getElementById('search-btn'),
  clearBtn: document.getElementById('clear-btn'),
  searchSuggestions: document.getElementById('search-suggestions'),
  stockResult: document.getElementById('stock-result'),
  errorMessage: document.getElementById('error-message'),
  stockName: document.getElementById('stock-name'),
  stockCode: document.getElementById('stock-code'),
  currentPrice: document.getElementById('current-price'),
  priceChange: document.getElementById('price-change'),
  openPrice: document.getElementById('open-price'),
  highPrice: document.getElementById('high-price'),
  limitUp: document.getElementById('limit-up'),
  turnoverRate: document.getElementById('turnover-rate'),
  volume: document.getElementById('volume'),
  peRatio: document.getElementById('pe-ratio'),
  totalMarketCap: document.getElementById('total-market-cap'),
  prevClose: document.getElementById('prev-close'),
  lowPrice: document.getElementById('low-price'),
  limitDown: document.getElementById('limit-down'),
  volumeRatio: document.getElementById('volume-ratio'),
  amount: document.getElementById('amount'),
  pbRatio: document.getElementById('pb-ratio'),
  floatMarketCap: document.getElementById('float-market-cap'),
  dataTime: document.getElementById('data-time'),
  lastUpdate: document.getElementById('last-update'),
  marketStatus: document.getElementById('market-status'),
  popularItems: document.querySelectorAll('.popular-item')
};

// 搜索状态
let searchTimeout = null;
let selectedIndex = -1;
let currentSuggestions = [];

// 更新时间显示
function updateDateTime() {
  const now = new Date();
  const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long' };
  const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  
  elements.currentDate.textContent = now.toLocaleDateString('zh-CN', dateOptions);
  elements.currentTime.textContent = now.toLocaleTimeString('zh-CN', timeOptions);
}

// 判断市场状态
function getMarketStatus() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  
  if (day === 0 || day === 6) return '休市';
  if (hour === 9 && minute >= 30) return '交易中';
  if (hour === 10) return '交易中';
  if (hour === 11 && minute <= 30) return '交易中';
  if (hour === 13) return '交易中';
  if (hour === 14) return '交易中';
  if (hour === 15 && minute === 0) return '交易中';
  if (hour === 15 && minute > 0) return '已收盘';
  if (hour < 9 || (hour === 9 && minute < 30)) return '未开盘';
  if (hour >= 15) return '已收盘';
  
  return '休市';
}

function updateMarketStatus() {
  const status = getMarketStatus();
  if (elements.marketStatus) {
    elements.marketStatus.textContent = `市场状态：${status}`;
  }
  if (elements.lastUpdate) {
    elements.lastUpdate.textContent = `最后更新：${new Date().toLocaleString('zh-CN')}`;
  }
}

// 格式化数字
function formatNumber(num, decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) return '--';
  return Number(num).toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

// 格式化金额
function formatAmount(num) {
  if (num === null || num === undefined || isNaN(num)) return '--';
  if (Math.abs(num) >= 100000000) {
    return (num / 100000000).toFixed(2) + '万亿';
  } else if (Math.abs(num) >= 100000000) {
    return (num / 100000000).toFixed(2) + '亿';
  }
  return num.toFixed(2);
}

// 获取价格颜色类
function getPriceClass(value, prevClose) {
  if (!prevClose || value === '--') return '';
  if (value > prevClose) return 'up';
  if (value < prevClose) return 'down';
  return 'flat';
}

// 更新行情显示
async function updateStockData(data) {
  if (!data) {
    showError('未找到该股票信息');
    return;
  }
  
  // 基本信息
  elements.stockName.textContent = data.name || '--';
  elements.stockCode.textContent = data.code || '--';
  
  // 显示股票类型
  const stockType = getStockType(data.code);
  if (elements.stockType) {
    elements.stockType.textContent = stockType;
  }
  
  // 加载分时图
  loadIntradayChart(data.code);
  
  // 加载可转债信息（所有股票都尝试加载）
  console.log('🔗 尝试加载转债:', data.code, data.name);
  loadConvertibles(data.code);
  
  // 当前价格
  const price = parseFloat(data.price) || 0;
  const prevClose = parseFloat(data.prevClose) || 0;
  const change = price - prevClose;
  const changePercent = prevClose > 0 ? (change / prevClose * 100) : 0;
  
  elements.currentPrice.textContent = formatNumber(price);
  elements.currentPrice.className = `current-price ${getPriceClass(price, prevClose)}`;
  
  const changeSign = change >= 0 ? '+' : '';
  const percentSign = changePercent >= 0 ? '+' : '';
  elements.priceChange.textContent = `${changeSign}${formatNumber(change)} (${percentSign}${formatNumber(changePercent)}%)`;
  elements.priceChange.className = `price-change ${getPriceClass(price, prevClose)}`;
  
  // 行情数据
  elements.openPrice.textContent = formatNumber(data.open);
  elements.openPrice.className = `grid-value ${getPriceClass(data.open, prevClose)}`;
  
  elements.highPrice.textContent = formatNumber(data.high);
  elements.highPrice.className = `grid-value ${getPriceClass(data.high, prevClose)}`;
  
  elements.limitUp.textContent = formatNumber(data.limitUp);
  elements.limitUp.className = 'grid-value up';
  
  elements.turnoverRate.textContent = (data.turnoverRate || 0) + '%';
  
  elements.volume.textContent = formatNumber(data.volume / 10000) + '万';
  
  elements.peRatio.textContent = formatNumber(data.pe);
  
  elements.totalMarketCap.textContent = formatAmount(data.totalMarketCap);
  
  elements.prevClose.textContent = formatNumber(data.prevClose);
  
  elements.lowPrice.textContent = formatNumber(data.low);
  elements.lowPrice.className = `grid-value ${getPriceClass(data.low, prevClose)}`;
  
  elements.limitDown.textContent = formatNumber(data.limitDown);
  elements.limitDown.className = 'grid-value down';
  
  elements.volumeRatio.textContent = formatNumber(data.volumeRatio);
  
  elements.amount.textContent = formatAmount(data.amount) + '亿';
  
  elements.pbRatio.textContent = formatNumber(data.pb);
  
  elements.floatMarketCap.textContent = formatAmount(data.floatMarketCap);
  
  // 更新时间
  elements.dataTime.textContent = new Date().toLocaleString('zh-CN');
  
  // 显示结果
  elements.stockResult.style.display = 'block';
  elements.errorMessage.style.display = 'none';
}

// 显示错误
function showError(message) {
  elements.errorMessage.style.display = 'block';
  elements.stockResult.style.display = 'none';
  document.getElementById('error-text').textContent = message;
}

// 查询股票
async function searchStock(query) {
  if (!query || query.trim() === '') {
    showError('请输入股票代码或名称');
    return;
  }
  
  query = query.trim();
  pageState.currentStockCode = query; // 保存当前股票代码用于定时刷新
  
  try {
    const response = await fetch(`/api/stock/${encodeURIComponent(query)}`);
    const data = await response.json();
    
    if (data.success) {
      updateStockData(data.data);
    } else {
      showError(data.message || '未找到该股票信息');
    }
  } catch (error) {
    console.error('查询失败:', error);
    showError('查询失败，请稍后重试');
  }
}

// 搜索建议
async function fetchSuggestions(query) {
  if (!query || query.trim().length < 1) {
    hideSuggestions();
    return;
  }
  
  try {
    const response = await fetch(`/api/stock/search?q=${encodeURIComponent(query)}`);
    const result = await response.json();
    
    console.log('🔍 搜索:', query, '结果:', result);  // 调试日志
    
    if (result.success && result.data && result.data.length > 0) {
      showSuggestions(result.data);
    } else {
      console.log('❌ 未找到匹配结果');
      hideSuggestions();
    }
  } catch (error) {
    console.error('❌ 获取搜索建议失败:', error);
    hideSuggestions();
  }
}

function showSuggestions(stocks) {
  currentSuggestions = stocks;
  selectedIndex = -1;
  
  const html = stocks.map((stock, index) => `
    <div class="suggestion-item" data-index="${index}" data-code="${stock.code}">
      <span class="suggestion-code">${stock.code}</span>
      <span class="suggestion-name">${stock.name}</span>
      <span class="suggestion-market">${stock.market === 'sh' ? '沪市' : '深市'}</span>
    </div>
  `).join('');
  
  elements.searchSuggestions.innerHTML = html;
  elements.searchSuggestions.style.display = 'block';
  
  // 点击建议项
  elements.searchSuggestions.querySelectorAll('.suggestion-item').forEach(item => {
    item.addEventListener('click', () => {
      const code = item.dataset.code;
      elements.stockInput.value = `${code} ${item.querySelector('.suggestion-name').textContent}`;
      hideSuggestions();
      searchStock(code);
    });
  });
}

function hideSuggestions() {
  elements.searchSuggestions.style.display = 'none';
  currentSuggestions = [];
  selectedIndex = -1;
}

function selectSuggestion(direction) {
  if (currentSuggestions.length === 0) return;
  
  const items = elements.searchSuggestions.querySelectorAll('.suggestion-item');
  items.forEach(item => item.style.backgroundColor = '');
  
  selectedIndex += direction;
  if (selectedIndex < 0) selectedIndex = currentSuggestions.length - 1;
  if (selectedIndex >= currentSuggestions.length) selectedIndex = 0;
  
  const selectedItem = items[selectedIndex];
  if (selectedItem) {
    selectedItem.style.backgroundColor = 'var(--bg-secondary)';
    elements.stockInput.value = `${currentSuggestions[selectedIndex].code} ${currentSuggestions[selectedIndex].name}`;
  }
}

// 从输入中提取股票代码
function extractCode(input) {
  if (!input) return '';
  // 匹配 6 位数字代码（可能带 sh/sz 前缀）
  const match = input.match(/(sh|sz)?(\d{6})/);
  if (match) {
    return match[1] ? match[0] : match[2];
  }
  return input.trim();
}

// 事件监听
elements.searchBtn.addEventListener('click', () => {
  const code = extractCode(elements.stockInput.value);
  searchStock(code);
});

elements.clearBtn.addEventListener('click', () => {
  elements.stockInput.value = '';
  elements.stockInput.focus();
  elements.stockResult.style.display = 'none';
  elements.errorMessage.style.display = 'none';
  hideSuggestions();
});

elements.stockInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  const query = elements.stockInput.value.trim();
  
  if (query.length >= 1) {
    searchTimeout = setTimeout(() => {
      fetchSuggestions(query);
    }, 300);
  } else {
    hideSuggestions();
  }
});

elements.stockInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectSuggestion(1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectSuggestion(-1);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    hideSuggestions();
    if (selectedIndex >= 0 && currentSuggestions[selectedIndex]) {
      searchStock(currentSuggestions[selectedIndex].code);
    } else {
      const code = extractCode(elements.stockInput.value);
      searchStock(code);
    }
  } else if (e.key === 'Escape') {
    hideSuggestions();
  }
});

elements.stockInput.addEventListener('focus', () => {
  if (elements.stockInput.value.trim().length >= 1) {
    fetchSuggestions(elements.stockInput.value.trim());
  }
});

// 点击外部关闭建议
document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-box-wrapper')) {
    hideSuggestions();
  }
});

// 热门股票点击
elements.popularItems.forEach(item => {
  item.addEventListener('click', () => {
    const code = item.dataset.code;
    const name = item.querySelector('.popular-name').textContent;
    elements.stockInput.value = code;
    searchStock(code);
  });
});

// 初始化
function init() {
  updateDateTime();
  setInterval(updateDateTime, 1000);
  updateMarketStatus();
  
  // 启动定时刷新（每 3 秒）
  startAutoRefresh();
  
  // 从 URL 参数获取股票代码
  const urlParams = new URLSearchParams(window.location.search);
  const stockCode = urlParams.get('code');
  if (stockCode) {
    elements.stockInput.value = stockCode;
    searchStock(stockCode);
  }
}

document.addEventListener('DOMContentLoaded', init);

// 获取股票类型
function getStockType(code) {
  if (!code) return '';
  // 处理带市场前缀的代码
  const cleanCode = code.replace(/^(sh|sz)/i, '');
  
  if (cleanCode === '000001') return '上证指数'; // 特殊处理
  if (cleanCode.startsWith('1')) return 'ETF';
  if (cleanCode.startsWith('11') || cleanCode.startsWith('12')) return '可转债';
  if (cleanCode.startsWith('000') || cleanCode.startsWith('399')) return '指数';
  if (cleanCode.startsWith('688')) return '科创板';
  if (cleanCode.startsWith('300')) return '创业板';
  return 'A 股';
}

// 判断市场状态（精确到分钟）
function getMarketStatusDetail() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeInMinutes = hour * 60 + minute;
  
  if (day === 0 || day === 6) return 'closed'; // 周末休市
  if (timeInMinutes < 9 * 60 + 15) return 'pre_auction'; // 9:15 前 - 未开盘
  if (timeInMinutes < 9 * 60 + 25) return 'auction'; // 9:15-9:25 集合竞价
  if (timeInMinutes < 9 * 60 + 30) return 'pre_open'; // 9:25-9:30 待开盘
  if (timeInMinutes < 11 * 60 + 30) return 'trading_am'; // 上午交易
  if (timeInMinutes < 13 * 60) return 'lunch_break'; // 午休
  if (timeInMinutes < 15 * 60) return 'trading_pm'; // 下午交易
  return 'closed'; // 已收盘
}

// 判断是否应该显示分时图数据
function shouldShowIntradayChart() {
  const status = getMarketStatusDetail();
  // 只在交易时间或已收盘后显示，集合竞价前不显示
  return status === "trading_am" || status === "trading_pm" || status === "closed" || status === "lunch_break";
}

// 判断是否在交易时间
function isTradingTime() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeInMinutes = hour * 60 + minute;
  
  // 周末不交易
  if (day === 0 || day === 6) return false;
  
  // 交易时间段：9:30-11:30, 13:00-15:00
  const isMorning = timeInMinutes >= 9 * 60 + 30 && timeInMinutes < 11 * 60 + 30;
  const isAfternoon = timeInMinutes >= 13 * 60 && timeInMinutes < 15 * 60;
  
  return isMorning || isAfternoon;
}

// 判断是否在交易时间段（北京时间）
function isTradingTime() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeInMinutes = hour * 60 + minute;
  
  // 周末不交易
  if (day === 0 || day === 6) return false;
  
  // 交易时间段：9:30-11:30, 13:00-15:00
  const isMorning = timeInMinutes >= 9 * 60 + 30 && timeInMinutes < 11 * 60 + 30;
  const isAfternoon = timeInMinutes >= 13 * 60 && timeInMinutes < 15 * 60;
  
  return isMorning || isAfternoon;
}

// 启动定时刷新（只在交易时间执行）
function startAutoRefresh() {
  stopAutoRefresh();
  pageState.timer = setInterval(() => {
    // 非交易时间不刷新
    if (!isTradingTime()) {
      return;
    }
    if (!pageState.isPaused && pageState.currentStockCode) {
      searchStock(pageState.currentStockCode);
    }
  }, pageState.refreshInterval * 1000);
}

function stopAutoRefresh() {
  if (pageState.timer) {
    clearInterval(pageState.timer);
    pageState.timer = null;
  }
}

// 分时图组件实例
let intradayChart = null;

// 加载分时图
async function loadIntradayChart(code) {
  console.log('📈 加载分时图:', code);
  
  // 9:15 前不显示分时图
  if (!shouldShowIntradayChart()) {
    clearIntradayChart();
    return;
  }
  
  try {
    const response = await fetch(`/api/intraday/${code}`);
    const result = await response.json();
    console.log('分时图结果:', result);
    
    if (result.success && result.data) {
      // 判断是否为指数（代码以 000 或 399 开头）
      const isIndex = code.startsWith('000') || code.startsWith('399');
      
      // 初始化或更新图表组件
      if (!intradayChart) {
        intradayChart = new IntradayChart('intraday-canvas', 'chart-container');
      }
      
      // 传递股票代码和 meta 数据，让组件判断股票类型和涨跌幅限制
      intradayChart.setData(result.data, isIndex, code, result.meta);
      intradayChart.draw();
      console.log('✅ 分时图绘制完成');
    }
  } catch (error) {
    console.error('❌ 加载分时图失败:', error);
  }
}

// 清空分时图
function clearIntradayChart() {
  const canvas = document.getElementById('intraday-canvas');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const container = document.getElementById('chart-container');
  
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 显示提示信息
  ctx.fillStyle = '#90a4ae';
  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('未开盘，暂无分时数据', canvas.width / 2, canvas.height / 2);
}

// 绘制分时图（参考图风格）
function drawIntradayChart(data) {
  if (!data || data.length === 0) {
    console.warn('分时图数据为空');
    return;
  }
  
  const canvas = document.getElementById('intraday-canvas');
  if (!canvas) {
    console.warn('找不到 canvas 元素');
    return;
  }
  
  const ctx = canvas.getContext('2d');
  const container = document.getElementById('chart-container');
  
  if (!container) {
    console.warn('找不到 chart-container 元素');
    return;
  }
  
  // 设置 canvas 尺寸（考虑 DPI）
  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  ctx.scale(dpr, dpr);
  
  const width = rect.width;
  const height = rect.height;
  const padding = { top: 20, right: 70, bottom: 35, left: 65 };
  
  // 图表区域
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  // 图表高度分为两部分：价格图 65%，成交量图 35%
  const priceChartHeight = chartHeight * 0.65;
  const volumeChartHeight = chartHeight * 0.35;
  const volumeTop = padding.top + priceChartHeight + 10; // 10px 间隔
  
  // 清空画布
  ctx.clearRect(0, 0, width, height);
  
  // 获取昨收价和价格范围
  const prevClose = data[0].price;
  const prices = data.map(d => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  
  // 使用实际高低点，稍微扩展范围（更真实的显示）
  const pricePadding = (maxPrice - minPrice) * 0.1 || prevClose * 0.02;
  const displayMin = Math.min(minPrice - pricePadding, prevClose * 0.98);
  const displayMax = Math.max(maxPrice + pricePadding, prevClose * 1.02);
  const priceRange = displayMax - displayMin;
  
  // 百分比级别（基于昨收）
  const percentLevels = [10.44, 6.96, 3.47, 0, -3.47, -6.96, -10.44];
  
  // ==================== 绘制价格图 ====================
  
  // 绘制 0 轴虚线（黄色，昨收价位置）
  const zeroY = padding.top + priceChartHeight * (displayMax - prevClose) / priceRange;
  ctx.strokeStyle = '#f0a30a';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(padding.left, zeroY);
  ctx.lineTo(width - padding.right, zeroY);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // 绘制价格线（蓝色，使用曲线更平滑）
  ctx.strokeStyle = '#2979ff';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  
  // 计算所有点的坐标
  const points = data.map((point, index) => ({
    x: padding.left + chartWidth * index / (data.length - 1),
    y: padding.top + priceChartHeight * (displayMax - point.price) / priceRange
  }));
  
  // 绘制平滑曲线
  if (points.length > 2) {
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  } else {
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
  }
  ctx.stroke();
  
  // 绘制价格线下方填充（到 0 轴）
  const gradient = ctx.createLinearGradient(0, padding.top, 0, zeroY);
  const isUp = data[data.length - 1].price >= prevClose;
  const fillColor = isUp ? 'rgba(255, 82, 82, 0.15)' : 'rgba(76, 175, 80, 0.15)';
  gradient.addColorStop(0, fillColor);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(padding.left, zeroY);
  points.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(width - padding.right, zeroY);
  ctx.closePath();
  ctx.fill();
  
  // ==================== 绘制均价线 ====================
  // 计算累计均价（VWAP - 成交量加权平均价格）
  let totalAmount = 0;
  let totalVolume = 0;
  const avgPrices = data.map((point, index) => {
    const amount = point.volume * point.price;
    totalAmount += amount;
    totalVolume += point.volume;
    return totalVolume > 0 ? totalAmount / totalVolume : point.price;
  });
  
  // 绘制均价线（黄色/橙色虚线）
  const avgPoints = avgPrices.map((avgPrice, index) => ({
    x: padding.left + chartWidth * index / (data.length - 1),
    y: padding.top + priceChartHeight * (displayMax - avgPrice) / priceRange
  }));
  
  ctx.strokeStyle = '#ff9800';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 3]);
  ctx.beginPath();
  avgPoints.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();
  ctx.setLineDash([]);
  
  // 绘制左侧价格标签和右侧百分比（基于昨收价的百分比）
  percentLevels.forEach((percent) => {
    const price = prevClose * (1 + percent / 100);
    // 只绘制在显示范围内的价格标签
    if (price >= displayMin && price <= displayMax) {
      const y = padding.top + priceChartHeight * (displayMax - price) / priceRange;
      
      // 左侧价格（颜色根据涨跌）
      const priceColor = price > prevClose ? '#ff5252' : (price < prevClose ? '#4caf50' : '#90a4ae');
      ctx.fillStyle = priceColor;
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(price.toFixed(2), padding.left - 8, y + 4);
      
      // 右侧百分比（颜色根据涨跌）
      const percentColor = percent > 0 ? '#ff5252' : (percent < 0 ? '#4caf50' : '#90a4ae');
      ctx.fillStyle = percentColor;
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`${percent > 0 ? '+' : ''}${percent.toFixed(2)}%`, width - padding.right + 10, y + 4);
    }
  });
  
  // 绘制时间标签（在成交量图下方）
  const timeLabels = [
    { label: '9:30', pos: 0 },
    { label: '10:30', pos: 60 },
    { label: '11:30/13:00', pos: 120 },
    { label: '14:00', pos: 180 },
    { label: '15:00', pos: 240 }
  ];
  ctx.fillStyle = '#90a4ae';
  ctx.font = '11px Arial';
  ctx.textAlign = 'center';
  timeLabels.forEach((item) => {
    const x = padding.left + chartWidth * item.pos / 240;
    ctx.fillText(item.label, x, volumeTop + volumeChartHeight + 16);
  });
  
  // ==================== 绘制成交量图 ====================
  
  const volumes = data.map(d => d.volume);
  const maxVolume = Math.max(...volumes);
  
  // 计算成交额
  const amounts = data.map(d => d.amount || (d.volume * d.price / 100));
  const maxAmount = Math.max(...amounts);
  
  // 成交量标签（左侧和右侧都显示成交额）
  const volumeLevels = 2;
  for (let i = 0; i <= volumeLevels; i++) {
    const y = volumeTop + volumeChartHeight * (volumeLevels - i) / volumeLevels;
    const amountValue = maxAmount * i / volumeLevels;
    
    // 左侧显示成交额
    const amountLabel = i === 0 ? '0' : `${(amountValue / 10000).toFixed(1)}亿`;
    ctx.fillStyle = '#90a4ae';
    ctx.font = '11px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(amountLabel, padding.left - 8, y + 4);
    
    // 右侧也显示成交额
    ctx.textAlign = 'left';
    ctx.fillText(amountLabel, width - padding.right + 10, y + 4);
    
    // 绘制成交量网格虚线
    if (i > 0) {
      ctx.strokeStyle = '#404040';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  
  // 成交量柱状图
  const barWidth = Math.max(2, chartWidth / data.length * 0.8);
  
  data.forEach((point, index) => {
    const x = padding.left + chartWidth * index / (data.length - 1);
    const barHeight = maxVolume > 0 ? (point.volume / maxVolume) * volumeChartHeight * 0.9 : 0;
    
    // 根据价格趋势设置颜色
    let isUpBar;
    if (index === 0) {
      isUpBar = point.price >= prevClose;
    } else {
      isUpBar = point.price >= data[index - 1].price;
    }
    ctx.fillStyle = isUpBar ? '#ff5252' : '#4caf50';
    ctx.globalAlpha = 0.7;
    ctx.fillRect(x - barWidth/2, volumeTop + volumeChartHeight - barHeight, barWidth, barHeight);
    ctx.globalAlpha = 1.0;
  });
  
  // 绘制当前价格线（虚线）
  const lastPrice = data[data.length - 1].price;
  const lastY = padding.top + priceChartHeight * (displayMax - lastPrice) / priceRange;
  ctx.strokeStyle = '#2979ff';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(padding.left, lastY);
  ctx.lineTo(width - padding.right, lastY);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // 当前价格标签
  ctx.fillStyle = isUp ? '#ff5252' : '#4caf50';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(lastPrice.toFixed(2), width - padding.right + 10, lastY + 4);
}

// 加载可转债信息
async function loadConvertibles(stockCode) {
  console.log('🔗 加载转债信息，股票代码:', stockCode);
  try {
    const response = await fetch(`/api/convertibles/${stockCode}`);
    const result = await response.json();
    console.log('转债 API 返回:', result);
    
    const section = document.getElementById('convertible-section');
    const list = document.getElementById('convertible-list');
    
    if (!section || !list) {
      console.error('❌ 找不到转债区域 DOM 元素');
      return;
    }
    
    if (result.success && result.data && result.data.length > 0) {
      console.log('✅ 找到', result.data.length, '只转债:', result.data.map(cb => cb.name));
      section.style.display = 'block';
      list.innerHTML = result.data.map(cb => `
        <div class="convertible-item" onclick="searchStock('${cb.code}')">
          <div class="convertible-header">
            <span class="convertible-code">${cb.code}</span>
          </div>
          <div class="convertible-name">${cb.name}</div>
          <div class="convertible-price">
            <span class="price ${cb.change >= 0 ? 'up' : 'down'}">${cb.price.toFixed(2)}</span>
            <span class="change ${cb.change >= 0 ? 'up' : 'down'}">${cb.change >= 0 ? '+' : ''}${cb.change.toFixed(2)} (${cb.changePercent.toFixed(2)}%)</span>
          </div>
        </div>
      `).join('');
    } else {
      console.log('ℹ️ 该股票无转债');
      section.style.display = 'none';
    }
  } catch (error) {
    console.error('❌ 加载转债信息失败:', error);
  }
}
