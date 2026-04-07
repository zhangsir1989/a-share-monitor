/**
 * UI 操作模块
 */

const UI = {
  /**
   * 更新股票基本信息
   */
  updateBasicInfo(data) {
    const { Utils } = window;
    
    console.log('📊 更新基本信息，数据:', data);
    
    // 股票名称和代码
    const nameEl = document.getElementById('stock-name');
    const codeEl = document.getElementById('stock-code');
    const marketEl = document.getElementById('stock-market');
    
    if (nameEl) nameEl.textContent = data.name || '--';
    if (codeEl) codeEl.textContent = (data.code || '').replace(/^sz|^sh/i, '') || '--';
    if (marketEl) marketEl.textContent = (data.code || '').startsWith('sh') ? '沪市' : ((data.code || '').startsWith('bj') ? '北交所' : '深市');
    
    // 当前价格 - 确保是数字
    const price = Utils.safeNum(data.price, 0);
    const priceEl = document.getElementById('current-price');
    if (priceEl) {
      priceEl.textContent = price.toFixed(2);
      priceEl.className = 'current-price ' + (price >= Utils.safeNum(data.prevClose, 0) ? 'up' : 'down');
    }
    
    // 涨跌额和涨跌幅 - 确保是数字
    const change = Utils.safeNum(data.change, 0);
    const changePct = Utils.safeNum(data.changePercent, 0);
    
    const changeValueEl = document.querySelector('#price-change .change-value');
    const changePercentEl = document.querySelector('#price-change .change-percent');
    
    if (changeValueEl) {
      changeValueEl.textContent = (change >= 0 ? '+' : '') + change.toFixed(2);
      changeValueEl.className = 'change-value ' + (change >= 0 ? 'up' : 'down');
    }
    
    if (changePercentEl) {
      changePercentEl.textContent = (changePct >= 0 ? '+' : '') + changePct.toFixed(2) + '%';
      changePercentEl.className = 'change-percent ' + (changePct >= 0 ? 'up' : 'down');
    }
  },
  
  /**
   * 更新买卖盘口
   */
  updateOrderBook(data) {
    const { Utils } = window;
    
    // 卖盘（f21-f30）
    const sellPrices = [data.f29, data.f27, data.f25, data.f23, data.f21];
    const sellVolumes = [data.f30, data.f28, data.f26, data.f24, data.f22];
    
    for (let i = 0; i < 5; i++) {
      const priceEl = document.getElementById(`sell-${5-i}-price`);
      const volEl = document.getElementById(`sell-${5-i}-vol`);
      
      if (priceEl) {
        const price = sellPrices[i] ? (sellPrices[i] / 100).toFixed(2) : '--';
        priceEl.textContent = price;
        priceEl.className = 'order-price sell ' + (price !== '--' ? 'up' : '');
      }
      
      if (volEl) {
        volEl.textContent = sellVolumes[i] ? Utils.formatVolume(sellVolumes[i]) : '--';
      }
    }
    
    // 买盘（f31-f40）
    const buyPrices = [data.f31, data.f33, data.f35, data.f37, data.f39];
    const buyVolumes = [data.f32, data.f34, data.f36, data.f38, data.f40];
    
    for (let i = 0; i < 5; i++) {
      const priceEl = document.getElementById(`buy-${i+1}-price`);
      const volEl = document.getElementById(`buy-${i+1}-vol`);
      
      if (priceEl) {
        const price = buyPrices[i] ? (buyPrices[i] / 100).toFixed(2) : '--';
        priceEl.textContent = price;
        priceEl.className = 'order-price buy ' + (price !== '--' ? 'down' : '');
      }
      
      if (volEl) {
        volEl.textContent = buyVolumes[i] ? Utils.formatVolume(buyVolumes[i]) : '--';
      }
    }
    
    // 委比
    const ratioEl = document.getElementById('order-ratio');
    if (ratioEl) {
      const ratio = data.f116 || 0;
      ratioEl.textContent = `委比：${ratio.toFixed(2)}%`;
      ratioEl.style.color = ratio >= 0 ? 'var(--down-color)' : 'var(--up-color)';
    }
  },
  
  /**
   * 更新基本数据
   */
  updateBasicData(data) {
    const { Utils } = window;
    
    console.log('📊 更新基本数据，数据:', data);
    
    // 安全获取数字并格式化
    const setNum = (id, value, isPercent = false, isChange = false) => {
      const el = document.getElementById(id);
      if (!el) return;
      
      const num = Utils.safeNum(value, 0);
      
      if (isChange) {
        el.textContent = (num >= 0 ? '+' : '') + num.toFixed(2);
        el.className = 'basic-value ' + (num >= 0 ? 'up' : 'down');
      } else if (isPercent) {
        el.textContent = (num >= 0 ? '+' : '') + num.toFixed(2) + '%';
        el.className = 'basic-value ' + (num >= 0 ? 'up' : 'down');
      } else {
        el.textContent = num.toFixed(2);
      }
    };
    
    // 设置各个字段
    setNum('basic-latest', data.price);
    setNum('basic-change', data.change, false, true);
    setNum('basic-change-pct', data.changePercent, true, true);
    setNum('basic-high', data.high);
    setNum('basic-low', data.low);
    setNum('basic-open', data.open);
    setNum('basic-prev-close', data.prevClose);
    setNum('basic-volume-ratio', data.volumeRatio);
    setNum('basic-turnover', data.turnoverRate, true);
    
    // 成交量和成交额
    const volumeEl = document.getElementById('basic-volume');
    if (volumeEl) volumeEl.textContent = Utils.formatVolume(Utils.safeNum(data.volume, 0));
    
    const amountEl = document.getElementById('basic-amount');
    if (amountEl) amountEl.textContent = Utils.formatAmount(Utils.safeNum(data.amount, 0) * 10000);
    
    const marketCapEl = document.getElementById('basic-market-cap');
    if (marketCapEl) marketCapEl.textContent = Utils.formatAmount(Utils.safeNum(data.totalMarketCap, 0) * 100000000);
    
    const floatCapEl = document.getElementById('basic-float-cap');
    if (floatCapEl) floatCapEl.textContent = Utils.formatAmount(Utils.safeNum(data.floatMarketCap, 0) * 100000000);
    
    // 市盈率
    const peStaticEl = document.getElementById('basic-pe-static');
    if (peStaticEl) peStaticEl.textContent = Utils.safeNum(data.pe, 0).toFixed(2);
    
    const peTtmEl = document.getElementById('basic-pe-ttm');
    if (peTtmEl) peTtmEl.textContent = Utils.safeNum(data.pe, 0).toFixed(2);
  },
  
  /**
   * 更新资金流向（同花顺风格）
   */
  updateCapitalFlow(data) {
    const { Utils } = window;
    
    if (!data || !data.superLarge) {
      console.warn('⚠️ 资金流向数据为空');
      return;
    }
    
    // 主力资金（单位：万元）
    const mainInflow = data.mainInflow || 0;
    const mainOutflow = data.mainOutflow || 0;
    const mainNetflow = data.mainNetflow || 0;
    
    const inflowEl = document.getElementById('main-inflow');
    const outflowEl = document.getElementById('main-outflow');
    const netflowEl = document.getElementById('main-netflow');
    const costEl = document.getElementById('main-cost');
    
    if (inflowEl) inflowEl.textContent = (mainInflow >= 0 ? '+' : '') + mainInflow.toFixed(4);
    if (outflowEl) outflowEl.textContent = mainOutflow.toFixed(4);
    if (netflowEl) {
      netflowEl.textContent = (mainNetflow >= 0 ? '+' : '') + mainNetflow.toFixed(4);
      netflowEl.className = 'capital-value net ' + (mainNetflow >= 0 ? 'inflow' : 'outflow');
    }
    if (costEl) {
      // 计算主力持仓成本
      const totalAmount = (mainInflow + mainOutflow) * 10000; // 转回元
      const totalVolume = data.superLarge.inflow + data.superLarge.outflow + data.large.inflow + data.large.outflow;
      const avgCost = totalVolume > 0 ? (totalAmount / totalVolume / 100).toFixed(2) : '--';
      costEl.textContent = avgCost !== '--' ? avgCost + '元' : '计算中...';
    }
    
    // 净订单分布
    this.updateCapitalBars(data);
    
    // 更新饼图
    this.updateCapitalPie(data);
  },
  
  /**
   * 更新资金条形图
   */
  updateCapitalBars(data) {
    const types = ['super', 'big', 'medium', 'small'];
    const dataKeys = ['superLarge', 'large', 'medium', 'small'];
    
    // 找出最大绝对值用于计算百分比
    const maxVal = Math.max(
      Math.abs(data.superLarge?.net || 0),
      Math.abs(data.large?.net || 0),
      Math.abs(data.medium?.net || 0),
      Math.abs(data.small?.net || 0),
      1  // 避免除零
    );
    
    types.forEach((type, index) => {
      const order = data[dataKeys[index]];
      const barIn = document.getElementById(`bar-${type}-in`);
      const barOut = document.getElementById(`bar-${type}-out`);
      const valEl = document.getElementById(`val-${type}`);
      
      if (barIn && barOut && valEl && order) {
        const net = order.net || 0;
        const inflow = order.inflow || 0;
        const outflow = order.outflow || 0;
        
        // 计算净流入/流出百分比
        const pct = maxVal > 0 ? (Math.abs(net) / maxVal * 100) : 0;
        
        if (net >= 0) {
          // 净流入：显示流入条
          barIn.style.width = pct + '%';
          barOut.style.width = '0%';
          valEl.textContent = '+' + net.toFixed(4);
          valEl.className = 'bar-value positive';
        } else {
          // 净流出：显示流出条
          barIn.style.width = '0%';
          barOut.style.width = pct + '%';
          valEl.textContent = net.toFixed(4);
          valEl.className = 'bar-value negative';
        }
      }
    });
  },
  
  /**
   * 更新资金占比饼图
   */
  updateCapitalPie(data) {
    const pieEl = document.getElementById('capital-pie');
    if (!pieEl) return;
    
    // 计算总成交额
    const total = 
      (data.superLarge?.inflow || 0) + (data.superLarge?.outflow || 0) +
      (data.large?.inflow || 0) + (data.large?.outflow || 0) +
      (data.medium?.inflow || 0) + (data.medium?.outflow || 0) +
      (data.small?.inflow || 0) + (data.small?.outflow || 0);
    
    if (total <= 0) {
      pieEl.style.background = 'conic-gradient(var(--bg-primary) 0deg 360deg)';
      return;
    }
    
    // 计算各部分占比（角度）
    const superLargePct = ((data.superLarge?.inflow || 0) + (data.superLarge?.outflow || 0)) / total * 100;
    const largePct = ((data.large?.inflow || 0) + (data.large?.outflow || 0)) / total * 100;
    const mediumPct = ((data.medium?.inflow || 0) + (data.medium?.outflow || 0)) / total * 100;
    const smallPct = ((data.small?.inflow || 0) + (data.small?.outflow || 0)) / total * 100;
    
    // 计算累计角度
    let currentAngle = 0;
    const colors = [];
    
    // 特大单流入
    const superInAngle = (data.superLarge?.inflow || 0) / total * 360;
    if (superInAngle > 0) {
      colors.push(`var(--down-color) ${currentAngle}deg ${currentAngle + superInAngle}deg`);
      currentAngle += superInAngle;
    }
    
    // 特大单流出
    const superOutAngle = (data.superLarge?.outflow || 0) / total * 360;
    if (superOutAngle > 0) {
      colors.push(`#c0392b ${currentAngle}deg ${currentAngle + superOutAngle}deg`);
      currentAngle += superOutAngle;
    }
    
    // 大单流入
    const largeInAngle = (data.large?.inflow || 0) / total * 360;
    if (largeInAngle > 0) {
      colors.push(`#e74c3c ${currentAngle}deg ${currentAngle + largeInAngle}deg`);
      currentAngle += largeInAngle;
    }
    
    // 大单流出
    const largeOutAngle = (data.large?.outflow || 0) / total * 360;
    if (largeOutAngle > 0) {
      colors.push(`#922b21 ${currentAngle}deg ${currentAngle + largeOutAngle}deg`);
      currentAngle += largeOutAngle;
    }
    
    // 中单流入
    const mediumInAngle = (data.medium?.inflow || 0) / total * 360;
    if (mediumInAngle > 0) {
      colors.push(`#145a32 ${currentAngle}deg ${currentAngle + mediumInAngle}deg`);
      currentAngle += mediumInAngle;
    }
    
    // 中单流出
    const mediumOutAngle = (data.medium?.outflow || 0) / total * 360;
    if (mediumOutAngle > 0) {
      colors.push(`#1e8449 ${currentAngle}deg ${currentAngle + mediumOutAngle}deg`);
      currentAngle += mediumOutAngle;
    }
    
    // 小单流入
    const smallInAngle = (data.small?.inflow || 0) / total * 360;
    if (smallInAngle > 0) {
      colors.push(`#27ae60 ${currentAngle}deg ${currentAngle + smallInAngle}deg`);
      currentAngle += smallInAngle;
    }
    
    // 小单流出
    const smallOutAngle = (data.small?.outflow || 0) / total * 360;
    if (smallOutAngle > 0) {
      colors.push(`#2ecc71 ${currentAngle}deg ${currentAngle + smallOutAngle}deg`);
      currentAngle += smallOutAngle;
    }
    
    pieEl.style.background = `conic-gradient(${colors.join(', ')})`;
  },
  
  /**
   * 更新成交明细
   */
  updateTradeDetail(details) {
    const { Utils } = window;
    const tbody = document.getElementById('trade-detail-body');
    
    if (!tbody) return;
    
    if (!details || details.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading">暂无数据</td></tr>';
      return;
    }
    
    const html = details.map(trade => {
      const price = trade.f20 ? (trade.f20 / 100).toFixed(2) : '--';
      const volume = trade.f17 ? Utils.formatVolume(trade.f17) : '--';
      const amount = trade.f16 ? Utils.formatAmount(trade.f16) : '--';
      const nature = trade.f21 || 0;
      const time = trade.f19 || '--';
      
      const natureText = nature === 1 ? 'B 买' : (nature === 2 ? 'S 卖' : 'N 中性');
      const natureClass = nature === 1 ? 'buy' : (nature === 2 ? 'sell' : 'neutral');
      
      return `<tr>
        <td>${time}</td>
        <td class="price">${price}</td>
        <td class="volume">${volume}</td>
        <td class="volume">${amount}</td>
        <td class="nature ${natureClass}">${natureText}</td>
      </tr>`;
    }).join('');
    
    tbody.innerHTML = html;
  },
  
  /**
   * 显示加载状态
   */
  showLoading(elementId, message = '加载中...') {
    const el = document.getElementById(elementId);
    if (el) {
      el.innerHTML = `<div class="loading">${message}</div>`;
    }
  },
  
  /**
   * 显示错误状态
   */
  showError(elementId, message = '加载失败') {
    const el = document.getElementById(elementId);
    if (el) {
      el.innerHTML = `<div class="error">${message}</div>`;
    }
  }
};

// 导出到全局
window.UI = UI;
