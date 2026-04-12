console.log("🚀 app.js 开始加载");
// 应用状态
const state = {
  refreshInterval: 3,
  isPaused: false,
  timer: null,
  dataSources: {
    volume: 'unknown',
    turnover: 'unknown'
  },
  sortConfig: {
    limitUp: { field: 'limitUpCount', order: 'desc' },
    cashflow: { field: 'mainNetInflow', order: 'desc' },
    turnover: { field: 'turnoverRate', order: 'desc' }
  },
  rawData: {
    limitUp: [],
    cashflow: [],
    turnover: []
  }
};

// DOM 元素（在 init 中初始化）
let elements = {};
// 格式化数字
function formatNumber(num, decimals = 0) {
  if (num === null || num === undefined || isNaN(num)) return '--';
  return Number(num).toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

// 格式化金额（输入：亿元）
function formatAmount(num, showUnit = false) {
  if (num === null || num === undefined || isNaN(num)) return '--';
  // 超过 10000 亿元显示为万亿
  if (Math.abs(num) >= 10000) {
    const value = (num / 10000).toFixed(2);
    return showUnit ? value + '万亿' : value;
  }
  const value = num.toFixed(2);
  return showUnit ? value + '亿' : value;
}

// 更新成交量数据
function updateVolumeData(data) {
  if (!data) return;
  
  const totalAmount = formatAmount(data.totalAmount, true);
  elements.totalAmount.textContent = totalAmount.replace(/[万亿]+$/, '');
  // 更新总成交额单位
  if (elements.totalAmountUnit) {
    if (data.totalAmount >= 10000) {
      elements.totalAmountUnit.textContent = '万亿元';
    } else {
      elements.totalAmountUnit.textContent = '亿元';
    }
  }
  
  // totalVolume 单位是亿手，转换为万手显示（1 亿手 = 10000 万手）
  const totalVolumeWanShou = data.totalVolume * 10000;
  elements.totalVolume.textContent = formatNumber(totalVolumeWanShou);
  
  // 沪市成交额显示（单位：亿元，保留 2 位小数）
  elements.shAmount.textContent = data.shAmount.toFixed(2);
  if (elements.shAmountUnit) {
    elements.shAmountUnit.textContent = '亿元';
  }
  
  // 深市成交额显示（单位：亿元，保留 2 位小数）
  elements.szAmount.textContent = data.szAmount.toFixed(2);
  if (elements.szAmountUnit) {
    elements.szAmountUnit.textContent = '亿元';
  }
  
  elements.shRatio.textContent = data.shRatio + '%';
  elements.szRatio.textContent = data.szRatio + '%';
}

// 排序数据
function sortData(data, field, order = 'desc') {
  if (!field) return data;
  
  return [...data].sort((a, b) => {
    let aVal = a[field];
    let bVal = b[field];
    
    // 转换为数字进行比较
    if (typeof aVal === 'string') {
      aVal = parseFloat(aVal) || 0;
      bVal = parseFloat(bVal) || 0;
    }
    
    if (order === 'desc') {
      return bVal - aVal;
    } else {
      return aVal - bVal;
    }
  });
}

// 更新涨停板块表格
function updateLimitUpTable(data) {
  if (!data) return;
  
  // 过滤：只显示有涨停的板块（涨停数>0）
  const hasLimitUp = data.filter(item => item.limitUpCount > 0);
  
  state.rawData.limitUp = hasLimitUp;
  
  const config = state.sortConfig.limitUp;
  const sortedData = sortData(hasLimitUp, config.field, config.order);
  
  if (sortedData.length === 0) {
    elements.limitUpTable.innerHTML = '<tr><td colspan="5" class="loading">暂无涨停板块</td></tr>';
    return;
  }
  
  elements.limitUpTable.innerHTML = sortedData.map((item, index) => `
    <tr onclick="openSectorModal(this.cells[1].textContent)">
      <td class="code">${item.code || '--'}</td>
      <td>${item.name}</td>
      <td class="sortable" data-sort="totalStocks">${item.totalStocks || 0}</td>
      <td class="up sortable" data-sort="limitUpCount">${item.limitUpCount || 0}</td>
      <td class="${getChangeClass(item.changePercent)} sortable" data-sort="changePercent">${item.changePercent}%</td>
    </tr>
  `).join('');
  
  updateSortIcons('limitUp');
}

// 更新资金流表格
function updateCashflowTable(data) {
  if (!data) return;
  
  state.rawData.cashflow = data;
  
  const config = state.sortConfig.cashflow;
  const sortedData = sortData(data, config.field, config.order);
  
  if (sortedData.length === 0) {
    elements.cashflowTable.innerHTML = '<tr onclick="openSectorModal(this.cells[1].textContent)"><td colspan="3" class="loading">暂无数据</td></tr>';
    return;
  }
  
  elements.cashflowTable.innerHTML = sortedData.map((item, index) => `
    <tr onclick="openSectorModal(this.cells[1].textContent)">
      <td>${item.name}</td>
      <td class="${item.mainNetInflow >= 0 ? 'up' : 'down'}">${item.mainNetInflow >= 0 ? '+' : ''}${formatAmount(item.mainNetInflow)}</td>
      <td class="${item.mainNetInflowRatio >= 0 ? 'up' : 'down'}">${item.mainNetInflowRatio >= 0 ? '+' : ''}${item.mainNetInflowRatio}%</td>
    </tr>
  `).join('');
  
  updateSortIcons('cashflow');
}

// 更新换手率表格
function updateTurnoverTable(data) {
  if (!data) return;
  
  state.rawData.turnover = data;
  
  const config = state.sortConfig.turnover;
  const sortedData = sortData(data, config.field, config.order);
  
  if (sortedData.length === 0) {
    elements.turnoverTable.innerHTML = '<tr onclick="openSectorModal(this.cells[1].textContent)"><td colspan="9" class="loading">暂无数据</td></tr>';
    return;
  }
  
  elements.turnoverTable.innerHTML = sortedData.map((item, index) => `
    <tr onclick="openSectorModal(this.cells[1].textContent)">
      <td>${index + 1}</td>
      <td>${item.code}</td>
      <td>${item.name}</td>
      <td class="${getChangeClass(item.changePercent)}">${item.price}</td>
      <td class="${getChangeClass(item.changePercent)}">${item.changePercent}%</td>
      <td class="up">${item.turnoverRate}%</td>
      <td class="up">${item.actualTurnoverRate}%</td>
      <td>${formatAmount(item.amount)}</td>
      <td>${item.industry || '--'}</td>
    </tr>
  `).join('');
  
  updateSortIcons('turnover');
}

// 更新排序图标
function updateSortIcons(tableType) {
  const config = state.sortConfig[tableType];
  const tables = {
    limitUp: elements.limitUpTable.closest('table'),
    cashflow: elements.cashflowTable.closest('table'),
    turnover: elements.turnoverTable.closest('table')
  };
  
  const table = tables[tableType];
  if (!table) return;
  
  // 清除所有图标
  table.querySelectorAll('th').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
  });
  
  // 添加当前排序图标
  const currentTh = table.querySelector(`th[data-sort="${config.field}"]`);
  if (currentTh) {
    currentTh.classList.add(config.order === 'desc' ? 'sort-desc' : 'sort-asc');
  }
}

