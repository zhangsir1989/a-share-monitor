/**
 * A 股分时图组件
 * 严格遵守 A 股规则：
 * - 0.00% 基准线 = 昨收价（不是开盘价）
 * - 涨跌幅限制根据板块判断（主板 10%、创业板/科创板 20%、ST 5%）
 * - 红涨绿跌，量价匹配
 */

class IntradayChart {
  constructor(canvasId, containerId) {
    this.canvas = document.getElementById(canvasId);
    this.container = document.getElementById(containerId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.data = null;
    this.isIndex = false;
    this.prevClose = 0;  // 昨收价（0.00% 基准）
    this.openPrice = 0;
    this.highPrice = 0;
    this.lowPrice = 0;
    this.limitUp = 0;
    this.limitDown = 0;
    this.priceDecimals = 2;
  }

  // 初始化 canvas 尺寸
  initCanvas() {
    if (!this.canvas || !this.container) return false;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = this.container.getBoundingClientRect();
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.scale(dpr, dpr);
    
    this.width = rect.width;
    this.height = rect.height;
    return true;
  }

  // 清空画布
  clear() {
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  // 判断股票类型和涨跌幅限制
  getStockType(code) {
    if (!code) return { type: 'unknown', limit: 0.1 };
    
    // 指数
    if (code.startsWith('sh000') || code.startsWith('sz399')) {
      return { type: 'index', limit: 0 };
    }
    
    // 去掉市场前缀
    const stockCode = code.replace(/^(sh|sz)/, '');
    
    // ST/*ST 股票 - 5%
    if (stockCode.startsWith('ST')) {
      return { type: 'st', limit: 0.05, decimals: 2 };
    }
    
    // 创业板 (300/301) - 20%
    if (stockCode.startsWith('300') || stockCode.startsWith('301')) {
      return { type: 'gem', limit: 0.2, decimals: 2 };
    }
    
    // 科创板 (688) - 20%
    if (stockCode.startsWith('688')) {
      return { type: 'star', limit: 0.2, decimals: 3 };
    }
    
    // 北交所 (8/4/9 开头) - 30%
    if (stockCode.startsWith('8') || stockCode.startsWith('4') || stockCode.startsWith('9')) {
      return { type: 'bse', limit: 0.3, decimals: 2 };
    }
    
    // 主板 (600/601/603/605/000/001/002/003) - 10%
    if (stockCode.startsWith('6') || stockCode.startsWith('0')) {
      return { type: 'main', limit: 0.1, decimals: 2 };
    }
    
    // 默认 10%
    return { type: 'unknown', limit: 0.1, decimals: 2 };
  }

  // 设置数据
  setData(data, isIndex = false, stockCode = '', meta = null) {
    this.data = data;
    this.isIndex = isIndex;
    
    // 优先使用 meta 数据（来自 API），其次使用 data[0]
    if (meta && meta.prevClose) {
      this.prevClose = meta.prevClose;
      this.openPrice = meta.open || this.prevClose;
      this.highPrice = meta.high || 0;
      this.lowPrice = meta.low || 0;
    } else if (data && data.length > 0) {
      this.prevClose = data[0].prevClose || data[0].price || 0;
      this.openPrice = data[0].open || this.prevClose;
      this.highPrice = data.reduce((max, d) => Math.max(max, d.price || 0), 0);
      this.lowPrice = data.reduce((min, d) => Math.min(min, d.price || Infinity), Infinity);
    }
    
    if (this.prevClose > 0) {
      // 获取股票类型和涨跌幅限制
      const stockType = this.getStockType(stockCode);
      const limitPercent = stockType.limit;
      this.priceDecimals = stockType.decimals || 2;
      
      // 计算涨跌停价
      if (limitPercent > 0) {
        this.limitUp = parseFloat((this.prevClose * (1 + limitPercent)).toFixed(this.priceDecimals));
        this.limitDown = parseFloat((this.prevClose * (1 - limitPercent)).toFixed(this.priceDecimals));
      } else {
        // 指数无涨跌停
        this.limitUp = this.prevClose * 1.1;
        this.limitDown = this.prevClose * 0.9;
      }
    }
  }

  // 时间转换为分钟数（从 9:30 开始）
  timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    const hour = parseInt(parts[0]);
    const minute = parseInt(parts[1]);
    
    if (hour >= 13) {
      return 120 + (hour - 13) * 60 + minute;
    } else {
      return (hour - 9) * 60 + minute - 30;
    }
  }

  // 判断价格颜色（红涨绿跌 - 相对昨收价）
  getPriceColor(price) {
    if (price > this.prevClose) return '#ff5252';  // 红色 - 上涨
    if (price < this.prevClose) return '#4caf50';  // 绿色 - 下跌
    return '#90a4ae';  // 灰色 - 平盘
  }

  // 绘制分时图
  draw() {
    if (!this.data || !this.data.length || !this.initCanvas()) return;
    
    this.clear();
    
    const padding = { top: 20, right: 70, bottom: 35, left: 65 };
    const chartWidth = this.width - padding.left - padding.right;
    const chartHeight = this.height - padding.top - padding.bottom;
    
    // 图表高度：价格图 65%，成交量图 35%
    const priceChartHeight = chartHeight * 0.65;
    const volumeChartHeight = chartHeight * 0.35;
    const volumeTop = padding.top + priceChartHeight + 10;
    
    // 价格范围：以昨收价为中心，涨跌停价为边界
    const displayMin = this.limitDown;
    const displayMax = this.limitUp;
    const priceRange = displayMax - displayMin;
    
    const totalMinutes = 240;
    
    // ==================== 绘制价格图 ====================
    
    // 1. 0.00% 基准线（昨收价，黄色虚线）
    const zeroY = padding.top + priceChartHeight * (displayMax - this.prevClose) / priceRange;
    this.ctx.strokeStyle = '#f0a30a';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([4, 4]);
    this.ctx.beginPath();
    this.ctx.moveTo(padding.left, zeroY);
    this.ctx.lineTo(this.width - padding.right, zeroY);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    
    // 2. 标注 0.00%（右侧）
    this.ctx.fillStyle = '#f0a30a';
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('0.00%', this.width - padding.right + 10, zeroY + 4);
    
    // 3. 涨跌停线
    if (!this.isIndex) {
      // 涨停线
      const limitUpY = padding.top + priceChartHeight * (displayMax - this.limitUp) / priceRange;
      this.ctx.strokeStyle = '#ff5252';
      this.ctx.lineWidth = 1;
      this.ctx.setLineDash([2, 2]);
      this.ctx.beginPath();
      this.ctx.moveTo(padding.left, limitUpY);
      this.ctx.lineTo(this.width - padding.right, limitUpY);
      this.ctx.stroke();
      
      // 跌停线
      const limitDownY = padding.top + priceChartHeight * (displayMax - this.limitDown) / priceRange;
      this.ctx.strokeStyle = '#4caf50';
      this.ctx.setLineDash([2, 2]);
      this.ctx.beginPath();
      this.ctx.moveTo(padding.left, limitDownY);
      this.ctx.lineTo(this.width - padding.right, limitDownY);
      this.ctx.stroke();
      
      this.ctx.setLineDash([]);
    }
    
    // 4. 计算坐标点
    const points = this.data.map(point => ({
      x: padding.left + chartWidth * this.timeToMinutes(point.time) / totalMinutes,
      y: padding.top + priceChartHeight * (displayMax - point.price) / priceRange,
      price: point.price
    }));
    
    // 5. 绘制分时现价线（分段绘制，根据涨跌变色）
    this.ctx.lineWidth = 2;
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
    
    for (let i = 1; i < points.length; i++) {
      const currPrice = points[i].price;
      
      // 根据价格相对昨收价的位置确定颜色（红涨绿跌）
      this.ctx.strokeStyle = this.getPriceColor(currPrice);
      
      this.ctx.beginPath();
      this.ctx.moveTo(points[i - 1].x, points[i - 1].y);
      this.ctx.lineTo(points[i].x, points[i].y);
      this.ctx.stroke();
    }
    
    // 6. 绘制价格线下方填充（到 0.00% 线）
    const lastPrice = points[points.length - 1].price;
    const isUp = lastPrice >= this.prevClose;
    const gradient = this.ctx.createLinearGradient(0, padding.top, 0, zeroY);
    const fillColor = isUp ? 'rgba(255, 82, 82, 0.1)' : 'rgba(76, 175, 80, 0.1)';
    gradient.addColorStop(0, fillColor);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, zeroY);
    points.forEach(p => this.ctx.lineTo(p.x, p.y));
    this.ctx.lineTo(points[points.length - 1].x, zeroY);
    this.ctx.closePath();
    this.ctx.fill();
    
    // 7. 绘制均价线（仅个股）
    if (!this.isIndex) {
      let totalAmount = 0;
      let totalVolume = 0;
      const avgPoints = this.data.map((point, i) => {
        totalAmount += point.volume * point.price;
        totalVolume += point.volume;
        const avgPrice = totalVolume > 0 ? totalAmount / totalVolume : point.price;
        return {
          x: points[i].x,
          y: padding.top + priceChartHeight * (displayMax - avgPrice) / priceRange
        };
      });
      
      this.ctx.strokeStyle = '#ff9800';
      this.ctx.lineWidth = 1.5;
      this.ctx.setLineDash([5, 3]);
      this.ctx.beginPath();
      avgPoints.forEach((p, i) => {
        if (i === 0) this.ctx.moveTo(p.x, p.y);
        else this.ctx.lineTo(p.x, p.y);
      });
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
    
    // 8. 绘制价格标签和百分比（基于昨收价）
    this.drawPriceLabels(padding, priceChartHeight, displayMin, displayMax, priceRange);
    
    // 9. 绘制时间标签
    this.drawTimeLabels(padding, chartWidth, volumeTop, volumeChartHeight);
    
    // 10. 绘制当前价格线和涨跌幅
    const lastY = padding.top + priceChartHeight * (displayMax - lastPrice) / priceRange;
    const change = lastPrice - this.prevClose;
    const changePercent = (change / this.prevClose * 100).toFixed(2);
    
    this.ctx.strokeStyle = this.getPriceColor(lastPrice);
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([2, 2]);
    this.ctx.beginPath();
    this.ctx.moveTo(points[points.length - 1].x, lastY);
    this.ctx.lineTo(this.width - padding.right, lastY);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    
    // 当前价格标签（右侧）
    const priceColor = this.getPriceColor(lastPrice);
    this.ctx.fillStyle = priceColor;
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(lastPrice.toFixed(this.priceDecimals), this.width - padding.right + 10, lastY + 4);
    
    // 涨跌幅标签（在价格下方）
    const changeSign = parseFloat(changePercent) >= 0 ? '+' : '';
    this.ctx.fillStyle = priceColor;
    this.ctx.font = 'bold 11px Arial';
    this.ctx.fillText(`${changeSign}${changePercent}%`, this.width - padding.right + 10, lastY + 16);
    
    // ==================== 绘制成交量图 ====================
    this.drawVolumeChart(padding, chartWidth, volumeTop, volumeChartHeight);
  }

  // 绘制价格标签
  drawPriceLabels(padding, priceChartHeight, displayMin, displayMax, priceRange) {
    // 计算百分比刻度（基于涨跌停幅度）
    const stockType = this.getStockType('');
    const limitPercent = stockType.limit * 100;
    
    // 根据涨跌幅限制确定刻度间隔
    let percentLevels;
    if (limitPercent >= 20) {
      // 创业板/科创板 20%
      percentLevels = [20, 10, 0, -10, -20];
    } else if (limitPercent >= 10) {
      // 主板 10%
      percentLevels = [10, 5, 0, -5, -10];
    } else if (limitPercent >= 5) {
      // ST 5%
      percentLevels = [5, 2.5, 0, -2.5, -5];
    } else {
      // 默认
      percentLevels = [10, 5, 0, -5, -10];
    }
    
    percentLevels.forEach(percent => {
      const price = this.prevClose * (1 + percent / 100);
      if (price >= displayMin && price <= displayMax) {
        const y = padding.top + priceChartHeight * (displayMax - price) / priceRange;
        
        // 左侧价格
        const priceColor = this.getPriceColor(price);
        this.ctx.fillStyle = priceColor;
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(price.toFixed(this.priceDecimals), padding.left - 8, y + 4);
        
        // 右侧百分比
        if (percent !== 0) {  // 0.00% 已经单独绘制
          const percentColor = percent > 0 ? '#ff5252' : (percent < 0 ? '#4caf50' : '#90a4ae');
          this.ctx.fillStyle = percentColor;
          this.ctx.font = 'bold 12px Arial';
          this.ctx.textAlign = 'left';
          const sign = percent > 0 ? '+' : '';
          this.ctx.fillText(`${sign}${percent.toFixed(2)}%`, this.width - padding.right + 10, y + 4);
        }
      }
    });
  }

  // 绘制时间标签
  drawTimeLabels(padding, chartWidth, volumeTop, volumeChartHeight) {
    const timeLabels = [
      { label: '9:30', pos: 0 },
      { label: '10:30', pos: 60 },
      { label: '11:30/13:00', pos: 120 },
      { label: '14:00', pos: 180 },
      { label: '15:00', pos: 240 }
    ];
    
    this.ctx.fillStyle = '#90a4ae';
    this.ctx.font = '11px Arial';
    this.ctx.textAlign = 'center';
    timeLabels.forEach(item => {
      const x = padding.left + chartWidth * item.pos / 240;
      this.ctx.fillText(item.label, x, volumeTop + volumeChartHeight + 16);
    });
  }

  // 绘制成交量图（量价匹配 - 红涨绿跌）
  drawVolumeChart(padding, chartWidth, volumeTop, volumeChartHeight) {
    const volumes = this.data.map(d => d.volume);
    const maxVolume = Math.max(...volumes);
    const amounts = this.data.map(d => d.amount || (d.volume * d.price / 100));
    const maxAmount = Math.max(...amounts);
    
    // 成交额标签（左右两边）
    const volumeLevels = 2;
    for (let i = 0; i <= volumeLevels; i++) {
      const y = volumeTop + volumeChartHeight * (volumeLevels - i) / volumeLevels;
      const amountValue = maxAmount * i / volumeLevels;
      const amountLabel = i === 0 ? '0' : `${(amountValue / 10000).toFixed(1)}亿`;
      
      this.ctx.fillStyle = '#90a4ae';
      this.ctx.font = '11px Arial';
      
      // 左侧
      this.ctx.textAlign = 'right';
      this.ctx.fillText(amountLabel, padding.left - 8, y + 4);
      
      // 右侧
      this.ctx.textAlign = 'left';
      this.ctx.fillText(amountLabel, this.width - padding.right + 10, y + 4);
      
      // 网格线
      if (i > 0) {
        this.ctx.strokeStyle = '#404040';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([3, 3]);
        this.ctx.beginPath();
        this.ctx.moveTo(padding.left, y);
        this.ctx.lineTo(this.width - padding.right, y);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      }
    }
    
    // 成交量柱状图（红涨绿跌 - 相对昨收价）
    const barWidth = Math.max(2, chartWidth / 240 * 0.8);
    
    this.data.forEach((point, index) => {
      const minutes = this.timeToMinutes(point.time);
      const x = padding.left + chartWidth * minutes / 240;
      const barHeight = maxVolume > 0 ? (point.volume / maxVolume) * volumeChartHeight * 0.9 : 0;
      
      // 量价匹配铁律：
      // - 价格 >= 昨收价：红柱，代表主动买盘
      // - 价格 < 昨收价：绿柱，代表主动卖盘
      const isUp = point.price >= this.prevClose;
      this.ctx.fillStyle = isUp ? '#ff5252' : '#4caf50';
      this.ctx.globalAlpha = 0.7;
      this.ctx.fillRect(x - barWidth/2, volumeTop + volumeChartHeight - barHeight, barWidth, barHeight);
      this.ctx.globalAlpha = 1.0;
    });
  }
}

// 导出到全局
window.IntradayChart = IntradayChart;
