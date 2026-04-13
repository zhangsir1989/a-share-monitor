function startAutoRefresh() {
  // 清除所有定时器
  stopAutoRefresh();
  
  console.log('🔄 启动自动刷新...');
  console.log('  当前时间:', new Date().toLocaleTimeString('zh-CN'));
  console.log('  是否交易时间:', Utils.isTradingTime());
  
  // 分时图刷新（500ms）
  StockState.intradayTimer = setInterval(() => {
    if (!StockState.refreshPaused && Utils.isTradingTime()) {
      loadIntraday();
    }
  }, 500);
  console.log('✅ 分时图刷新已启动（500ms）');
  
  // 五档盘口刷新（500ms）
  StockState.tradeTimer = setInterval(() => {
    if (!StockState.refreshPaused && Utils.isTradingTime()) {
      loadOrderBook();
    }
  }, 500);
  console.log('✅ 五档盘口刷新已启动（500ms）');
  
  // 成交明细刷新（1 秒）
  setInterval(() => {
    if (!StockState.refreshPaused && Utils.isTradingTime()) {
      loadTradeDetail();
    }
  }, 1000);
  console.log('✅ 成交明细刷新已启动（1000ms）');
  
  // 资金流向刷新（1 秒）
  setInterval(() => {
    if (!StockState.refreshPaused && Utils.isTradingTime()) {
      loadCapitalFlow();
    }
  }, 1000);
  console.log('✅ 资金流向刷新已启动（1000ms）');
  
  // 基本数据刷新（1 秒）
  StockState.refreshTimer = setInterval(() => {
    if (!StockState.refreshPaused && Utils.isTradingTime()) {
      loadBasicInfo();
    }
  }, 1000);
  console.log('✅ 基本数据刷新已启动（1000ms）');
  
  updateRefreshStatusUI();
}
