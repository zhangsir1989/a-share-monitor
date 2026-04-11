/**
 * 工具函数
 */

const Utils = {
  /**
   * 格式化成交量
   */
  formatVolume(vol) {
    if (!vol || vol === 0) return '--';
    if (vol >= 100000000) return (vol / 100000000).toFixed(2) + '亿';
    if (vol >= 10000) return (vol / 10000).toFixed(2) + '万';
    return vol.toLocaleString();
  },
  
  /**
   * 格式化成交额
   */
  formatAmount(amt) {
    if (!amt || amt === 0) return '--';
    if (amt >= 100000000) return (amt / 100000000).toFixed(2) + '亿';
    if (amt >= 10000) return (amt / 10000).toFixed(2) + '万';
    return amt.toFixed(2);
  },
  
  /**
   * 格式化市值
   */
  formatMarketCap(cap) {
    if (!cap || cap === 0) return '--';
    return (cap / 100000000).toFixed(2) + '亿';
  },
  
  /**
   * 安全获取数字，处理 undefined/null
   */
  safeNum(val, defaultValue = 0) {
    if (val === null || val === undefined || isNaN(val)) return defaultValue;
    return Number(val);
  },
  
  /**
   * 安全获取价格
   */
  safePrice(val) {
    if (!val) return '--';
    return (val / 100).toFixed(2);
  },
  
  /**
   * 获取价格涨跌颜色类
   */
  getPriceClass(price, prevClose) {
    if (!prevClose) return '';
    if (price > prevClose) return 'up';
    if (price < prevClose) return 'down';
    return 'flat';
  },
  
  /**
   * 判断是否在交易时间（使用北京时间 UTC+8）
   */
  isTradingTime() {
    const now = new Date();
    // 获取北京时间 (UTC+8)
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const beijingHour = utcHours + 8;
    const beijingMinute = utcMinutes;
    // 处理跨日
    let beijingTime = (beijingHour % 24) * 60 + beijingMinute;
    
    // 北京时间周几
    const utcDay = now.getUTCDay();
    let beijingDay = utcDay;
    if (beijingHour >= 24) {
      beijingDay = (utcDay + 1) % 7;
    }
    
    // 周末不交易
    if (beijingDay === 0 || beijingDay === 6) return false;
    
    const { TRADING_TIME } = CONFIG;
    return (beijingTime >= TRADING_TIME.MORNING_START && beijingTime <= TRADING_TIME.MORNING_END) ||
           (beijingTime >= TRADING_TIME.AFTERNOON_START && beijingTime <= TRADING_TIME.AFTERNOON_END);
  },
  
  /**
   * 防抖函数
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },
  
  /**
   * 节流函数
   */
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },
  
  /**
   * 显示错误提示
   */
  showError(message) {
    alert('❌ ' + message);
    console.error('❌', message);
  },
  
  /**
   * 显示成功提示
   */
  showSuccess(message) {
    alert('✅ ' + message);
  },
  
  /**
   * 根据股票代码判断市场
   */
  getMarketByCode(code) {
    if (!code) return 'sh';
    // 移除市场前缀
    const pureCode = code.replace(/^sh|^sz|^bj|^hk/, '');
    // 港股：5 位数字
    if (pureCode.length === 5 && /^\d{5}$/.test(pureCode)) return 'hk';
    // A 股：6 位数字
    if (pureCode.startsWith('6') || pureCode.startsWith('9') || pureCode.startsWith('5')) return 'sh';
    if (pureCode.startsWith('8') || pureCode.startsWith('4')) return 'bj';
    return 'sz';
  }
};

// 导出到全局
window.Utils = Utils;
