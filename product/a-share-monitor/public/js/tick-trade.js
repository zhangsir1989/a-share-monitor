/**
 * 逐笔成交明细页面
 */

// 页面状态
const pageState = {
  tickTrades: [],
  currentPage: 1,
  pageSize: 20,
  total: 0,
  filters: {}
};

// DOM 元素
let elements = {};

// ==================== 初始化 ====================

function init() {
  console.log(' 逐笔成交页面初始化...');
  try {
    cacheElements();
    console.log('✅ 元素缓存完成');
    
    // 检查登录状态
    if (!checkLoginStatus()) {
      console.warn('❌ 登录检查失败');
      return;
    }
    console.log('✅ 登录检查通过');
    
    // 业务日期默认为空（查询全部日期）
    if (elements.tradeDate) elements.tradeDate.value = '';
    
    // 启用同步按钮
    if (elements.btnSync) {
      elements.btnSync.disabled = false;
    }
    
    // 检查是否有同步任务在运行，恢复进度条
    checkSyncProgress();
    
    bindEvents();
    console.log('✅ 事件绑定完成');
    
    // 异步加载数据
    (async () => {
      try {
        await loadStats();
        console.log('✅ 统计数据加载完成');
        await loadTickTrades();
        console.log('✅ 明细数据加载完成');
      } catch (error) {
        console.error('❌ 数据加载失败:', error);
      }
    })();
  } catch (error) {
    console.error('❌ 初始化失败:', error);
  }
}

function cacheElements() {
  elements = {
    sidebarUsername: document.getElementById('sidebar-username'),
    btnSync: document.getElementById('btn-sync'),
    btnClear: document.getElementById('btn-clear'),
    tradeDate: document.getElementById('trade-date'),
    symbol: document.getElementById('symbol'),
    market: document.getElementById('market'),
    timeStart: document.getElementById('time-start'),
    timeEnd: document.getElementById('time-end'),
    direction: document.getElementById('direction'),
    priceMin: document.getElementById('price-min'),
    priceMax: document.getElementById('price-max'),
    volumeMin: document.getElementById('volume-min'),
    volumeMax: document.getElementById('volume-max'),
    amountMin: document.getElementById('amount-min'),
    amountMax: document.getElementById('amount-max'),
    btnSearch: document.getElementById('btn-search'),
    btnReset: document.getElementById('btn-reset'),
    tickTradeTable: document.getElementById('tick-trade-table'),
    totalCount: document.getElementById('total-count'),
    shCount: document.getElementById('sh-count'),
    szCount: document.getElementById('sz-count'),
    buyCount: document.getElementById('buy-count'),
    sellCount: document.getElementById('sell-count'),
    pageInfo: document.getElementById('page-info'),
    pageNum: document.getElementById('page-num'),
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next'),
    pageSize: document.getElementById('page-size'),
    // 进度条元素
    syncProgressContainer: document.getElementById('sync-progress-container'),
    syncPercent: document.getElementById('sync-percent'),
    syncProgressFill: document.getElementById('sync-progress-fill'),
    syncCurrent: document.getElementById('sync-current'),
    syncTotal: document.getElementById('sync-total'),
    syncRecords: document.getElementById('sync-records'),
    syncDuration: document.getElementById('sync-duration'),
    btnProgressToggle: document.getElementById('btn-progress-toggle')
  };
}

// ==================== 登录状态 ====================

function checkLoginStatus() {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  const username = localStorage.getItem('username');
  const userRole = localStorage.getItem('userRole') || '0';
  
  if (!isLoggedIn || !username || userRole !== '1') {
    alert('❌ 只有管理员可以访问此页面');
    window.location.href = '/login.html';
    return false;
  }
  
  if (elements.sidebarUsername) {
    elements.sidebarUsername.textContent = username;
  }
  return true;
}

// ==================== 加载统计数据 ====================