// 获取涨跌样式类
function getChangeClass(value) {
  const numValue = parseFloat(value);
  if (numValue > 0) return 'up';
  if (numValue < 0) return 'down';
  return 'flat';
}

// 处理排序点击
function handleSort(tableType, field) {
  const config = state.sortConfig[tableType];
  
  // 切换排序方向
  if (config.field === field) {
    config.order = config.order === 'desc' ? 'asc' : 'desc';
  } else {
    config.field = field;
    config.order = 'desc';
  }
  
  // 重新渲染表格
  const rawData = state.rawData[tableType];
  if (tableType === 'limitUp') {
    updateLimitUpTable(rawData);
  } else if (tableType === 'cashflow') {
    updateCashflowTable(rawData);
  } else if (tableType === 'turnover') {
    updateTurnoverTable(rawData);
  }
}

// 判断市场状态（精确到分钟）
function getMarketStatus() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeInMinutes = hour * 60 + minute;
  
  if (day === 0 || day === 6) return '休市';
  if (timeInMinutes < 9 * 60 + 15) return '未开盘'; // 9:15 前
  if (timeInMinutes < 9 * 60 + 25) return '集合竞价'; // 9:15-9:25
  if (timeInMinutes < 9 * 60 + 30) return '待开盘'; // 9:25-9:30
  if (timeInMinutes < 11 * 60 + 30) return '交易中'; // 上午
  if (timeInMinutes < 13 * 60) return '午休'; // 午休
  if (timeInMinutes < 15 * 60) return '交易中'; // 下午
  if (timeInMinutes >= 15 * 60) return '已收盘';
  
  return '休市';
}

// 判断是否应该显示实时数据（9:15 后或已收盘）
function shouldShowMarketData() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeInMinutes = hour * 60 + minute;
  
  // 周末不显示
  if (day === 0 || day === 6) return false;
  // 9:15 前不显示实时数据
  if (timeInMinutes < 9 * 60 + 15) return false;
  // 其他时间都显示（包括已收盘，显示最后数据）
  return true;
}

