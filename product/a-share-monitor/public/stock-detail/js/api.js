/**
 * API 调用模块
 * 使用 MyData API 和后端 API
 */

const API = {
  /**
   * 获取股票基本信息（使用后端 API，避免跨域）
   */
  async getStockBasic(code, market) {
    try {
      const response = await fetch(`/api/stock/${code}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        return {
          success: true,
          data: result.data
        };
      }
      
      return { success: false, message: result.message || '获取股票数据失败' };
    } catch (error) {
      console.error('获取股票基本信息失败:', error);
      return { success: false, message: '网络错误' };
    }
  },
  
  /**
   * 获取买卖五档盘口（东方财富 API）
   */
  async getOrderBook(code, market) {
    try {
      const secid = market === 'sh' ? `1.${code}` : `0.${code}`;
      const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f21,f22,f23,f24,f25,f26,f27,f28,f29,f30,f31,f32,f33,f34,f35,f36,f37,f38,f39,f40,f116`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://quote.eastmoney.com/'
        }
      });
      
      const result = await response.json();
      
      if (result.rc === 0 && result.data) {
        return { success: true, data: result.data };
      }
      
      return { success: false, message: '获取盘口数据失败' };
    } catch (error) {
      console.error('获取买卖盘口失败:', error);
      return { success: false, message: '网络错误' };
    }
  },
  
  /**
   * 获取成交明细（后端代理）
   */
  async getTradeDetail(code, market, count = 100) {
    try {
      const response = await fetch(`/api/stock/${code}/trades?count=${count}`);
      const result = await response.json();
      
      if (result.success) {
        return { success: true, data: result.data };
      }
      
      return { success: true, data: [] };
    } catch (error) {
      console.error('获取成交明细失败:', error);
      return { success: false, message: '网络错误' };
    }
  },
  
  /**
   * 获取 MyData 股票列表（用于搜索）
   */
  async getStockList() {
    try {
      const { MYDATA } = CONFIG;
      const url = `${MYDATA.BASE_URL}/hslt/list/${MYDATA.LICENCE}`;
      
      const response = await fetch(url, { timeout: MYDATA.TIMEOUT });
      const result = await response.json();
      
      if (Array.isArray(result)) {
        return { success: true, data: result };
      }
      
      return { success: false, message: '获取股票列表失败' };
    } catch (error) {
      console.error('获取股票列表失败:', error);
      return { success: false, message: '网络错误' };
    }
  },
  
  /**
   * 搜索股票（后端 API）
   */
  async searchStock(query) {
    try {
      const response = await fetch(`/api/stock/search?q=${encodeURIComponent(query)}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        return { success: true, data: result.data };
      }
      
      return { success: false, message: result.message || '搜索失败' };
    } catch (error) {
      console.error('搜索股票失败:', error);
      return { success: false, message: '网络错误' };
    }
  },
  
  /**
   * 添加到自选股
   */
  async addToCustom(code, market) {
    try {
      const response = await fetch('/api/custom-stocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock_code: code,
          stock_market: market
        })
      });
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('添加到自选股失败:', error);
      return { success: false, message: '网络错误' };
    }
  },
  
  /**
   * 获取资金流向（后端计算）
   */
  async getCapitalFlow(code, market) {
    try {
      console.log('💰 请求资金流向 API...');
      const response = await fetch(`/api/stock/${code}/capital-flow`);
      const result = await response.json();
      
      console.log('💰 资金流向结果:', result);
      return result;
    } catch (error) {
      console.error('❌ 获取资金流向失败:', error);
      return { success: false, message: error.message };
    }
  },
  
  /**
   * 判断是否为集合竞价时间
   * 开盘集合竞价：9:15-9:25
   * 收盘集合竞价：14:57-15:00（深市）
   */
  isCallAuctionTime(timeStr) {
    if (!timeStr) return true;
    
    const match = timeStr.match(/(\d{1,2}):(\d{2}):(\d{2})/);
    if (!match) return true;
    
    const hour = parseInt(match[1]);
    const minute = parseInt(match[2]);
    
    // 开盘集合竞价：9:15-9:25
    if (hour === 9 && minute >= 15 && minute <= 25) {
      return true;
    }
    
    // 收盘集合竞价：14:57-15:00
    if (hour === 14 && minute >= 57) {
      return true;
    }
    
    return false;
  },
  
  /**
   * 判断订单类型（按流通股占比）
   * @param {number} amount - 成交额（元）
   * @param {number} floatMarketCap - 流通市值（元）
   * @returns {string} 订单类型：superLarge, large, medium, small
   * 
   * 阈值标准：
   * - 小单：< 0.001%
   * - 中单：0.001% ~ 0.005%
   * - 大单：0.005% ~ 0.02%
   * - 特大单：> 0.02%
   */
  getOrderTypeByFloatCap(amount, floatMarketCap) {
    if (floatMarketCap <= 0) {
      // 如果没有流通市值数据，降级到固定金额判断
      return this.getOrderTypeByAmount(amount);
    }
    
    // 计算成交额占流通市值的比例
    const ratio = (amount / floatMarketCap) * 100;  // 百分比
    
    // 特大单：> 0.02%
    if (ratio > 0.02) {
      return 'superLarge';
    }
    
    // 大单：0.005% ~ 0.02%
    if (ratio > 0.005) {
      return 'large';
    }
    
    // 中单：0.001% ~ 0.005%
    if (ratio >= 0.001) {
      return 'medium';
    }
    
    // 小单：< 0.001%
    return 'small';
  },
  
  /**
   * 判断订单类型（按固定金额，降级方案）
   */
  getOrderTypeByAmount(amount) {
    const amountInWan = amount / 10000;  // 万元
    
    if (amountInWan >= 100) {
      return 'superLarge';
    }
    
    if (amountInWan >= 20) {
      return 'large';
    }
    
    if (amountInWan >= 5) {
      return 'medium';
    }
    
    return 'small';
  },
  
  /**
   * 获取逐笔成交数据（带订单类型分类）
   */
  async getTickTrades(code, limit = 10, all = false) {
    try {
      const url = `/api/stock/${code}/tick-trades?limit=${limit}&all=${all}`;
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.success) {
        return { success: true, data: result.data, total: result.total };
      }
      
      return { success: false, message: result.message || '获取逐笔成交失败' };
    } catch (error) {
      console.error('获取逐笔成交失败:', error);
      return { success: false, message: '网络错误' };
    }
  }
};

window.API = API;
