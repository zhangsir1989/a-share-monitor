/**
 * 个股详细页主程序
 */

// 页面状态
const StockState = {
  code: '',
  market: '',
  refreshTimer: null,
  tradeTimer: null,
  capitalTimer: null,
  refreshInterval: 500,     // 默认刷新间隔500ms
  refreshPaused: false,     // 刷新暂停状态
  tickTradeExpanded: false  // 逐笔成交展开状态
};

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('📈 个股详细页初始化...');
  
  // 获取 URL 参数
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const market = params.get('market');
  
  if (!code) {
    Utils.showError('缺少股票代码参数');
    setTimeout(() => {
      window.location.href = '/custom';
    }, 2000);
    return;
  }
  
  StockState.code = code;
  StockState.market = market || Utils.getMarketByCode(code);
  
  console.log('📊 股票代码:', StockState.code, '市场:', StockState.market);
  
  // 更新页面标题
  updatePageTitle(code);
  
  // 绑定事件
  bindEvents();
  
  // 启动时钟
  startClock();
  
  // 加载数据
  await loadAllData();
  
  // 启动定时刷新（默认500ms）
  startAutoRefresh();
});

// ==================== 数据加载 ====================

async function loadAllData() {
  console.log('📡 开始加载数据...');
  
  // 初始化分时图表
  IntradayChart.init('intraday-canvas');
  
  // 加载分时走势数据
  const intradayResult = await API.getIntraday(StockState.code, StockState.market);
  if (intradayResult.success) {
    IntradayChart.render(intradayResult.data);
    console.log('✅ 分时走势加载完成');
  } else {
    IntradayChart.drawPlaceholder('分时数据加载失败');
  }
  
  // 加载基本信息
  const basicResult = await API.getStockBasic(StockState.code, StockState.market);
  if (basicResult.success) {
    UI.updateBasicInfo(basicResult.data);
    UI.updateBasicData(basicResult.data);
    console.log('✅ 基本信息加载完成');
  } else {
    UI.showError('stock-header', basicResult.message);
  }
  
  // 加载买卖盘口
  const orderBookResult = await API.getOrderBook(StockState.code, StockState.market);
  if (orderBookResult.success) {
    UI.updateOrderBook(orderBookResult.data);
    console.log('✅ 买卖盘口加载完成');
  }
  
  // 加载资金流向（通过逐笔成交数据计算）
  console.log('💰 开始计算资金流向...');
  const capitalResult = await API.getCapitalFlow(StockState.code, StockState.market);
  if (capitalResult.success && capitalResult.data) {
    UI.updateCapitalFlow(capitalResult.data);
    console.log('✅ 资金流向计算完成');
  } else {
    console.warn('⚠️ 资金流向计算失败:', capitalResult.message);
  }
  
  // 加载逐笔成交（默认显示10条）
  await loadTickTrades();
}

async function loadTickTrades() {
  const result = await API.getTickTrades(StockState.code, 10, StockState.tickTradeExpanded);
  if (result.success) {
    UI.updateTickTradeTable(result.data, StockState.tickTradeExpanded);
    console.log(`✅ 逐笔成交加载完成: ${result.data.length}条 (总共${result.total}条)`);
  } else {
    console.warn('⚠️ 逐笔成交加载失败:', result.message);
  }
}

// ==================== 自动刷新 ====================

function startAutoRefresh() {
  // 清除所有定时器
  stopAutoRefresh();
  
  // 快速刷新（500ms）- 成交明细、资金流向、五档
  StockState.tradeTimer = setInterval(() => {
    if (!StockState.refreshPaused && Utils.isTradingTime()) {
      loadTradeDetail();
      loadOrderBook();
      loadCapitalFlow();
    }
  }, StockState.refreshInterval);
  
  // 正常刷新（1秒）- 基本数据
  StockState.refreshTimer = setInterval(() => {
    if (!StockState.refreshPaused && Utils.isTradingTime()) {
      loadBasicInfo();
    }
  }, CONFIG.REFRESH.NORMAL);
  
  console.log(`✅ 自动刷新已启动（间隔: ${StockState.refreshInterval}ms）`);
  updateRefreshStatusUI();
}

function stopAutoRefresh() {
  if (StockState.refreshTimer) {
    clearInterval(StockState.refreshTimer);
    StockState.refreshTimer = null;
  }
  if (StockState.tradeTimer) {
    clearInterval(StockState.tradeTimer);
    StockState.tradeTimer = null;
  }
  if (StockState.intradayTimer) {
    clearInterval(StockState.intradayTimer);
    StockState.intradayTimer = null;
  }
  if (StockState.capitalTimer) {
    clearInterval(StockState.capitalTimer);
    StockState.capitalTimer = null;
  }
}

// 单独加载函数（用于刷新）
async function loadBasicInfo() {
  const result = await API.getStockBasic(StockState.code, StockState.market);
  if (result.success) {
    UI.updateBasicInfo(result.data);  // 更新股票名称、价格、涨幅
    UI.updateBasicData(result.data);  // 更新基本数据表格
  }
  // 同时更新分时图
  const intradayResult = await API.getIntraday(StockState.code, StockState.market);
  if (intradayResult.success) {
    IntradayChart.render(intradayResult.data);
  }
}

