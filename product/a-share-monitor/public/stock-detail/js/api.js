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
   * 获取成交明细（东方财富 API）
   * count: 获取条数，默认 5000 条（全部数据）
   */
  async getTradeDetail(code, market, count = 5000) {
    try {
      const secid = market === 'sh' ? `1.${code}` : `0.${code}`;
      const url = `https://push2.eastmoney.com/api/qt/stock/details/get?secid=${secid}&pos=-1&cnt=${count}&fltt=2&invt=2&fields=f19,f20,f17,f16,f21`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://quote.eastmoney.com/'
        },
        timeout: 10000
      });
      
      const result = await response.json();
      
      if (result.rc === 0 && result.data && result.data.details) {
        return { success: true, data: result.data.details };
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
   * 获取资金流向（通过逐笔成交数据计算）
   * 使用东方财富逐笔成交接口
   * 
   * 资金流向计算规则（按流通股占比）：
   * - 小单：< 0.001%
   * - 中单：0.001% ~ 0.005%
   * - 大单：0.005% ~ 0.02%
   * - 特大单：> 0.02%
   * 
   * 注意：排除集合竞价订单（开盘 9:15-9:25 和收盘 14:57-15:00）
   */
  async getCapitalFlow(code, market) {
    try {
      console.log('💰 开始获取逐笔成交数据...');
      
      // 先获取股票基本信息（获取流通市值）
      const basicResult = await this.getStockBasic(code, market);
      let floatMarketCap = 0;  // 流通市值（元）
      
      if (basicResult.success && basicResult.data) {
        // 后端返回的是亿元，转换为元
        floatMarketCap = (basicResult.data.floatMarketCap || 0) * 100000000;
      }
      
      console.log('📊 流通市值:', floatMarketCap, '元');
      
      // 获取全部逐笔成交数据（5000 条）
      const tradeResult = await this.getTradeDetail(code, market, 5000);
      
      console.log('📊 逐笔成交响应:', tradeResult);
      
      if (!tradeResult.success || !tradeResult.data || tradeResult.data.length === 0) {
        console.warn('⚠️ 无成交数据');
        return { success: false, message: '无成交数据' };
      }
      
      console.log(`📊 获取到 ${tradeResult.data.length} 条成交记录`);
      
      // 初始化资金统计（单位：元）
      const capital = {
        superLarge: { inflow: 0, outflow: 0, count: 0 },
        large: { inflow: 0, outflow: 0, count: 0 },
        medium: { inflow: 0, outflow: 0, count: 0 },
        small: { inflow: 0, outflow: 0, count: 0 }
      };
      
      let validCount = 0;
      let neutralCount = 0;
      let callAuctionCount = 0;
      
      // 遍历逐笔成交数据，计算资金流向
      tradeResult.data.forEach((trade, index) => {
        const tradeTime = trade.f19 || '';
        
        // 排除集合竞价
        if (this.isCallAuctionTime(tradeTime)) {
          callAuctionCount++;
          return;
        }
        
        validCount++;
        
        // 获取成交量和价格
        const volume = trade.f17 || 0;  // 股
        const price = trade.f20 || 0;    // 元（已除以 100）
        const amount = volume * price;   // 元
        
        // 判断订单类型（按流通股占比）
        const orderType = this.getOrderTypeByFloatCap(amount, floatMarketCap);
        
        // 判断买卖方向（f21: 0=中性，1=买入，2=卖出）
        const direction = trade.f21 || 0;
        
        // 统计资金
        if (direction === 1) {
          capital[orderType].inflow += amount;
          capital[orderType].count++;
        } else if (direction === 2) {
          capital[orderType].outflow += amount;
          capital[orderType].count++;
        } else {
          neutralCount++;
        }
      });
      
      console.log(`✅ 有效订单：${validCount}，中性订单：${neutralCount}，集合竞价：${callAuctionCount}`);
      console.log('📊 资金统计（元）:', capital);
      
      // 转换为亿元单位
      const toYi = (val) => val / 100000000;
      
      const result = {
        success: true,
        data: {
          superLarge: {
            inflow: toYi(capital.superLarge.inflow),
            outflow: toYi(capital.superLarge.outflow),
            net: toYi(capital.superLarge.inflow - capital.superLarge.outflow),
            count: capital.superLarge.count
          },
          large: {
            inflow: toYi(capital.large.inflow),
            outflow: toYi(capital.large.outflow),
            net: toYi(capital.large.inflow - capital.large.outflow),
            count: capital.large.count
          },
          medium: {
            inflow: toYi(capital.medium.inflow),
            outflow: toYi(capital.medium.outflow),
            net: toYi(capital.medium.inflow - capital.medium.outflow),
            count: capital.medium.count
          },
          small: {
            inflow: toYi(capital.small.inflow),
            outflow: toYi(capital.small.outflow),
            net: toYi(capital.small.inflow - capital.small.outflow),
            count: capital.small.count
          },
          mainInflow: toYi(capital.superLarge.inflow + capital.large.inflow),
          mainOutflow: toYi(capital.superLarge.outflow + capital.large.outflow),
          mainNetflow: toYi(capital.superLarge.inflow + capital.large.inflow - capital.superLarge.outflow - capital.large.outflow),
          totalVolume: validCount,
          neutralVolume: neutralCount
        }
      };
      
      console.log('💰 资金流向计算完成（亿元）:', result.data);
      return result;
      
    } catch (error) {
      console.error('❌ 计算资金流向失败:', error);
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
  }
};

window.API = API;