// 更新市场状态显示
function updateMarketStatus() {
  const status = getMarketStatus();
  if (elements.marketStatus) {
    elements.marketStatus.textContent = `市场状态：${status}`;
  }
}

// 更新时间显示（北京时间）
function updateDateTime() {
  const now = new Date();
  // 转换为北京时间 (UTC+8)
  const beijingTime = new Date(now.getTime() + (8 - now.getTimezoneOffset() / -60) * 60000);
  
  const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long' };
  const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  
  elements.currentDate.textContent = beijingTime.toLocaleDateString('zh-CN', dateOptions);
  elements.currentTime.textContent = beijingTime.toLocaleTimeString('zh-CN', timeOptions);
}

// 更新数据源显示
function updateDataSources() {
  if (elements.volumeSource) {
    elements.volumeSource.textContent = state.dataSources.volume === 'sina' ? '新浪' : 
                                         state.dataSources.volume === 'tencent' ? '腾讯' : '--';
    elements.volumeSource.className = `source-tag ${state.dataSources.volume}`;
  }
  
  if (elements.turnoverSource) {
    elements.turnoverSource.textContent = state.dataSources.turnover === 'sina' ? '新浪' : 
                                           state.dataSources.turnover === 'tencent' ? '腾讯' : '--';
    elements.turnoverSource.className = `source-tag ${state.dataSources.turnover}`;
  }
}

// 清空首页数据（显示为未开盘状态）
function clearMarketData() {
  // 清空成交量
  elements.totalAmount.textContent = '--';
  if (elements.totalAmountUnit) elements.totalAmountUnit.textContent = '--';
  elements.totalVolume.textContent = '--';
  elements.shAmount.textContent = '--';
  if (elements.shAmountUnit) elements.shAmountUnit.textContent = '--';
  elements.szAmount.textContent = '--';
  if (elements.szAmountUnit) elements.szAmountUnit.textContent = '--';
  elements.shRatio.textContent = '--%';
  elements.szRatio.textContent = '--%';
  
  // 清空涨停板块表格
  elements.limitUpTable.innerHTML = '<tr onclick="openSectorModal(this.cells[1].textContent)"><td colspan="3" class="loading">未开盘，暂无数据</td></tr>';
  
  // 清空资金流表格
  elements.cashflowTable.innerHTML = '<tr onclick="openSectorModal(this.cells[1].textContent)"><td colspan="3" class="loading">未开盘，暂无数据</td></tr>';
  
  // 清空换手率表格
  elements.turnoverTable.innerHTML = '<tr onclick="openSectorModal(this.cells[1].textContent)"><td colspan="9" class="loading">未开盘，暂无数据</td></tr>';
}

// 获取数据
async function fetchData() {
  if (state.isPaused) return;
  
  try {
    const [dataResponse, sourceResponse] = await Promise.all([
      fetch("/api/all", {cache: "no-cache"}),
      fetch("/api/data-sources", {cache: "no-cache"})
    ]);
    
    const data = await dataResponse.json();
    const sources = await sourceResponse.json();
    
    console.log("数据源状态:", sources, "缓存标记:", data.isCached);
    
    state.dataSources.volume = sources.volume || "unknown";
    state.dataSources.turnover = sources.turnover || "unknown";
    
    // 9:15 前显示缓存数据时，添加提示
    if (!shouldShowMarketData() && data.isCached) {
      if (elements.lastUpdate) {
        elements.lastUpdate.textContent = `缓存数据（${data.cachedDate}）- 9:15 后更新实时数据`;
      }
    }
    
    updateDataSources();
    updateVolumeData(data.volume);
    updateLimitUpTable(data.limitUpSectors);
    updateCashflowTable(data.sectorCashflow);
    updateTurnoverTable(data.highTurnover);
    updateDateTime();
    updateMarketStatus();
    
    if (data.lastUpdate && !data.isCached) {
      elements.lastUpdate.textContent = `最后更新：${new Date(data.lastUpdate).toLocaleString('zh-CN')}`;
    }
  } catch (error) {
    console.error('获取数据失败:', error);
  }
}

// 判断是否在交易时间（仅在 9:30-11:30 和 13:00-15:00 刷新）
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

// 启动定时器（只在交易时间自动刷新，非交易时间可手动刷新）
function startTimer() {
  stopTimer();
  state.timer = setInterval(() => {
    // 只在交易时间段自动刷新
    if (!isTradingTime()) {
      return;
    }
    fetchData();
  }, state.refreshInterval * 1000);
}

