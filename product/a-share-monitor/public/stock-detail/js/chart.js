/**
 * 分时走势图渲染 - 正确版
 * 修复：价格曲线、0 轴位置、成交量颜色
 */

const Chart = {
  canvas: null,
  ctx: null,
  data: null,
  prevClose: 0,
  stats: null,
  afterHoursData: null,

  init(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.error('找不到 Canvas 元素:', canvasId);
      return false;
    }
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    return true;
  },

  resize() {
    if (!this.canvas) return;
    const container = this.canvas.parentElement;
    if (!container) return;
    
    let width = Math.max(container.clientWidth - 20, 400);
    let height = 450;
    
    if (container.clientWidth <= 20) {
      requestAnimationFrame(() => this.resize());
      return;
    }
    
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    
    if (this.data) this.draw();
  },

  render(responseData) {
    if (!responseData || !responseData.data || responseData.data.length === 0) {
      this.drawPlaceholder('暂无分时数据');
      return;
    }

    // 分离盘中数据（09:30-15:00）和盘后数据
    this.data = responseData.data.filter(d => d.time >= '09:30' && d.time <= '15:00');
    this.afterHoursData = responseData.data.filter(d => d.time > '15:00');
    this.prevClose = responseData.prevClose || this.data[0]?.prevClose || 0;
    
    this.calculateStats();
    this.draw();
  },

  calculateStats() {
    const prices = this.data.map(d => d.price);
    this.stats = {
      open: this.data[0]?.price || 0,
      high: Math.max(...prices),
      low: Math.min(...prices),
      close: this.data[this.data.length - 1]?.price || 0,
      avgPrice: this.calculateAvgPrice()
    };
  },

  calculateAvgPrice() {
    let totalAmount = 0, totalVolume = 0;
    for (const d of this.data) {
      const vol = d.volume || 0;
      totalAmount += d.price * vol;
      totalVolume += vol;
    }
    return totalVolume > 0 ? totalAmount / totalVolume : this.prevClose;
  },

  draw() {
    if (!this.ctx || !this.data) return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    
    // 布局：价格图 (315px) + 成交量 (135px) = 450px
    const padding = { top: 25, right: 10, bottom: 25, left: 55 };
    const chartWidth = width - padding.left - padding.right;
    const priceChartHeight = 315;
    const volumeHeight = 135;

    this.ctx.clearRect(0, 0, width, height);

    const prices = this.data.map(d => d.price);
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    
    // 关键修复：以昨收价为中心，计算对称的价格范围
    const maxChange = Math.max(
      Math.abs(maxPrice - this.prevClose),
      Math.abs(minPrice - this.prevClose)
    );
    
    // 上下各扩展 10% 的波动范围
    const range = maxChange * 1.1 || this.prevClose * 0.01;
    const displayMin = this.prevClose - range;
    const displayMax = this.prevClose + range;

    // 坐标转换函数
    const xScale = (i) => padding.left + (i / (this.data.length - 1)) * chartWidth;
    const yScale = (price) => {
      const range = displayMax - displayMin || 0.01;
      return padding.top + priceChartHeight - ((price - displayMin) / range) * priceChartHeight;
    };

    // 1. 绘制网格和价格刻度（左侧）
    this.drawGrid(padding, chartWidth, priceChartHeight, displayMin, displayMax);

    // 2. 绘制昨收价线（0 轴）- 在正中间
    const prevCloseY = yScale(this.prevClose);
    this.drawPrevCloseLine(padding, chartWidth, prevCloseY);

    // 3. 绘制均价线
    const avgY = yScale(this.stats.avgPrice);
    this.drawAvgLine(padding, chartWidth, avgY);

    // 4. 绘制价格曲线（分段着色）
    this.drawPriceLineWithSegments(xScale, yScale);

    // 5. 绘制盘后数据
    if (this.afterHoursData?.length > 0) {
      this.drawAfterHoursData(xScale, yScale, this.stats.close);
    }

    // 6. 绘制统计信息（顶部）
    this.drawStats(padding.left, padding.top, chartWidth);

    // 7. 绘制成交量（红涨绿跌）
    const volumeYBase = padding.top + priceChartHeight + 5;
    this.drawVolumeBarCorrect(padding, chartWidth, volumeHeight, volumeYBase);

    // 8. 绘制时间轴
    this.drawTimeAxis(padding, chartWidth, volumeYBase + volumeHeight + 5);
  },

  drawGrid(padding, chartWidth, priceChartHeight, priceMin, priceMax) {
    this.ctx.strokeStyle = '#30363d';
    this.ctx.lineWidth = 0.5;

    // 绘制 5 条横线（价格刻度），均匀分布
    const lines = 5;
    for (let i = 0; i <= lines; i++) {
      const y = padding.top + (i / lines) * priceChartHeight;
      
      this.ctx.beginPath();
      this.ctx.moveTo(padding.left, y);
      this.ctx.lineTo(padding.left + chartWidth, y);
      this.ctx.stroke();

      // 左侧价格标签
      const price = priceMax - (i / lines) * (priceMax - priceMin);
      this.ctx.fillStyle = '#8b949e';
      this.ctx.font = '11px Arial';
      this.ctx.textAlign = 'right';
      this.ctx.fillText(price.toFixed(2), padding.left - 5, y + 4);
    }

    // 竖线（时间）
    const timePoints = ['09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00'];
    for (const t of timePoints) {
      const index = this.findTimeIndex(t);
      if (index >= 0) {
        const x = padding.left + (index / (this.data.length - 1)) * chartWidth;
        this.ctx.beginPath();
        this.ctx.moveTo(x, padding.top);
        this.ctx.lineTo(x, padding.top + priceChartHeight);
        this.ctx.strokeStyle = '#30363d';
        this.ctx.stroke();
      }
    }
  },

  drawPrevCloseLine(padding, chartWidth, y) {
    this.ctx.strokeStyle = '#faad14';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([5, 5]);
    
    this.ctx.beginPath();
    this.ctx.moveTo(padding.left, y);
    this.ctx.lineTo(padding.left + chartWidth, y);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // 昨收价标签（左侧）
    this.ctx.fillStyle = '#faad14';
    this.ctx.font = '11px Arial';
    this.ctx.textAlign = 'right';
    this.ctx.fillText('昨收 ' + this.prevClose.toFixed(2), padding.left - 5, y - 5);
  },

  drawAvgLine(padding, chartWidth, y) {
    this.ctx.strokeStyle = '#1890ff';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([3, 3]);
    
    this.ctx.beginPath();
    this.ctx.moveTo(padding.left, y);
    this.ctx.lineTo(padding.left + chartWidth, y);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // 均价标签（左侧）
    this.ctx.fillStyle = '#1890ff';
    this.ctx.font = '11px Arial';
    this.ctx.textAlign = 'right';
    this.ctx.fillText('均价 ' + this.stats.avgPrice.toFixed(2), padding.left - 5, y + 15);
  },

  /**
   * 绘制价格曲线 - 分段着色（每段根据该时刻相对昨收的涨跌）
   */
  drawPriceLineWithSegments(xScale, yScale) {
    const lastPrice = this.stats.close;
    const isUp = lastPrice >= this.prevClose;
    const areaColor = isUp ? 'rgba(255, 77, 79, 0.08)' : 'rgba(82, 196, 26, 0.08)';
    const lineColor = isUp ? '#ff4d4f' : '#52c41a';

    // 绘制填充区域（从昨收价到价格曲线）
    this.ctx.beginPath();
    this.ctx.moveTo(xScale(0), yScale(this.prevClose));
    for (let i = 0; i < this.data.length; i++) {
      this.ctx.lineTo(xScale(i), yScale(this.data[i].price));
    }
    this.ctx.lineTo(xScale(this.data.length - 1), yScale(this.prevClose));
    this.ctx.closePath();
    this.ctx.fillStyle = areaColor;
    this.ctx.fill();

    // 绘制曲线 - 分段着色（每段根据起点价格相对昨收的涨跌）
    this.ctx.lineWidth = 1.5;
    for (let i = 0; i < this.data.length - 1; i++) {
      const price = this.data[i].price;
      const nextPrice = this.data[i + 1].price;
      const segmentUp = price >= this.prevClose;
      
      this.ctx.beginPath();
      this.ctx.moveTo(xScale(i), yScale(price));
      this.ctx.lineTo(xScale(i + 1), yScale(nextPrice));
      this.ctx.strokeStyle = segmentUp ? '#ff4d4f' : '#52c41a';
      this.ctx.stroke();
    }

    // 绘制收盘价点
    const lastX = xScale(this.data.length - 1);
    const lastY = yScale(lastPrice);
    
    this.ctx.beginPath();
    this.ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    this.ctx.fillStyle = lineColor;
    this.ctx.fill();
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  },

  drawAfterHoursData(xScale, yScale, closePrice) {
    const lastIntradayX = xScale(this.data.length - 1);
    const closeY = yScale(closePrice);
    
    this.ctx.strokeStyle = '#1890ff';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    
    this.ctx.beginPath();
    this.ctx.moveTo(lastIntradayX, closeY);
    
    for (const d of this.afterHoursData) {
      const extraX = lastIntradayX + 30;
      const y = yScale(d.price);
      this.ctx.lineTo(extraX, y);
    }
    
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  },

  drawStats(x, y, chartWidth) {
    const change = this.stats.close - this.prevClose;
    const changePercent = (change / this.prevClose) * 100;
    const isUp = change >= 0;
    const color = isUp ? '#ff4d4f' : '#52c41a';
    const sign = isUp ? '+' : '';

    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'left';
    
    // 第一行：开、高
    this.ctx.fillStyle = '#8b949e';
    this.ctx.fillText(`开 ${this.stats.open.toFixed(2)}`, x, y - 10);
    this.ctx.fillText(`高 ${this.stats.high.toFixed(2)}`, x + chartWidth / 2 - 40, y - 10);
    
    // 第二行：低、收
    this.ctx.fillText(`低 ${this.stats.low.toFixed(2)}`, x, y + 5);
    this.ctx.fillText(`收 ${this.stats.close.toFixed(2)}`, x + chartWidth / 2 - 40, y + 5);
    
    // 涨跌幅显示在右上角
    this.ctx.fillStyle = color;
    this.ctx.font = 'bold 13px Arial';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`${sign}${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)`, x + chartWidth, y - 5);
  },

  /**
   * 绘制成交量柱状图 - 正确的颜色（红涨绿跌）
   * 颜色根据该时刻价格相对昨收的涨跌
   */
  drawVolumeBarCorrect(padding, chartWidth, volumeHeight, yBase) {
    const volumes = this.data.map(d => d.volume || 0);
    const maxVolume = Math.max(...volumes) || 1;
    const barWidth = Math.max(1, chartWidth / this.data.length * 0.8);

    for (let i = 0; i < this.data.length; i++) {
      const x = padding.left + (i / (this.data.length - 1)) * chartWidth - barWidth / 2;
      const barHeight = (volumes[i] / maxVolume) * volumeHeight;
      const y = yBase + volumeHeight - barHeight;

      // 关键修复：颜色根据该时刻价格相对昨收的涨跌
      const price = this.data[i].price;
      const isUp = price >= this.prevClose;  // 相对昨收，不是相对开盘
      
      this.ctx.fillStyle = isUp ? 'rgba(255, 77, 79, 0.7)' : 'rgba(82, 196, 26, 0.7)';
      this.ctx.fillRect(x, y, barWidth, barHeight);
    }

    // 总成交额标签
    const totalAmount = this.data.reduce((sum, d) => sum + d.price * (d.volume || 0), 0);
    const amountText = totalAmount > 1e8 ? (totalAmount / 1e8).toFixed(2) + '亿' : 
                       totalAmount > 1e4 ? (totalAmount / 1e4).toFixed(2) + '万' : totalAmount.toFixed(0);
    
    this.ctx.fillStyle = '#8b949e';
    this.ctx.font = '11px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('成交额 ' + amountText, padding.left, yBase - 5);
  },

  drawTimeAxis(padding, chartWidth, yPosition) {
    const targetTimes = ['09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00'];
    
    this.ctx.fillStyle = '#8b949e';
    this.ctx.font = '11px Arial';
    this.ctx.textAlign = 'center';

    for (const t of targetTimes) {
      const index = this.findTimeIndex(t);
      if (index >= 0) {
        const x = padding.left + (index / (this.data.length - 1)) * chartWidth;
        this.ctx.fillText(t, x, yPosition);
      }
    }
  },

  findTimeIndex(targetTime) {
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i].time === targetTime) return i;
    }
    const [h, m] = targetTime.split(':').map(Number);
    const targetMin = h * 60 + m;
    for (let i = 0; i < this.data.length; i++) {
      const [hh, mm] = this.data[i].time.split(':').map(Number);
      if (hh * 60 + mm >= targetMin) return i;
    }
    return this.data.length - 1;
  },

  drawPlaceholder(message) {
    if (!this.ctx) return;
    const w = this.canvas.width, h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.fillStyle = '#21262d';
    this.ctx.fillRect(0, 0, w, h);
    this.ctx.fillStyle = '#8b949e';
    this.ctx.font = '14px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(message, w / 2, h / 2);
  }
};

window.Chart = Chart;
