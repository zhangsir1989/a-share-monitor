/**
 * 自选股页面逻辑
 * 功能：添加/删除自选股，实时行情展示，自动刷新
 */

// 页面状态
const pageState = {
  refreshInterval: 3,
  isPaused: false,
  timer: null,
  stocks: [],  // 自选股列表 [{code, name, addedAt}]
  stockData: {},  // 股票行情数据
  sortBy: 'default'  // 排序方式：default, changePercent-desc, changePercent-asc, price-desc, price-asc, turnoverRate-desc
};

// DOM 元素
let elements = {};

// ==================== 初始化 ====================

function init() {
  // 初始化 DOM 元素引用
  elements = {
    currentDate: document.getElementById('current-date'),
    currentTime: document.getElementById('current-time'),
    stockInput: document.getElementById('stock-input'),
    addBtn: document.getElementById('add-btn'),
    clearAllBtn: document.getElementById('clear-all-btn'),
    searchSuggestions: document.getElementById('search-suggestions'),
    stockList: document.getElementById('stock-list'),
    stockCount: document.getElementById('stock-count'),
    emptyState: document.getElementById('empty-state'),
    lastUpdate: document.getElementById('last-update'),
    marketStatus: document.getElementById('market-status'),
    refreshSelect: document.getElementById('refresh-select'),
    refreshInterval: document.getElementById('refresh-interval'),
    pauseBtn: document.getElementById('pause-btn'),
    refreshBtn: document.getElementById('refresh-btn'),
    sortButtons: document.getElementById('sort-buttons')
  };
  
  // 从 localStorage 加载自选股
  loadStocks();
  
  // 初始化时间显示
  updateDateTime();
  setInterval(updateDateTime, 1000);
  
  // 初始化市场状态
  updateMarketStatus();
  
  // 绑定事件
  bindEvents();
  
  // 加载保存的刷新间隔
  const savedInterval = localStorage.getItem('customRefreshInterval');
  if (savedInterval) {
    pageState.refreshInterval = parseInt(savedInterval);
    elements.refreshSelect.value = pageState.refreshInterval;
    elements.refreshInterval.textContent = pageState.refreshInterval;
  }
  
  // 加载保存的排序设置
  const savedSort = localStorage.getItem('customSortBy');
  if (savedSort) {
    pageState.sortBy = savedSort;
    // 更新排序按钮状态
    const activeBtn = document.querySelector(`.sort-option[data-sort="${savedSort}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }
  } else {
    // 默认激活"默认"按钮
    document.querySelector('.sort-option[data-sort="default"]').classList.add('active');
  }
  
  // 初始数据加载
  if (pageState.stocks.length > 0) {
    fetchAllStockData();
  }
  
  // 启动自动刷新
  startAutoRefresh();
}

// ==================== 时间和市场状态 ====================

function updateDateTime() {
  const now = new Date();
  // 转换为北京时间 (UTC+8)
  const beijingTime = new Date(now.getTime() + (8 - now.getTimezoneOffset() / -60) * 60000);
  
  const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long' };
  const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  
  elements.currentDate.textContent = beijingTime.toLocaleDateString('zh-CN', dateOptions);
  elements.currentTime.textContent = beijingTime.toLocaleTimeString('zh-CN', timeOptions);
}

function updateMarketStatus() {
  const status = getMarketStatus();
  elements.marketStatus.textContent = `市场状态：${status}`;
}

function getMarketStatus() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeInMinutes = hour * 60 + minute;
  
  if (day === 0 || day === 6) return '休市';
  if (timeInMinutes < 9 * 60 + 15) return '未开盘';
  if (timeInMinutes < 9 * 60 + 25) return '集合竞价';
  if (timeInMinutes < 9 * 60 + 30) return '待开盘';
  if (timeInMinutes < 11 * 60 + 30) return '交易中';
  if (timeInMinutes < 13 * 60) return '午休';
  if (timeInMinutes < 15 * 60) return '交易中';
  return '已收盘';
}

// ==================== 判断交易时间 ====================

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

// ==================== 自动刷新 ====================

function startAutoRefresh() {
  stopAutoRefresh();
  pageState.timer = setInterval(() => {
    // 无论是否在交易时间，都按设置的时间间隔刷新
    // 非交易时间服务器会返回缓存数据
    if (!pageState.isPaused && pageState.stocks.length > 0) {
      fetchAllStockData();
    }
  }, pageState.refreshInterval * 1000);
}

function stopAutoRefresh() {
  if (pageState.timer) {
    clearInterval(pageState.timer);
    pageState.timer = null;
  }
}

// ==================== 自选股管理 ====================

function loadStocks() {
  try {
    const saved = localStorage.getItem('customStocks');
    if (saved) {
      pageState.stocks = JSON.parse(saved);
    }
  } catch (e) {
    console.error('加载自选股失败:', e);
    pageState.stocks = [];
  }
  updateStockList();
}

function saveStocks() {
  try {
    localStorage.setItem('customStocks', JSON.stringify(pageState.stocks));
  } catch (e) {
    console.error('保存自选股失败:', e);
  }
}

function addStock(code, name) {
  // 检查是否已存在
  if (pageState.stocks.some(s => s.code === code)) {
    showToast('该股票已在自选列表中', 'warning');
    return false;
  }
  
  pageState.stocks.push({
    code: code,
    name: name,
    addedAt: Date.now()
  });
  
  saveStocks();
  updateStockList();
  fetchAllStockData();
  showToast(`已添加 ${name}`, 'success');
  return true;
}

function removeStock(code) {
  const index = pageState.stocks.findIndex(s => s.code === code);
  if (index > -1) {
    const stock = pageState.stocks[index];
    pageState.stocks.splice(index, 1);
    saveStocks();
    updateStockList();
    showToast(`已移除 ${stock.name}`, 'info');
  }
}

function clearAllStocks() {
  if (confirm('确定要清空所有自选股吗？')) {
    pageState.stocks = [];
    pageState.stockData = {};
    saveStocks();
    updateStockList();
    showToast('已清空自选股', 'info');
  }
}

function updateStockList() {
  elements.stockCount.textContent = pageState.stocks.length;
  elements.emptyState.style.display = pageState.stocks.length === 0 ? 'block' : 'none';
  elements.clearAllBtn.style.display = pageState.stocks.length > 0 ? 'block' : 'none';
  elements.sortButtons.style.display = pageState.stocks.length > 0 ? 'flex' : 'none';
  
  renderStockCards();
}

// ==================== 数据获取 ====================

async function fetchAllStockData() {
  if (pageState.stocks.length === 0) return;
  
  const codes = pageState.stocks.map(s => s.code).join(',');
  
  try {
    const response = await fetch(`/api/stocks/batch?codes=${encodeURIComponent(codes)}`);
    const result = await response.json();
    
    if (result.success && result.data) {
      // 检测价格变化并记录
      const prevData = { ...pageState.stockData };
      pageState.stockData = result.data;
      
      // 更新最后更新时间
      elements.lastUpdate.textContent = `最后更新：${new Date().toLocaleString('zh-CN')}`;
      
      // 渲染卡片（带闪烁动画）
      renderStockCards(prevData);
    }
  } catch (error) {
    console.error('获取股票数据失败:', error);
  }
}

// ==================== 渲染 ====================

// 获取排序后的股票列表
function getSortedStocks() {
  if (pageState.sortBy === 'default') {
    return pageState.stocks;
  }
  
  const [field, order] = pageState.sortBy.split('-');
  
  return [...pageState.stocks].sort((a, b) => {
    const dataA = pageState.stockData[a.code] || {};
    const dataB = pageState.stockData[b.code] || {};
    
    let valueA, valueB;
    
    switch (field) {
      case 'changePercent':
        valueA = parseFloat(dataA.changePercent) || 0;
        valueB = parseFloat(dataB.changePercent) || 0;
        break;
      case 'price':
        valueA = parseFloat(dataA.price) || 0;
        valueB = parseFloat(dataB.price) || 0;
        break;
      case 'turnoverRate':
        // 成交额作为近似
        valueA = parseFloat(dataA.amount) || 0;
        valueB = parseFloat(dataB.amount) || 0;
        break;
      default:
        return 0;
    }
    
    return order === 'asc' ? valueA - valueB : valueB - valueA;
  });
}

function renderStockCards(prevData = {}) {
  if (pageState.stocks.length === 0) {
    elements.stockList.innerHTML = '';
    return;
  }
  
  // 获取排序后的股票列表
  const sortedStocks = getSortedStocks();
  
  elements.stockList.innerHTML = sortedStocks.map((stock, displayIndex) => {
    // 找到原始索引用于移动操作
    const originalIndex = pageState.stocks.findIndex(s => s.code === stock.code);
    const data = pageState.stockData[stock.code];
    if (!data) {
      return `
        <div class="stock-card" data-code="${stock.code}" data-index="${originalIndex}">
          <button class="sort-btn" title="拖拽排序" onclick="event.stopPropagation();">
            <span class="arrow" onclick="event.stopPropagation(); moveStock(${originalIndex}, -1)">▲</span>
            <span class="arrow" onclick="event.stopPropagation(); moveStock(${originalIndex}, 1)">▼</span>
          </button>
          <button class="delete-btn" onclick="event.stopPropagation(); removeStock('${stock.code}')">×</button>
          <div class="stock-info">
            <div class="stock-name">${stock.name}</div>
            <div class="stock-code-type">
              <span>${stock.code}</span>
            </div>
          </div>
          <div class="stock-price">
            <div class="current-price">--</div>
            <div class="price-change">加载中...</div>
          </div>
          <div class="stock-details">
            <div class="detail-item"><span class="detail-label">今开</span><span class="detail-value">--</span></div>
            <div class="detail-item"><span class="detail-label">最高</span><span class="detail-value">--</span></div>
            <div class="detail-item"><span class="detail-label">最低</span><span class="detail-value">--</span></div>
            <div class="detail-item"><span class="detail-label">成交量</span><span class="detail-value">--</span></div>
          </div>
        </div>
      `;
    }
    
    const prevClose = data.prevClose || 0;
    const price = data.price || 0;
    const change = price - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose * 100).toFixed(2) : 0;
    const isUp = change > 0;
    const isDown = change < 0;
    const priceClass = isUp ? 'up' : (isDown ? 'down' : 'flat');
    
    // 检测价格变化（用于闪烁动画）
    const prevPrice = prevData[stock.code]?.price;
    let flashClass = '';
    if (prevPrice && prevPrice !== price) {
      flashClass = price > prevPrice ? 'flash-up' : 'flash-down';
    }
    
    return `
      <div class="stock-card ${priceClass} ${flashClass}" data-code="${stock.code}" data-index="${originalIndex}" onclick="goToStockDetail('${stock.code}')" draggable="true">
        <button class="sort-btn" title="拖拽排序或点击箭头移动" onclick="event.stopPropagation();">
          <span class="arrow" onclick="event.stopPropagation(); moveStock(${originalIndex}, -1)">▲</span>
          <span class="arrow" onclick="event.stopPropagation(); moveStock(${originalIndex}, 1)">▼</span>
        </button>
        <button class="delete-btn" onclick="event.stopPropagation(); removeStock('${stock.code}')">×</button>
        <div class="stock-info">
          <div class="stock-name">${data.name || stock.name}</div>
          <div class="stock-code-type">
            <span>${stock.code}</span>
            <span class="stock-type-tag">${getStockType(stock.code)}</span>
          </div>
        </div>
        <div class="stock-price">
          <div class="current-price ${priceClass}">${price.toFixed(2)}</div>
          <div class="price-change ${priceClass}">
            ${isUp ? '+' : ''}${change.toFixed(2)} (${isUp ? '+' : ''}${changePercent}%)
          </div>
        </div>
        <div class="stock-details">
          <div class="detail-item">
            <span class="detail-label">今开</span>
            <span class="detail-value ${getPriceClass(data.open, prevClose)}">${(data.open || 0).toFixed(2)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">最高</span>
            <span class="detail-value up">${(data.high || 0).toFixed(2)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">最低</span>
            <span class="detail-value down">${(data.low || 0).toFixed(2)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">成交额</span>
            <span class="detail-value">${formatAmount(data.amount)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // 初始化拖拽排序
  initDragSort();
}

// ==================== 排序功能 ====================

// 移动股票位置
function moveStock(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= pageState.stocks.length) return;
  
  // 交换位置
  const temp = pageState.stocks[index];
  pageState.stocks[index] = pageState.stocks[newIndex];
  pageState.stocks[newIndex] = temp;
  
  // 保存并重新渲染
  saveStocks();
  renderStockCards(pageState.stockData);
  showToast('已调整顺序', 'info');
}

// 初始化拖拽排序
function initDragSort() {
  const cards = document.querySelectorAll('.stock-card[draggable="true"]');
  let draggedItem = null;
  
  cards.forEach(card => {
    card.addEventListener('dragstart', function(e) {
      draggedItem = this;
      this.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    
    card.addEventListener('dragend', function() {
      this.classList.remove('dragging');
      document.querySelectorAll('.stock-card').forEach(c => c.classList.remove('drag-over'));
    });
    
    card.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (this !== draggedItem) {
        this.classList.add('drag-over');
      }
    });
    
    card.addEventListener('dragleave', function() {
      this.classList.remove('drag-over');
    });
    
    card.addEventListener('drop', function(e) {
      e.preventDefault();
      this.classList.remove('drag-over');
      
      if (draggedItem && this !== draggedItem) {
        const fromIndex = parseInt(draggedItem.dataset.index);
        const toIndex = parseInt(this.dataset.index);
        
        // 重新排序
        const item = pageState.stocks.splice(fromIndex, 1)[0];
        pageState.stocks.splice(toIndex, 0, item);
        
        // 保存并重新渲染
        saveStocks();
        renderStockCards(pageState.stockData);
        showToast('已调整顺序', 'info');
      }
    });
  });
}

// ==================== 搜索建议 ====================

let searchTimeout = null;
let selectedIndex = -1;
let currentSuggestions = [];

async function fetchSuggestions(query) {
  if (!query || query.trim().length < 1) {
    hideSuggestions();
    return;
  }
  
  try {
    const response = await fetch(`/api/stock/search?q=${encodeURIComponent(query)}`);
    const result = await response.json();
    
    if (result.success && result.data && result.data.length > 0) {
      showSuggestions(result.data);
    } else {
      hideSuggestions();
    }
  } catch (error) {
    console.error('获取搜索建议失败:', error);
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
      const name = item.querySelector('.suggestion-name').textContent;
      elements.stockInput.value = `${code} ${name}`;
      hideSuggestions();
      addStock(code, name);
      elements.stockInput.value = '';
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
    const code = currentSuggestions[selectedIndex].code;
    const name = currentSuggestions[selectedIndex].name;
    elements.stockInput.value = `${code} ${name}`;
  }
}

// ==================== 辅助函数 ====================

// 从输入中提取股票代码（与证券行情页保持一致）
function extractCode(input) {
  if (!input) return '';
  // 匹配 6 位数字代码（可能带 sh/sz/bj 前缀）
  const match = input.match(/(sh|sz|bj)?(\d{6})/i);
  if (match) {
    return match[1] ? match[0] : match[2];
  }
  return input.trim();
}

// ==================== 排序功能 ====================

function getStockType(code) {
  if (!code) return '';
  const cleanCode = code.replace(/^(sh|sz|bj)/i, '');
  const prefix = code.match(/^(sh|sz|bj)/i)?.[1]?.toLowerCase() || '';
  
  // 上证指数（特定代码，必须有 sh 前缀或默认为上海）
  if (cleanCode === '000001' || cleanCode === '000016' || cleanCode === '000300' || 
      cleanCode === '000688' || cleanCode === '000852') {
    // 如果明确有 sz 前缀，则是深圳股票（如 sz000001 平安银行）
    if (prefix === 'sz') return 'A 股';
    // 否则是上证指数
    return '上证指数';
  }
  // 深证指数（以 399 开头）
  if (cleanCode.startsWith('399')) return '深证指数';
  // ETF
  if (cleanCode.startsWith('51') || cleanCode.startsWith('15') || cleanCode.startsWith('16')) return 'ETF';
  // 可转债
  if (cleanCode.startsWith('11') || cleanCode.startsWith('12') || cleanCode.startsWith('13')) return '可转债';
  // 科创板
  if (cleanCode.startsWith('688')) return '科创板';
  // 创业板
  if (cleanCode.startsWith('300') || cleanCode.startsWith('301')) return '创业板';
  // 北交所
  if (cleanCode.startsWith('8') || cleanCode.startsWith('4')) return '北交所';
  // 其他都是A股
  return 'A 股';
}

function getPriceClass(value, prevClose) {
  if (!prevClose || value === '--') return '';
  if (value > prevClose) return 'up';
  if (value < prevClose) return 'down';
  return '';
}

function formatAmount(amount) {
  if (!amount) return '--';
  if (amount >= 100000000) {
    return (amount / 100000000).toFixed(2) + '亿';
  }
  if (amount >= 10000) {
    return (amount / 10000).toFixed(2) + '万';
  }
  return amount.toFixed(2);
}

function goToStockDetail(code) {
  window.location.href = `/stock?code=${code}`;
}

function showToast(message, type = 'info') {
  // 简单的提示实现
  const colors = {
    success: '#4caf50',
    warning: '#ff9800',
    error: '#e53935',
    info: '#2196f3'
  };
  
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${colors[type] || colors.info};
    color: #fff;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 9999;
    animation: fadeInUp 0.3s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'fadeOutDown 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translate(-50%, 20px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }
  @keyframes fadeOutDown {
    from { opacity: 1; transform: translate(-50%, 0); }
    to { opacity: 0; transform: translate(-50%, 20px); }
  }
`;
document.head.appendChild(style);

// ==================== 事件绑定 ====================

function bindEvents() {
  // 添加股票
  elements.addBtn.addEventListener('click', () => {
    const input = elements.stockInput.value.trim();
    if (!input) return;
    
    // 使用与证券行情页一致的代码提取逻辑
    const code = extractCode(input);
    if (code) {
      // 如果是从搜索建议选择的，可能包含名称
      const nameMatch = input.match(/\d{6}\s+(.+)$/);
      const name = nameMatch ? nameMatch[1].trim() : code;
      addStock(code.replace(/^(sh|sz|bj)/i, ''), name);
      elements.stockInput.value = '';
    } else {
      showToast('请输入有效的股票代码', 'warning');
    }
  });
  
  // 输入框键盘事件（与证券行情页保持一致）
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
        const stock = currentSuggestions[selectedIndex];
        addStock(stock.code, stock.name);
        elements.stockInput.value = '';
      } else {
        elements.addBtn.click();
      }
    } else if (e.key === 'Escape') {
      hideSuggestions();
    }
  });
  
  // 输入框搜索建议
  elements.stockInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const query = elements.stockInput.value.trim();
    if (query.length >= 1) {
      searchTimeout = setTimeout(() => fetchSuggestions(query), 300);
    } else {
      hideSuggestions();
    }
  });
  
  // 点击外部关闭建议
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.add-stock-section')) {
      hideSuggestions();
    }
  });
  
  // 清空全部
  elements.clearAllBtn.addEventListener('click', clearAllStocks);
  
  // 刷新间隔
  elements.refreshSelect.addEventListener('change', (e) => {
    pageState.refreshInterval = parseInt(e.target.value);
    elements.refreshInterval.textContent = pageState.refreshInterval;
    localStorage.setItem('customRefreshInterval', pageState.refreshInterval);
    startAutoRefresh();
  });
  
  // 暂停/继续
  elements.pauseBtn.addEventListener('click', () => {
    pageState.isPaused = !pageState.isPaused;
    elements.pauseBtn.textContent = pageState.isPaused ? '▶️ 继续' : '⏸️ 暂停';
  });
  
  // 手动刷新
  elements.refreshBtn.addEventListener('click', () => {
    fetchAllStockData();
  });
  
  // 排序按钮
  document.querySelectorAll('.sort-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const sort = btn.dataset.sort;
      
      // 如果点击已激活的按钮，切换升降序
      if (pageState.sortBy === sort) {
        // 已经是当前排序，不做变化
        return;
      }
      
      pageState.sortBy = sort;
      
      // 更新按钮状态
      document.querySelectorAll('.sort-option').forEach(b => {
        b.classList.remove('active', 'asc', 'desc');
      });
      btn.classList.add('active');
      
      // 保存排序设置
      localStorage.setItem('customSortBy', pageState.sortBy);
      
      // 重新渲染
      renderStockCards(pageState.stockData);
    });
  });
}

// ==================== 启动 ====================

document.addEventListener('DOMContentLoaded', init);

// 导出全局函数
window.removeStock = removeStock;
window.goToStockDetail = goToStockDetail;