// 停止定时器
function stopTimer() {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
}

// 初始化排序事件
function initSortEvents() {
  // 涨停板块表格
  elements.limitUpTable.closest('table').querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      handleSort('limitUp', th.dataset.sort);
    });
  });
  
  // 资金流表格
  elements.cashflowTable.closest('table').querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      handleSort('cashflow', th.dataset.sort);
    });
  });
  
  // 换手率表格
  elements.turnoverTable.closest('table').querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      handleSort('turnover', th.dataset.sort);
    });
  });
}

// 事件监听（在 init 中调用）
function initEventListeners() {
  elements.refreshSelect.addEventListener('change', (e) => {
    state.refreshInterval = parseInt(e.target.value);
    elements.refreshInterval.textContent = state.refreshInterval;
    
    localStorage.setItem('refreshInterval', state.refreshInterval);
    
    startTimer();
  });
  
  elements.pauseBtn.addEventListener('click', () => {
  state.isPaused = !state.isPaused;
  elements.pauseBtn.textContent = state.isPaused ? '▶️ 继续' : '⏸️ 暂停';
  
  if (!state.isPaused) {
    fetchData();
    startTimer();
  } else {
    stopTimer();
  }
});

  elements.refreshBtn.addEventListener('click', () => {
    fetchData();
  });
}

// 标签页切换（已移除，只保留首页）
function switchTab(tabName) {
  // 只保留首页
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === 'home');
  });
  
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === 'home-tab');
  });
}

// 初始化
function init() {
  // 初始化 DOM 元素
  elements = {
    refreshSelect: document.getElementById('refresh-select'),
    refreshInterval: document.getElementById('refresh-interval'),
    pauseBtn: document.getElementById('pause-btn'),
    refreshBtn: document.getElementById('refresh-btn'),
    currentDate: document.getElementById('current-date'),
    currentTime: document.getElementById('current-time'),
    volumeSource: document.getElementById('volume-source'),
    turnoverSource: document.getElementById('turnover-source'),
    totalAmount: document.getElementById('total-amount'),
    totalAmountUnit: document.getElementById('total-amount-unit'),
    totalVolume: document.getElementById('total-volume'),
    shAmount: document.getElementById('sh-amount'),
    shAmountUnit: document.getElementById('sh-amount-unit'),
    szAmount: document.getElementById('sz-amount'),
    szAmountUnit: document.getElementById('sz-amount-unit'),
    shRatio: document.getElementById('sh-ratio'),
    szRatio: document.getElementById('sz-ratio'),
    limitUpTable: document.getElementById('limit-up-table'),
    cashflowTable: document.getElementById('cashflow-table'),
    turnoverTable: document.getElementById('turnover-table'),
    lastUpdate: document.getElementById('last-update'),
    marketStatus: document.getElementById('market-status')
  };
  
  const savedInterval = localStorage.getItem('refreshInterval');
  if (savedInterval) {
    state.refreshInterval = parseInt(savedInterval);
    elements.refreshSelect.value = state.refreshInterval;
    elements.refreshInterval.textContent = state.refreshInterval;
  }
  
  // 启动时间更新（每秒）
  updateDateTime();
  setInterval(updateDateTime, 1000);
  
  // 初始化市场状态
  updateMarketStatus();
  
  initSortEvents();
  initEventListeners();
  fetchData();
  startTimer();
  
  // 标签页事件（只保留首页）
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab('home');
    });
  });
  
  // 检查登录状态并显示用户信息
  checkLoginStatus();
  
}


console.log("📄 DOMContentLoaded 触发");
document.addEventListener('DOMContentLoaded', init);

// 侧边栏功能由 sidebar.js 统一处理

// 打开板块成分股模态框
// 成分股排序状态
let sectorStockSort = { field: 'changePercent', order: 'desc' };
window.currentSectorStocks = [];

// 打开板块成分股模态框
async function openSectorModal(sectorName) {
  const modal = document.getElementById('sector-modal');
  const title = document.getElementById('modal-title');
  const table = document.getElementById('sector-stocks-table');
  
  if (!modal || !table) return;
  
  title.textContent = '🔥 ' + sectorName + ' - 成分股';
  table.innerHTML = '<tr><td colspan="7" class="loading">加载中...</td></tr>';
  modal.style.display = 'flex';
  
  // 重置排序
  sectorStockSort = { field: 'changePercent', order: 'desc' };
  
  try {
    const response = await fetch(`/api/sector/${encodeURIComponent(sectorName)}`);
    const result = await response.json();
    
    if (result.success && result.data && result.data.length > 0) {
      window.currentSectorStocks = result.data;
      renderSectorStocks(result.data);
    } else {
      table.innerHTML = '<tr><td colspan="7" class="loading">暂无数据</td></tr>';
    }
  } catch (error) {
    console.error("获取成分股失败:", error); console.log("API 返回:", result);
    table.innerHTML = '<tr><td colspan="7" class="loading">加载失败</td></tr>';
  }
}