// 只更新分时图（500ms 刷新）
async function loadIntraday() {
  const result = await API.getIntraday(StockState.code, StockState.market);
  if (result.success) {
    IntradayChart.render(result.data);
  }
}

// 只更新基本数据模块（1 秒刷新）
async function loadBasicDataOnly() {
  const result = await API.getStockBasic(StockState.code, StockState.market);
  if (result.success) {
    UI.updateBasicData(result.data);  // 只更新基本数据表格
  }
}

async function loadOrderBook() {
  const result = await API.getOrderBook(StockState.code, StockState.market);
  if (result.success) {
    UI.updateOrderBook(result.data);
  }
}

// 暂停/恢复刷新
function toggleRefreshPause() {
  StockState.refreshPaused = !StockState.refreshPaused;
  updateRefreshStatusUI();
  
  if (StockState.refreshPaused) {
    console.log('⏸️ 刷新已暂停');
  } else {
    console.log('▶️ 刷新已恢复');
  }
}

// 更新刷新状态 UI
function updateRefreshStatusUI() {
  const pauseBtn = document.getElementById('btn-pause-refresh');
  const statusEl = document.getElementById('refresh-status');
  const intervalEl = document.getElementById('current-interval');
  
  if (pauseBtn) {
    pauseBtn.textContent = StockState.refreshPaused ? '▶️ 恢复' : '⏸️ 暂停';
    pauseBtn.className = StockState.refreshPaused ? 'btn-resume' : 'btn-pause';
  }
  
  if (statusEl) {
    statusEl.textContent = StockState.refreshPaused ? '已暂停' : '运行中';
    statusEl.className = StockState.refreshPaused ? 'status-paused' : 'status-running';
  }
  
  if (intervalEl) {
    intervalEl.textContent = `${StockState.refreshInterval}ms`;
  }
}

// 更新基本数据模块 UI（置灰显示 1 秒刷新）
function updateBasicDataUI() {
  const basicCard = document.querySelector('.basic-card');
  if (basicCard) {
    // 添加置灰样式类
    basicCard.classList.add('basic-data-slow-refresh');
    
    // 添加提示文字
    let hintEl = basicCard.querySelector('.refresh-hint');
    if (!hintEl) {
      hintEl = document.createElement('span');
      hintEl.className = 'refresh-hint';
      hintEl.textContent = '1 秒刷新';
      hintEl.title = '基本数据模块固定 1 秒刷新一次';
      const header = basicCard.querySelector('.card-header h3');
      if (header) {
        header.parentNode.appendChild(hintEl);
      }
    }
  }
}

// 设置刷新间隔
function setRefreshInterval(interval) {
  StockState.refreshInterval = interval;
  startAutoRefresh();
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
  const btnBack = document.getElementById('btn-back');
  if (btnBack) {
    btnBack.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // 检查是否从持仓页跳转而来
      const fromPositions = new URLSearchParams(window.location.search).get('from') === 'positions';
      
      if (fromPositions) {
        window.location.href = '/positions';
      } else if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/custom';
      }
    });
  }
  
  // 加自选按钮
  const btnAddCustom = document.getElementById('btn-add-custom');
  if (btnAddCustom) {
    btnAddCustom.addEventListener('click', async () => {
      const result = await API.addToCustom(StockState.code, StockState.market);
      if (result.success) {
        Utils.showSuccess('已添加到自选股');
      } else {
        Utils.showError(result.message || '添加失败');
      }
    });
  }
  
  // 刷新暂停按钮
  const btnPauseRefresh = document.getElementById('btn-pause-refresh');
  if (btnPauseRefresh) {
    btnPauseRefresh.addEventListener('click', toggleRefreshPause);
  }
  
  // 刷新间隔选择
  const intervalSelect = document.getElementById('refresh-interval');
  if (intervalSelect) {
    intervalSelect.addEventListener('change', (e) => {
      const interval = parseInt(e.target.value);
      if (interval >= 100) {  // 最小100ms
        setRefreshInterval(interval);
      }
    });
  }
  
  // 刷新频率切换（成交明细区域）
  document.querySelectorAll('.detail-tabs .tab-btn').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.detail-tabs .tab-btn').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const interval = parseInt(tab.dataset.refresh) * 1000;
      StockState.refreshInterval = interval;
      startAutoRefresh();
    });
  });
  
  // 逐笔成交展开/收起按钮
  const btnExpandTick = document.getElementById('btn-expand-tick');
  if (btnExpandTick) {
    btnExpandTick.addEventListener('click', async () => {
      StockState.tickTradeExpanded = !StockState.tickTradeExpanded;
      await loadTickTrades();
    });
  }
}

function updatePageTitle(code) {
  document.title = `${code} 个股详细 - A 股实时监控`;
  const stockTitle = document.getElementById('stock-title');
  if (stockTitle) {
    stockTitle.textContent = `📈 ${code} 个股详细`;
  }
}