async function loadStats() {
  console.log('📊 开始加载统计数据...');
  try {
    const tradeDate = elements.tradeDate ? elements.tradeDate.value : '';
    const params = new URLSearchParams({ trade_date: tradeDate });
    
    console.log('📡 请求 API:', `/api/tick-trade/stats?${params}`);
    const response = await fetch(`/api/tick-trade/stats?${params}`);
    const result = await response.json();
    console.log('📥 API 响应:', result);
    
    if (result.success) {
      const { total, byMarket, byDirection } = result.data;
      console.log('📈 总数:', total, '市场:', byMarket, '方向:', byDirection);
      
      if (elements.totalCount) elements.totalCount.textContent = total.toLocaleString();
      // 数据库中小写 sh/sz，方向 0/1/2
      if (elements.shCount) elements.shCount.textContent = (byMarket.sh || 0).toLocaleString();
      if (elements.szCount) elements.szCount.textContent = (byMarket.sz || 0).toLocaleString();
      // direction: 0=中性，1=主动买，2=主动卖
      if (elements.buyCount) elements.buyCount.textContent = (byDirection[1] || 0).toLocaleString();
      if (elements.sellCount) elements.sellCount.textContent = (byDirection[2] || 0).toLocaleString();
      console.log('✅ 统计数据已更新');
    } else {
      console.error('❌ API 返回失败:', result.message);
    }
  } catch (error) {
    console.error('❌ 加载统计失败:', error);
  }
}

// ==================== 加载逐笔成交数据 ====================

async function loadTickTrades() {
  console.log('📋 开始加载逐笔成交数据...');
  try {
    // 方向字段转换：前端显示"N 中性"/"B 买"/"S 卖"，后端查询用 0/1/2
    let directionValue = '';
    if (elements.direction && elements.direction.value) {
      const dirMap = { 'N 中性': '0', 'B 买': '1', 'S 卖': '2' };
      directionValue = dirMap[elements.direction.value] || '';
    }
    
    const filters = {
      page: pageState.currentPage,
      pageSize: pageState.pageSize,
      trade_date: elements.tradeDate ? elements.tradeDate.value : '',
      symbol: elements.symbol ? elements.symbol.value.trim() : '',
      market: elements.market ? elements.market.value : '',
      direction: directionValue,
      time_start: elements.timeStart ? elements.timeStart.value : '',
      time_end: elements.timeEnd ? elements.timeEnd.value : '',
      price_min: elements.priceMin ? elements.priceMin.value : '',
      price_max: elements.priceMax ? elements.priceMax.value : '',
      volume_min: elements.volumeMin ? elements.volumeMin.value : '',
      volume_max: elements.volumeMax ? elements.volumeMax.value : '',
      amount_min: elements.amountMin ? elements.amountMin.value : '',
      amount_max: elements.amountMax ? elements.amountMax.value : ''
    };
    
    const params = new URLSearchParams(filters);
    
    console.log('📡 请求 API:', `/api/tick-trade?${params}`);
    const response = await fetch(`/api/tick-trade?${params}`);
    const result = await response.json();
    console.log('📥 API 响应:', result);
    
    if (result.success) {
      pageState.tickTrades = result.data || [];
      pageState.total = result.total || 0;
      console.log('📊 数据条数:', pageState.tickTrades.length);
      renderTable();
      updatePagination();
      console.log('✅ 表格已渲染');
    } else {
      console.error('❌ API 返回失败:', result.message);
      elements.tickTradeTable.innerHTML = '<tr><td colspan="9" class="loading">加载失败</td></tr>';
    }
  } catch (error) {
    console.error('❌ 加载逐笔成交失败:', error);
    elements.tickTradeTable.innerHTML = '<tr><td colspan="9" class="loading">网络错误</td></tr>';
  }
}

// ==================== 渲染表格 ====================