// 渲染成分股表格
function renderSectorStocks(data) {
  const table = document.getElementById('sector-stocks-table');
  if (!table) return;
  
  // 排序
  const sorted = [...data].sort((a, b) => {
    let aVal = a[sectorStockSort.field];
    let bVal = b[sectorStockSort.field];
    if (typeof aVal === 'string') aVal = parseFloat(aVal) || 0;
    if (typeof bVal === 'string') bVal = parseFloat(bVal) || 0;
    return sectorStockSort.order === 'asc' ? aVal - bVal : bVal - aVal;
  });
  
  table.innerHTML = sorted.map(stock => `
    <tr onclick="searchStock('${stock.code}')">
      <td class="code">${stock.code}</td>
      <td>${stock.name}</td>
      <td class="${parseFloat(stock.price) > 0 ? 'up' : ''}">${stock.price.toFixed(2)}</td>
      <td class="${parseFloat(stock.changePercent) >= 0 ? 'up' : 'down'}">${parseFloat(stock.changePercent) >= 0 ? '+' : ''}${stock.changePercent}%</td>
      <td>${formatNumber(stock.volume)}手</td>
      <td>${formatAmount(stock.amount)}亿</td>
      <td>${stock.turnover}%</td>
    </tr>
  `).join('');
  
  // 添加表头排序事件
  const headers = document.querySelectorAll('#sector-modal th.sortable');
  headers.forEach(th => {
    const field = th.dataset.sort;
    th.onclick = () => {
      if (sectorStockSort.field === field) {
        sectorStockSort.order = sectorStockSort.order === 'asc' ? 'desc' : 'asc';
      } else {
        sectorStockSort.field = field;
        sectorStockSort.order = 'desc';
      }
      renderSectorStocks(window.currentSectorStocks);
    };
  });
}

// 格式化金额（万元→亿元）
function formatAmount(wan) {
  if (!wan) return '0.00';
  const yi = wan / 10000;
  return yi.toFixed(2);
}

// 关闭模态框
function closeSectorModal() {
  const modal = document.getElementById('sector-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// 点击模态框外部关闭
window.addEventListener('click', (e) => {
  const modal = document.getElementById('sector-modal');
  if (e.target === modal) {
    closeSectorModal();
  }
});

// 跳转到股票详情页
function searchStock(code) {
  // 处理指数代码
  let fullCode = code;
  if (/^\d{6}$/.test(code)) {
    // 上证指数
    if (code === '000001' || code === '000016' || code === '000300' || code.startsWith('0000')) {
      fullCode = 'sh' + code;
    }
    // 深证指数
    else if (code.startsWith('399')) {
      fullCode = 'sz' + code;
    }
    // 上海股票
    else if (code.startsWith('6') || code.startsWith('9') || code.startsWith('5')) {
      fullCode = 'sh' + code;
    }
    // 深圳股票
    else {
      fullCode = 'sz' + code;
    }
  }
  
  // 跳转到证券行情页面
  window.location.href = `/stock?code=${fullCode}`;
}

// ==================== 登录状态管理 ====================

// 检查登录状态
function checkLoginStatus() {
  const userInfo = document.getElementById('user-info');
  const userName = document.getElementById('user-name');
  const logoutBtn = document.getElementById('logout-btn');
  
  if (userInfo && userName && logoutBtn) {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const username = localStorage.getItem('username');
    
    if (isLoggedIn && username) {
      userInfo.style.display = 'flex';
      userName.textContent = `👤 ${username}`;
      
      // 绑定登出事件
      logoutBtn.addEventListener('click', handleLogout);
    } else {
      userInfo.style.display = 'none';
    }
  }
}

// 处理登出
async function handleLogout() {
  if (!confirm('确定要退出登录吗？')) return;
  
  try {
    const response = await fetch('/api/logout');
    const result = await response.json();
    
    if (result.success) {
      // 清除本地存储
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('username');
      localStorage.removeItem('loginTime');
      
      // 跳转到登录页
      window.location.href = '/login.html';
    }
  } catch (error) {
    console.error('登出失败:', error);
    // 即使 API 失败也清除本地状态
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
    localStorage.removeItem('loginTime');
    window.location.href = '/login.html';
  }
}
