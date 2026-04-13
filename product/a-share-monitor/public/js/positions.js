/**
 * 持仓页面逻辑
 * 功能：添加/删除持仓，实时行情展示，自动刷新
 */

// 页面状态
const pageState = {
  refreshInterval: 3,
  isPaused: false,
  timer: null,
  stocks: [],  // 持仓列表 [{code, name, addedAt}]
  stockData: {},  // 股票行情数据
  sortBy: 'default'  // 排序方式：default, changePercent-desc, changePercent-asc, price-desc, price-asc, turnoverRate-desc
};

// DOM 元素
let elements = {};

// ==================== 初始化 ====================

async function init() {
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
    refreshStatus: document.getElementById('refresh-status'),
    pauseBtn: document.getElementById('pause-btn'),
    refreshBtn: document.getElementById('refresh-btn'),
    sortButtons: document.getElementById('sort-buttons')
  };
  
  // 从 localStorage 加载持仓
  // 清除旧的 localStorage 数据
  localStorage.removeItem('customStocks');
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
  const savedOrder = localStorage.getItem('customSortOrder') || 'desc';
  pageState.sortOrder = savedOrder;
  
  if (savedSort && savedSort !== 'default') {
    pageState.sortBy = savedSort;
    // 更新排序按钮状态
    document.querySelectorAll('.sort-option').forEach(b => {
      b.classList.remove('active', 'asc', 'desc');
    });
    const activeBtn = document.querySelector(`.sort-option[data-sort="${savedSort}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
      activeBtn.classList.add(savedOrder === 'asc' ? 'asc' : 'desc');
    }
  } else {
    // 默认激活"默认"按钮
    document.querySelector('.sort-option[data-sort="default"]').classList.add('active');
  }
  
  // 初始数据加载（从数据库）
  // loadStocks 内部会调用 fetchAllStockData
  loadStocks();
  
  // 加载指数数据
  fetchIndices();
  
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
  console.log('⏰ 启动自动刷新，间隔:', pageState.refreshInterval, '秒');
  pageState.timer = setInterval(() => {
    // 只在交易时间自动刷新，非交易时间可手动刷新
    if (!isTradingTime()) {
      console.log('⏰ 非交易时间，跳过自动刷新');
      return;
    }
    if (!pageState.isPaused) {
      console.log('🔄 自动刷新持仓数据...');
      if (pageState.positions.length > 0) {
        fetchAllStockData();
      }
      // 同时刷新指数数据
      fetchIndices();
    }
  }, pageState.refreshInterval * 1000);
}

function stopAutoRefresh() {
  if (pageState.timer) {
    clearInterval(pageState.timer);
    pageState.timer = null;
  }
}

// ==================== 持仓管理 ====================

// 从数据库加载用户的持仓
async function loadStocks() {
  try {
    console.log('📦 开始从数据库加载持仓 (type=0)...');
    const response = await fetch('/api/custom-stocks/list?type=0');
    const result = await response.json();
    console.log('📦 数据库返回:', result);
    
    if (result.success) {
      // 将数据库格式转换为页面格式
      pageState.positions = (result.data || []).map(item => ({
        code: item.code,
        market: item.market,
        name: '',  // 名称需要从行情数据获取
        addedAt: new Date(item.addedAt).getTime()
      }));
      console.log('📦 从数据库加载持仓:', pageState.positions.length, '只');
      console.log('📦 加载的股票列表:', pageState.positions);
      updateStockList();
      // 加载完列表后立即获取行情数据
      console.log('📡 开始获取行情数据...');
      await fetchAllStockData();
      return true;
    } else if (!result.success) {
      console.error('加载持仓失败:', result.message);
      // 如果未登录，尝试从 localStorage 加载旧数据
      updateStockList();
      return false;
    }
  } catch (e) {
    console.error('加载持仓失败:', e);
    // 出错时从 localStorage 加载
    updateStockList();
    return false;
  }
}

// 从 localStorage 加载（降级方案）
function loadStocksFromLocalStorage() {
  try {
    const saved = localStorage.getItem('positionsStocks');
    if (saved) {
      pageState.positions = JSON.parse(saved);
      console.log('📦 从 localStorage 加载持仓:', pageState.positions.length, '只');
    }
  } catch (e) {
    console.error('从 localStorage 加载失败:', e);
    pageState.positions = [];
  }
}

// 保存到 localStorage（降级方案）
function saveStocksToLocalStorage() {
  try {
    localStorage.setItem('positionsStocks', JSON.stringify(pageState.positions));
    console.log('💾 已保存到 localStorage');
  } catch (e) {
    console.error('保存到 localStorage 失败:', e);
  }
}

// 保存到数据库（添加股票时调用）
async function saveStockToDb(code, market) {
  try {
    // 持仓页面使用 type=0
    const response = await fetch('/api/custom-stocks/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock_code: code, stock_market: market, type: 0 })
    });
    const result = await response.json();
    if (!result.success) {
      console.error('添加持仓失败:', result.message);
      showToast(result.message || '添加失败', 'error');
    }
    return result.success;
  } catch (e) {
    console.error('保存持仓失败:', e);
    showToast('网络错误', 'error');
    return false;
  }
}

// 从数据库删除（删除股票时调用）
async function deleteStockFromDb(code, market) {
  try {
    const response = await fetch('/api/custom-stocks/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock_code: code, stock_market: market, type: 0 })
    });
    const result = await response.json();
    return result.success;
  } catch (e) {
    console.error('删除持仓失败:', e);
    return false;
  }
}

async function addStock(code, name, market) {
  // 检查是否已存在
  if (pageState.positions.some(s => s.code === code)) {
    showToast('该股票已在自选列表中', 'warning');
    return false;
  }
  
  // 确定市场（如果没有传入）
  if (!market) {
    // 港股：5 位数字代码
    if (/^\d{5}$/.test(code)) {
      market = 'hk';
    } else if (code.startsWith('6') || code.startsWith('9') || code.startsWith('5')) {
      market = 'sh';
    } else if (code.startsWith('0') || code.startsWith('3')) {
      market = 'sz';
    } else if (code.startsWith('8') || code.startsWith('4')) {
      market = 'bj';
    } else {
      market = 'sh'; // 默认
    }
  }
  
  console.log('📝 尝试添加持仓:', code, name, market);
  
  // 添加到数据库
  const success = await saveStockToDb(code, market);
  if (!success) {
    // 如果数据库添加失败，降级到 localStorage
    console.log('⚠️ 数据库添加失败，使用 localStorage 降级方案');
    pageState.positions.push({
      code: code,
      market: market,
      name: name,
      addedAt: Date.now()
    });
    saveStocksToLocalStorage();
    updateStockList();
    fetchAllStockData();
    showToast(`已添加 ${name} (本地存储)`, 'warning');
    return true;
  }
  
  // 添加到本地列表
  pageState.positions.push({
    code: code,
    market: market,
    name: name,
    addedAt: Date.now()
  });
  
  updateStockList();
  fetchAllStockData();
  
  showToast(`已添加 ${name}`, 'success');
  return true;
}

async function removeStock(code) {
  const stock = pageState.positions.find(s => s.code === code);
  if (!stock) return;
  
  if (confirm(`确定要移除 ${stock.name}（${stock.code}）吗？`)) {
    // 从数据库删除
    const market = stock.market || (code.startsWith('6') || code.startsWith('9') ? 'sh' : 'sz');
    const success = await deleteStockFromDb(code, market);
    
    if (success) {
      const index = pageState.positions.findIndex(s => s.code === code);
      if (index > -1) {
        pageState.positions.splice(index, 1);
        updateStockList();
        showToast(`已移除 ${stock.name}`, 'info');
      }
    } else {
      showToast('删除失败', 'error');
    }
  }
}

function clearAllStocks() {
  if (confirm('确定要清空所有持仓吗？')) {
    pageState.positions = [];
    pageState.stockData = {};
    saveStocks();
    updateStockList();
    showToast('已清空持仓', 'info');
  }
}

function updateStockList() {
  elements.stockCount.textContent = pageState.positions.length;
  elements.emptyState.style.display = pageState.positions.length === 0 ? 'block' : 'none';
  elements.clearAllBtn.style.display = pageState.positions.length > 0 ? 'block' : 'none';
  elements.sortButtons.style.display = pageState.positions.length > 0 ? 'flex' : 'none';
  
  renderStockCards();
}

// ==================== 数据获取 ====================

async function fetchAllStockData() {
  if (pageState.positions.length === 0) return;
  
  // 构建股票代码（后端会自动识别市场，但带上前缀更准确）
  const codes = pageState.positions.map(s => s.code).join(',');
  console.log('📡 请求股票数据:', codes);
  
  try {
    const response = await fetch(`/api/stocks/batch?codes=${encodeURIComponent(codes)}`);
    const result = await response.json();
    console.log('📦 股票数据返回:', result);
    
    if (result.success) {
      console.log('📦 行情数据:', result.data);
      // 检测价格变化并记录
      const prevData = { ...pageState.stockData };
      pageState.stockData = result.data;
      
      // 更新最后更新时间
      elements.lastUpdate.textContent = `最后更新：${new Date().toLocaleString('zh-CN')}`;
      
      // 渲染卡片（带闪烁动画）
      console.log('🎨 开始渲染卡片...');
      renderStockCards(prevData);
      console.log('✅ 股票数据渲染完成');
    } else {
      console.error('股票数据获取失败:', result.message);
    }
  } catch (error) {
    console.error('获取股票数据失败:', error);
  }
}

// ==================== 渲染 ====================

// 获取排序后的股票列表
function getSortedStocks() {
  if (pageState.sortBy === 'default') {
    return pageState.positions;
  }
  
  const field = pageState.sortBy;
  const order = pageState.sortOrder || 'desc';  // 默认降序
  
  return [...pageState.positions].sort((a, b) => {
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
  console.log('🎨 renderStockCards - stocks:', pageState.positions.length, 'stockData keys:', Object.keys(pageState.stockData));
  
  if (pageState.positions.length === 0) {
    elements.stockList.innerHTML = '';
    return;
  }
  
  // 获取排序后的股票列表
  const sortedStocks = getSortedStocks();
  
  elements.stockList.innerHTML = sortedStocks.map((stock, displayIndex) => {
    // 找到原始索引用于移动操作
    const originalIndex = pageState.positions.findIndex(s => s.code === stock.code);
    
    // 后端返回的数据键名是纯代码（如 000938），直接用 stock.code 匹配
    const data = pageState.stockData[stock.code];
    console.log('🎨 渲染股票:', stock.code, 'data:', data ? '有数据' : '无数据');
    
    if (!data) {
      return `
        <div class="stock-card" data-code="${stock.code}" data-index="${originalIndex}">
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
            <div class="detail-item"><span class="detail-label">成交额</span><span class="detail-value">--</span></div>
          </div>
          <button class="delete-btn" onclick="event.stopPropagation(); removeStock('${stock.code}')" title="删除">🗑️</button>
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
      <div class="stock-card ${priceClass} ${flashClass}" data-code="${stock.code}" data-index="${originalIndex}" draggable="true">
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
        <div class="stock-details-wrapper">
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
          <button class="delete-btn" onclick="event.stopPropagation(); removeStock('${stock.code}')" title="删除">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
  
  // 初始化拖拽排序
  initDragSort();
  
  // 添加点击事件跳转到个股详细页
  document.querySelectorAll('.stock-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // 排除删除按钮
      if (e.target.classList.contains('delete-btn')) return;
      
      const code = card.dataset.code;
      if (code) {
        // 判断市场
        let market = 'sh';
        if (/^\d{5}$/.test(code)) {
          market = 'hk';  // 港股：5 位数字
        } else if (code.startsWith('6') || code.startsWith('5') || code.startsWith('9')) {
          market = 'sh';
        } else if (code.startsWith('0') || code.startsWith('3')) {
          market = 'sz';
        } else if (code.startsWith('8') || code.startsWith('4')) {
          market = 'bj';
        }
        window.location.href = `/stock-detail/?code=${code}&market=${market}&from=positions`;
      }
    });
  });
}