function renderTable() {
  console.log('🎨 开始渲染表格...');
  console.log('  - tickTrades:', pageState.tickTrades);
  console.log('  - tickTradeTable 元素:', elements.tickTradeTable);
  
  if (!pageState.tickTrades || pageState.tickTrades.length === 0) {
    console.log('⚠️ 没有数据，显示提示');
    if (elements.tickTradeTable) {
      elements.tickTradeTable.innerHTML = '<tr><td colspan="9" class="loading">暂无数据</td></tr>';
      console.log('✅ 已设置暂无数据提示');
    } else {
      console.error('❌ tickTradeTable 元素不存在');
    }
    return;
  }
  
  // direction: 0=中性，1=主动买，2=主动卖
  const directionMap = {
    '0': '<span class="direction-neutral">N 中性</span>',
    '1': '<span class="direction-buy">B 买</span>',
    '2': '<span class="direction-sell">S 卖</span>'
  };
  
  const html = pageState.tickTrades.map(tick => {
    const marketText = tick.market === 'sh' ? '沪市' : (tick.market === 'sz' ? '深市' : tick.market);
    const directionHtml = directionMap[String(tick.direction)] || `<span>${tick.direction}</span>`;
    
    return `<tr>
      <td>${tick.trade_date}</td>
      <td>${tick.symbol}</td>
      <td>${getStockName(tick.symbol)}</td>
      <td>${marketText}</td>
      <td>${tick.trade_time}</td>
      <td class="price">${tick.price.toFixed(2)}</td>
      <td>${tick.volume.toLocaleString()}</td>
      <td>${tick.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
      <td>${directionHtml}</td>
    </tr>`;
  }).join('');
  
  elements.tickTradeTable.innerHTML = html;
}

// 获取股票名称（从本地缓存或证券列表）
function getStockName(symbol) {
  // 这里可以从证券信息缓存中获取，暂时返回代码
  return symbol;
}

// ==================== 分页 ====================

function updatePagination() {
  const totalPages = Math.ceil(pageState.total / pageState.pageSize) || 1;
  
  elements.pageInfo.textContent = `共 ${pageState.total} 条`;
  elements.pageNum.textContent = `${pageState.currentPage} / ${totalPages}`;
  
  elements.btnPrev.disabled = pageState.currentPage === 1;
  elements.btnNext.disabled = pageState.currentPage >= totalPages;
}

// ==================== 事件绑定 ====================

function bindEvents() {
  // 进度条切换按钮
  if (elements.btnProgressToggle) {
    elements.btnProgressToggle.addEventListener('click', toggleProgress);
  }
  
  // 同步按钮
  if (elements.btnSync) {
    elements.btnSync.addEventListener('click', handleSync);
  }
  
  // 清空按钮
  if (elements.btnClear) {
    elements.btnClear.addEventListener('click', handleClear);
  }
  
  // 查询按钮
  if (elements.btnSearch) {
    elements.btnSearch.addEventListener('click', () => {
      pageState.currentPage = 1;
      loadStats();
      loadTickTrades();
    });
  }
  
  // 重置按钮
  if (elements.btnReset) {
    elements.btnReset.addEventListener('click', () => {
      const today = new Date().toISOString().split('T')[0];
      if (elements.tradeDate) elements.tradeDate.value = today;
      if (elements.symbol) elements.symbol.value = '';
      if (elements.market) elements.market.value = '';
      if (elements.timeStart) elements.timeStart.value = '';
      if (elements.timeEnd) elements.timeEnd.value = '';
      if (elements.direction) elements.direction.value = '';
      if (elements.priceMin) elements.priceMin.value = '';
      if (elements.priceMax) elements.priceMax.value = '';
      if (elements.volumeMin) elements.volumeMin.value = '';
      if (elements.volumeMax) elements.volumeMax.value = '';
      if (elements.amountMin) elements.amountMin.value = '';
      if (elements.amountMax) elements.amountMax.value = '';
      
      pageState.currentPage = 1;
      loadStats();
      loadTickTrades();
    });
  }
  
  // 日期改变时自动刷新
  if (elements.tradeDate) {
    elements.tradeDate.addEventListener('change', () => {
      pageState.currentPage = 1;
      loadStats();
      loadTickTrades();
    });
  }
  
  // 分页大小改变
  if (elements.pageSize) {
    elements.pageSize.addEventListener('change', () => {
      pageState.pageSize = parseInt(elements.pageSize.value);
      pageState.currentPage = 1;
      loadTickTrades();
    });
  }
  
  // 分页按钮
  if (elements.btnPrev) {
    elements.btnPrev.addEventListener('click', () => {
      if (pageState.currentPage > 1) {
        pageState.currentPage--;
        loadTickTrades();
      }
    });
  }
  
  if (elements.btnNext) {
    elements.btnNext.addEventListener('click', () => {
      const totalPages = Math.ceil(pageState.total / pageState.pageSize) || 1;
      if (pageState.currentPage < totalPages) {
        pageState.currentPage++;
        loadTickTrades();
      }
    });
  }
  
  // 回车键查询
  if (elements.symbol) {
    elements.symbol.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        pageState.currentPage = 1;
        loadStats();
        loadTickTrades();
      }
    });
  }
}

