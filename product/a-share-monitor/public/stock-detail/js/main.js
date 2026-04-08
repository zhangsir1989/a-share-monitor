/**
 * 个股详细页主程序
 */

// 页面状态
const StockState = {
  code: '',
  market: '',
  refreshTimer: null,
  tradeTimer: null,
  refreshInterval: 3000,
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
  
  // 启动定时刷新
  startAutoRefresh();
});

// ==================== 数据加载 ====================

async function loadAllData() {
  console.log('📡 开始加载数据...');
  
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
  
  // 加载成交明细
  await loadTradeDetail();
  
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

async function loadTradeDetail() {
  const result = await API.getTradeDetail(StockState.code, StockState.market);
  if (result.success) {
    UI.updateTradeDetail(result.data);
    console.log('✅ 成交明细加载完成');
  }
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
  // 基本数据刷新（3 秒）
  if (StockState.refreshTimer) {
    clearInterval(StockState.refreshTimer);
  }
  
  StockState.refreshTimer = setInterval(() => {
    if (Utils.isTradingTime()) {
      loadAllData();
    }
  }, CONFIG.REFRESH.NORMAL);
  
  // 成交明细刷新（1 秒）
  if (StockState.tradeTimer) {
    clearInterval(StockState.tradeTimer);
  }
  
  StockState.tradeTimer = setInterval(() => {
    if (Utils.isTradingTime()) {
      loadTradeDetail();
    }
  }, CONFIG.REFRESH.FAST);
  
  // 资金流向刷新（1 秒）
  setInterval(async () => {
    if (Utils.isTradingTime()) {
      console.log('💰 刷新资金流向...');
      const result = await API.getCapitalFlow(StockState.code, StockState.market);
      if (result.success && result.data) {
        UI.updateCapitalFlow(result.data);
      }
    }
  }, CONFIG.REFRESH.FAST);
  
  console.log('✅ 自动刷新已启动（1 秒/3 秒）');
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
      if (window.history.length > 1) {
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
  
  // 刷新频率切换
  document.querySelectorAll('.detail-tabs .tab-btn').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.detail-tabs .tab-btn').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const interval = parseInt(tab.dataset.refresh) * 1000;
      StockState.refreshInterval = interval;
      
      if (StockState.tradeTimer) {
        clearInterval(StockState.tradeTimer);
      }
      
      StockState.tradeTimer = setInterval(() => {
        if (Utils.isTradingTime()) {
          loadTradeDetail();
        }
      }, interval);
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