// ==================== 排序功能 ====================

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
        const item = pageState.positions.splice(fromIndex, 1)[0];
        pageState.positions.splice(toIndex, 0, item);
        
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
    item.addEventListener('click', async () => {
      const code = item.dataset.code;
      const name = item.querySelector('.suggestion-name').textContent;
      const market = item.querySelector('.suggestion-market').textContent === '沪市' ? 'sh' : 'sz';
      elements.stockInput.value = `${code} ${name}`;
      hideSuggestions();
      await addStock(code, name, market);
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
  elements.addBtn.addEventListener('click', async () => {
    const input = elements.stockInput.value.trim();
    if (!input) return;
    
    // 使用与证券行情页一致的代码提取逻辑
    const code = extractCode(input);
    if (code) {
      // 提取市场前缀
      const marketMatch = code.match(/^(sh|sz|bj)/i);
      const market = marketMatch ? marketMatch[1].toLowerCase() : null;
      const cleanCode = code.replace(/^(sh|sz|bj)/i, '');
      
      // 如果是从搜索建议选择的，可能包含名称
      const nameMatch = input.match(/\d{6}\s+(.+)$/);
      const name = nameMatch ? nameMatch[1].trim() : cleanCode;
      
      await addStock(cleanCode, name, market);
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
        addStock(stock.code, stock.name, stock.market);
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
    
    // 更新状态显示
    if (elements.refreshStatus) {
      if (pageState.isPaused) {
        elements.refreshStatus.textContent = '已暂停';
        elements.refreshStatus.classList.add('paused');
      } else {
        elements.refreshStatus.textContent = '运行中';
        elements.refreshStatus.classList.remove('paused');
      }
    }
  });
  
  // 手动刷新
  elements.refreshBtn.addEventListener('click', () => {
    fetchAllStockData();
    fetchIndices();
  });
  
  // 排序按钮
  document.querySelectorAll('.sort-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const sort = btn.dataset.sort;
      
      // 如果点击已激活的按钮，切换升降序
      if (pageState.sortBy === sort) {
        // 切换排序方向
        pageState.sortOrder = pageState.sortOrder === 'desc' ? 'asc' : 'desc';
        btn.classList.toggle('asc', pageState.sortOrder === 'asc');
        btn.classList.toggle('desc', pageState.sortOrder === 'desc');
      } else {
        // 新的排序字段，默认降序
        pageState.sortBy = sort;
        pageState.sortOrder = 'desc';
        
        // 更新按钮状态
        document.querySelectorAll('.sort-option').forEach(b => {
          b.classList.remove('active', 'asc', 'desc');
        });
        btn.classList.add('active');
        btn.classList.add('desc');
      }
      
      // 保存排序设置
      localStorage.setItem('customSortBy', pageState.sortBy);
      localStorage.setItem('customSortOrder', pageState.sortOrder);
      
      // 重新渲染
      renderStockCards(pageState.stockData);
    });
  });
}