// ==================== 同步逐笔成交 ====================

let syncPollingTimer = null;
let progressVisible = true;  // 进度条可见状态
let isSyncing = false;  // 是否正在同步

// 检查同步进度（页面加载时调用）
async function checkSyncProgress() {
  try {
    const response = await fetch('/api/tick-trade/sync-progress');
    const result = await response.json();
    
    if (result.success && result.data.running) {
      // 同步仍在运行，显示进度条并开始轮询
      const { current, total, records, duration } = result.data;
      const percent = total > 0 ? (current / total * 100) : 0;
      
      isSyncing = true;
      showProgress();
      updateProgress(current, total, records, duration, percent);
      pollProgress();
      updateSyncButton();
    } else {
      isSyncing = false;
      updateSyncButton();
    }
  } catch (error) {
    console.error('检查同步进度失败:', error);
    isSyncing = false;
    updateSyncButton();
  }
}

// 更新同步按钮状态
function updateSyncButton() {
  if (!elements.btnSync) return;
  
  if (isSyncing) {
    elements.btnSync.textContent = '⏸️ 暂停同步';
    elements.btnSync.classList.add('btn-warning');
  } else {
    elements.btnSync.textContent = '🔄 同步逐笔';
    elements.btnSync.classList.remove('btn-warning');
  }
}

async function handleSync() {
  const tradeDate = elements.tradeDate ? elements.tradeDate.value : new Date().toISOString().split('T')[0];
  
  // 如果正在同步，点击则暂停
  if (isSyncing) {
    if (!confirm('⚠️ 确定要暂停同步吗？\n\n已同步的数据会保留，下次可以继续同步。')) {
      return;
    }
    
    // 调用后端暂停 API
    try {
      const response = await fetch('/api/tick-trade/pause', {
        method: 'POST'
      });
      const result = await response.json();
      console.log('暂停结果:', result);
    } catch (error) {
      console.error('暂停失败:', error);
    }
    
    // 停止轮询
    if (syncPollingTimer) {
      clearInterval(syncPollingTimer);
      syncPollingTimer = null;
    }
    
    isSyncing = false;
    hideProgress();
    updateSyncButton();
    
    alert('⏸️ 同步已暂停');
    return;
  }
  
  // 开始新的同步
  if (!confirm(`确定要同步 ${tradeDate} 的逐笔成交明细吗？\n\n这可能需要几分钟时间...`)) {
    return;
  }
  
  // 显示进度条
  showProgress();
  isSyncing = true;
  updateSyncButton();
  
  try {
    const response = await fetch('/api/tick-trade/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trade_date: tradeDate })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // 开始轮询进度
      pollProgress();
    } else {
      isSyncing = false;
      hideProgress();
      updateSyncButton();
      alert('❌ 同步失败：' + result.message);
    }
  } catch (error) {
    console.error('同步逐笔成交失败:', error);
    isSyncing = false;
    hideProgress();
    updateSyncButton();
    alert('❌ 网络错误，请稍后重试');
  }
}

// 显示进度条
function showProgress() {
  if (elements.syncProgressContainer) {
    elements.syncProgressContainer.style.display = 'block';
    progressVisible = true;
    if (elements.btnProgressToggle) {
      elements.btnProgressToggle.textContent = '👁️';
      elements.btnProgressToggle.title = '隐藏进度条';
    }
  }
  updateProgress(0, 0, 0, 0, 0);
}

