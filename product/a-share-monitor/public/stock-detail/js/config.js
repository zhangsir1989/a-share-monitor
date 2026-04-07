/**
 * 个股详细页配置
 */

const CONFIG = {
  // MyData API 配置
  MYDATA: {
    BASE_URL: 'https://api.mairuiapi.com',
    LICENCE: 'FB1A859B-6832-4F70-AAA2-38274F23FC90',
    TIMEOUT: 10000,
    RATE_LIMIT: {
      MAX_REQUESTS: 300,  // 每分钟最大请求数
      WINDOW_MS: 60000    // 时间窗口（毫秒）
    }
  },
  
  // 刷新间隔（毫秒）
  REFRESH: {
    FAST: 1000,    // 快速刷新（成交明细、资金流向）
    NORMAL: 3000,  // 正常刷新（基本数据）
    SLOW: 10000    // 慢速刷新（买卖盘口）
  },
  
  // 交易时间配置（北京时间）
  TRADING_TIME: {
    MORNING_START: 9 * 60 + 15,   // 9:15
    MORNING_END: 11 * 60 + 30,    // 11:30
    AFTERNOON_START: 13 * 60,     // 13:00
    AFTERNOON_END: 15 * 60        // 15:00
  },
  
  // 市场代码映射
  MARKET: {
    SH: 'sh',
    SZ: 'sz',
    BJ: 'bj'
  },
  
  // 数据字段映射
  FIELDS: {
    // 基本行情字段
    BASIC: ['f43', 'f44', 'f45', 'f46', 'f47', 'f48', 'f57', 'f58', 'f59', 'f60'],
    // 买卖盘口字段
    ORDER_BOOK: ['f21', 'f22', 'f23', 'f24', 'f25', 'f26', 'f27', 'f28', 'f29', 'f30', 'f31', 'f32', 'f33', 'f34', 'f35', 'f36', 'f37', 'f38', 'f39', 'f40', 'f116'],
    // 基本数据字段
    BASIC_DATA: ['f43', 'f3', 'f114', 'f44', 'f45', 'f46', 'f60', 'f104', 'f105', 'f47', 'f48', 'f84', 'f85', 'f92', 'f109']
  }
};

// 导出到全局
window.CONFIG = CONFIG;