// ==================== 侧边栏功能 ====================

// 侧边栏功能由 sidebar.js 统一处理

// ==================== 启动 ====================

// ==================== 指数数据 ====================

// 获取指数数据
async function fetchIndices() {
  try {
    const response = await fetch('/api/indices');
    const result = await response.json();
    
    if (result.success) {
      updateIndicesDisplay(result.data);
    }
  } catch (error) {
    console.error('获取指数数据失败:', error);
  }
}

// 更新指数显示
function updateIndicesDisplay(indices) {
  const indexCodes = ['sh000001', 'sz399001', 'sz399006', 'sh000688', 'sh000905', 'hkHSI'];
  
  indexCodes.forEach(code => {
    const indexData = indices[code];
    const valueEl = document.getElementById(`index-${code}-value`);
    const changeEl = document.getElementById(`index-${code}-change`);
    
    if (indexData && valueEl && changeEl) {
      valueEl.textContent = indexData.price;
      
      const changeSign = parseFloat(indexData.change) >= 0 ? '+' : '';
      const percentSign = parseFloat(indexData.changePercent) >= 0 ? '+' : '';
      changeEl.textContent = `${changeSign}${indexData.change} (${percentSign}${indexData.changePercent}%)`;
      
      // 设置颜色
      changeEl.className = 'index-change ' + getChangeClass(parseFloat(indexData.changePercent));
    }
  });
}

// 获取涨跌样式类
function getChangeClass(value) {
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'flat';
}

// 点击指数跳转到行情页面
function initIndexClick() {
  document.querySelectorAll('.index-item').forEach(item => {
    item.addEventListener('click', () => {
      const code = item.dataset.code;
      window.open(`/stock.html?code=${code}`, '_blank');
    });
  });
}

document.addEventListener('DOMContentLoaded', () => init());

// 初始化指数点击事件
document.addEventListener('DOMContentLoaded', initIndexClick);

// 初始化侧边栏
document.addEventListener('DOMContentLoaded', initSidebar);

// 导出全局函数
window.removeStock = removeStock;
window.goToStockDetail = goToStockDetail;
window.addStock = addStock;