// 隐藏进度条（按钮仍然可见）
function hideProgress() {
  if (elements.syncProgressContainer) {
    elements.syncProgressContainer.style.display = 'none';
    progressVisible = false;
    if (elements.btnProgressToggle) {
      elements.btnProgressToggle.textContent = '👁️️';
      elements.btnProgressToggle.title = '显示进度条';
    }
  }
}

// 切换进度条显示/隐藏
function toggleProgress() {
  if (progressVisible) {
    hideProgress();
  } else {
    showProgress();
    // 如果同步还在进行，继续轮询
    pollProgress();
  }
}

// 更新进度条
function updateProgress(current, total, records, duration, percent) {
  if (elements.syncPercent) {
    elements.syncPercent.textContent = percent.toFixed(1) + '%';
  }
  if (elements.syncProgressFill) {
    elements.syncProgressFill.style.width = percent.toFixed(1) + '%';
  }
  if (elements.syncCurrent) {
    elements.syncCurrent.textContent = current.toLocaleString();
  }
  if (elements.syncTotal) {
    elements.syncTotal.textContent = total.toLocaleString();
  }
  if (elements.syncRecords) {
    elements.syncRecords.textContent = records.toLocaleString();
  }
  if (elements.syncDuration) {
    elements.syncDuration.textContent = duration.toFixed(1);
  }
}

// 轮询进度
function pollProgress() {
  // 清除旧的轮询
  if (syncPollingTimer) {
    clearInterval(syncPollingTimer);
  }
  
  syncPollingTimer = setInterval(async () => {
    try {
      const response = await fetch('/api/tick-trade/sync-progress');
      const result = await response.json();
      
      if (result.success) {
        const { current, total, records, duration, running } = result.data;
        const percent = total > 0 ? (current / total * 100) : 0;
        
        // 只在进度条可见时更新 UI
        if (progressVisible) {
          updateProgress(current, total, records, duration, percent);
        }
        
        // 如果同步完成，停止轮询
        if (!running) {
          clearInterval(syncPollingTimer);
          syncPollingTimer = null;
          isSyncing = false;
          hideProgress();
          updateSyncButton();
          
          // 刷新数据
          loadStats();
          loadTickTrades();
          
          setTimeout(() => {
            alert('✅ 同步完成！\n共同步 ' + current.toLocaleString() + ' 只证券，' + records.toLocaleString() + ' 条成交记录');
          }, 100);
        }
      } else {
        clearInterval(syncPollingTimer);
        hideProgress();
        elements.btnSync.disabled = false;
      }
    } catch (error) {
      console.error('轮询进度失败:', error);
      clearInterval(syncPollingTimer);
      hideProgress();
      elements.btnSync.disabled = false;
    }
  }, 1000);  // 每秒轮询一次
}

// ==================== 清空指定日期数据 ====================

// ==================== 清空指定日期数据 ====================

async function handleClear() {
  // 弹出日期选择器
  const tradeDate = prompt('⚠️ 请输入要清空的日期（格式：YYYY-MM-DD）\n例如：2026-04-04\n\n注意：此操作将删除该日期的所有逐笔成交数据，不可恢复！', new Date().toISOString().split('T')[0]);
  
  if (!tradeDate) {
    return; // 用户取消
  }
  
  // 验证日期格式
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(tradeDate)) {
    alert('❌ 日期格式错误！请使用 YYYY-MM-DD 格式，例如：2026-04-04');
    return;
  }
  
  // 二次确认
  if (!confirm('⚠️ 严重警告！\n\n确定要删除 ' + tradeDate + ' 的所有逐笔成交数据吗？\n\n此操作不可恢复！')) {
    return;
  }
  
  try {
    const response = await fetch('/api/tick-trade/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trade_date: tradeDate })
    });
    
    const result = await response.json();
    
    if (result.success) {
      alert('✅ ' + result.message);
      loadStats();
      loadTickTrades();
    } else {
      alert('❌ 清空失败：' + result.message);
    }
  } catch (error) {
    console.error('清空逐笔成交失败:', error);
    alert('❌ 网络错误，请稍后重试');
  }
}

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', init);
