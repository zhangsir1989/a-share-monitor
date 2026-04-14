/**
 * 分时成交明细模块
 * 实时获取个股分笔成交数据，3 秒刷新一次
 * 独立模块，不影响其他功能
 */

const TradeDetail = {
  // 配置
  config: {
    refreshInterval: 3000,  // 3 秒刷新
    maxRecords: 100,        // 最多显示 100 条
    excludeCallAuction: true // 排除集合竞价（9:15-9:25, 14:57-15:00）
  },

  // 状态
  state: {
    timer: null,
    isRunning: false,
    lastUpdate: null,
    trades: []
  },

  /**
   * 初始化分时成交模块
   * @param {string} code - 股票代码
   * @param {string} market - 市场
   */
  init(code, market) {
    console.log('📊 [TradeDetail] 初始化分时成交模块:', code, market);
    
    this.state.code = code;
    this.state.market = market;
    
    // 绑定 DOM 元素
    this.bindElements();
    
    // 首次加载
    this.loadTrades();
    
    // 启动定时刷新
    this.startAutoRefresh();
    
    console.log('✅ [TradeDetail] 初始化完成');
  },

  /**
   * 绑定 DOM 元素
   */
  bindElements() {
    this.container = document.getElementById('trade-detail-container');
    this.headerEl = document.getElementById('trade-detail-header');
    this.listEl = document.getElementById('trade-detail-list');
    this.countEl = document.getElementById('trade-detail-count');
    this.lastTimeEl = document.getElementById('trade-detail-last-time');
    this.loadingEl = document.getElementById('trade-detail-loading');
    
    if (!this.container) {
      console.error('❌ [TradeDetail] 未找到容器元素');
      return;
    }
  },

  /**
   * 启动自动刷新
   */
  startAutoRefresh() {
    if (this.state.timer) {
      clearInterval(this.state.timer);
    }
    
    this.state.isRunning = true;
    this.state.timer = setInterval(() => {
      if (this.state.isRunning) {
        this.loadTrades();
      }
    }, this.config.refreshInterval);
    
    console.log('⏱️ [TradeDetail] 自动刷新已启动（3 秒/次）');
  },

  /**
   * 停止自动刷新
   */
  stopAutoRefresh() {
    if (this.state.timer) {
      clearInterval(this.state.timer);
      this.state.timer = null;
    }
    this.state.isRunning = false;
    console.log('⏸️ [TradeDetail] 自动刷新已停止');
  },

  /**
   * 加载成交数据
   */
  async loadTrades() {
    if (!this.state.code) return;
    
    try {
      const url = `/api/stock/${this.state.code}/tick-trades?limit=${this.config.maxRecords}`;
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.success && Array.isArray(result.data)) {
        this.state.trades = result.data;
        this.state.lastUpdate = new Date();
        this.render();
        console.log(`✅ [TradeDetail] 加载 ${result.data.length} 条成交数据`);
      } else {
        console.warn('⚠️ [TradeDetail] 加载失败:', result.message);
        this.showError(result.message || '加载失败');
      }
    } catch (error) {
      console.error('❌ [TradeDetail] 加载错误:', error);
      this.showError('网络错误');
    }
  },

  /**
   * 渲染成交列表
   */
  render() {
    if (!this.listEl) return;
    
    const trades = this.state.trades.slice(0, this.config.maxRecords);
    
    // 更新计数
    if (this.countEl) {
      this.countEl.textContent = trades.length;
    }
    
    // 更新时间
    if (this.lastTimeEl && this.state.lastUpdate) {
      const time = this.state.lastUpdate.toLocaleTimeString('zh-CN', { hour12: false });
      this.lastTimeEl.textContent = time;
    }
    
    // 隐藏加载提示
    if (this.loadingEl) {
      this.loadingEl.style.display = 'none';
    }
    
    // 渲染列表
    if (trades.length === 0) {
      this.listEl.innerHTML = '<div class="trade-empty">暂无成交数据</div>';
      return;
    }
    
    const html = trades.map(trade => {
      const time = trade.time || '';
      const price = trade.price || 0;
      const volume = trade.volume || 0;
      const amount = trade.amount || 0;
      const direction = trade.direction || 'neutral'; // 'buy', 'sell', 'neutral'
      const type = trade.orderType || 'small'; // superLarge, large, medium, small
      
      // 方向标识
      let directionIcon = '⚪';
      let directionClass = 'neutral';
      if (direction === 'buy') {
        directionIcon = '🟢';
        directionClass = 'buy';
      } else if (direction === 'sell') {
        directionIcon = '🔴';
        directionClass = 'sell';
      }
      
      // 订单类型标识
      let typeLabel = '';
      let typeClass = '';
      if (type === 'superLarge') {
        typeLabel = '超';
        typeClass = 'type-super';
      } else if (type === 'large') {
        typeLabel = '大';
        typeClass = 'type-large';
      } else if (type === 'medium') {
        typeLabel = '中';
        typeClass = 'type-medium';
      }
      
      // 格式化金额
      const amountStr = this.formatAmount(amount);
      const volumeStr = this.formatVolume(volume);
      
      return `
        <div class="trade-item ${directionClass} ${typeClass}">
          <div class="trade-time">${time}</div>
          <div class="trade-price">${price.toFixed(2)}</div>
          <div class="trade-volume">${volumeStr}</div>
          <div class="trade-amount">${amountStr}</div>
          <div class="trade-direction">
            <span class="direction-icon">${directionIcon}</span>
            ${typeLabel ? `<span class="type-label">${typeLabel}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
    
    this.listEl.innerHTML = html;
  },

  /**
   * 格式化成交量
   */
  formatVolume(volume) {
    if (volume >= 10000) {
      return (volume / 10000).toFixed(1) + '万手';
    }
    return (volume / 100).toFixed(0) + '手';
  },

  /**
   * 格式化成交额
   */
  formatAmount(amount) {
    if (amount >= 100000000) {
      return (amount / 100000000).toFixed(2) + '亿';
    } else if (amount >= 10000) {
      return (amount / 10000).toFixed(1) + '万';
    }
    return amount.toFixed(0);
  },

  /**
   * 显示错误
   */
  showError(message) {
    if (this.loadingEl) {
      this.loadingEl.style.display = 'none';
    }
    if (this.listEl) {
      this.listEl.innerHTML = `<div class="trade-error">⚠️ ${message}</div>`;
    }
  },

  /**
   * 销毁模块
   */
  destroy() {
    this.stopAutoRefresh();
    this.state.trades = [];
    this.state.code = null;
    this.state.market = null;
    console.log('🗑️ [TradeDetail] 模块已销毁');
  }
};

// 导出模块
if (typeof window !== 'undefined') {
  window.TradeDetail = TradeDetail;
}
