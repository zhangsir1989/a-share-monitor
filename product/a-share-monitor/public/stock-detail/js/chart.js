/**
 * 分时走势图渲染 - 修复版
 * 修复时间轴、颜色、涨跌幅显示问题
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
    
    let width = Math.max(container.clientWidth - 20, 300);
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
    const padding = { top: 25, right: 75, bottom: 25, left: 55 };
    const chartWidth = width - padding.left - padding.right;
    const priceChartHeight = 315;
    const volumeHeight = 135;

    this.ctx.clearRect(0, 0, width, height);

    const prices = this.data.map(d => d.price);
    const maxPrice = Math.max(...prices, this.prevClose);
    const minPrice = Math.min(...prices, this.prevClose);
    
    const priceStep = this.calculatePriceStep(maxPrice, minPrice);
    const priceMin = Math.floor(minPrice / priceStep) * priceStep;
    const priceMax = Math.ceil(maxPrice / priceStep) * priceStep;

    const xScale = (i) => padding.left + (i / (this.data.length - 1)) * chartWidth;
    const yScale = (price) => {
      const range = priceMax - priceMin || 0.01;
      return padding.top + priceChartHeight - ((price - priceMin) / range) * priceChartHeight;
    };

    // 1. 绘制网格
    this.drawGrid(padding, chartWidth, priceChartHeight, priceMin, priceMax, priceStep);

    // 2. 绘制昨收价线
    const prevCloseY = yScale(this.prevClose);
    this.drawBaseline(padding, chartWidth, prevCloseY, this.prevClose);

    // 3. 绘制均价线
    const avgY = yScale(this.stats.avgPrice);
    this.drawAvgLine(padding, chartWidth, avgY, this.stats.avgPrice);

    // 4. 绘制价格曲线（分段着色）
    this.drawPriceLineWithSegments(xScale, yScale, padding.top, padding.top + priceChartHeight);

    // 5. 绘制盘后数据
    if (this.afterHoursData?.length > 0) {
      this.drawAfterHoursData(xScale, yScale, this.stats.close);
    }

    // 6. 绘制统计信息
    this.drawStats(padding.left, padding.top, chartWidth);

    // 7. 绘制成交量
    const volumeYBase = padding.top + priceChartHeight + 5;
    this.drawVolumeBar(padding, chartWidth, volumeHeight, volumeYBase);

    // 8. 绘制时间轴
    this.drawTimeAxis(padding, chartWidth, volumeYBase + volumeHeight + 5);
  },

  calculatePriceStep(maxPrice, minPrice) {
    const range = maxPrice - minPrice;
    if (range < 0.5) return 0.1;
    if (range < 1) return 0.2;
    if (range < 2) return 0.5;
    if (range < 5) return 1;
    if (range < 10) return 2;
    if (range < 20) return 5;
    return 10;
  },

  drawGrid(padding, chartWidth, priceChartHeight, priceMin, priceMax, step) {
    this.ctx.strokeStyle = '#30363d';
    this.ctx.lineWidth = 0.5;

    // 横线（价格）+ 右侧标签（含涨跌幅）
    for (let price = priceMin; price <= priceMax; price += step) {
      const y = padding.top + priceChartHeight - ((price - priceMin) / (priceMax - priceMin)) * priceChartHeight;
      
      this.ctx.beginPath();
      this.ctx.moveTo(padding.left, y);
      this.ctx.lineTo(padding.left + chartWidth, y);
      this.ctx.stroke();

      // 价格标签（左侧）
      this.ctx.fillStyle = '#8b949e';
      this.ctx.font = '11px Arial';
      this.ctx.textAlign = 'right';
      this.ctx.fillText(price.toFixed(2), padding.left - 5, y + 4);

      // 涨跌幅标签（右侧）
      const change = price - this.prevClose;
      const changePercent = (change / this.prevClose) * 100;
      const sign = change >= 0 ? '+' : '';
      const color = change >= 0 ? '#ff4d4f' : '#52c41a';
      
      this.ctx.fillStyle = color;
      this.ctx.font = '10px Arial';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(`${sign}${changePercent.toFixed(2)}%`, padding.left + chartWidth + 5, y + 4);
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

  drawBaseline(padding, chartWidth, y, prevClose) {
    this.ctx.strokeStyle = '#faad14';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([5, 5]);
    
    this.ctx.beginPath();
    this.ctx.moveTo(padding.left, y);
    this.ctx.lineTo(padding.left + chartWidth, y);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    this.ctx.fillStyle = '#faad14';
    this.ctx.font = '11px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('昨收 ' + prevClose.toFixed(2), padding.left + chartWidth + 5, y + 4);
  },

  drawAvgLine(padding, chartWidth, y, avgPrice) {
    this.ctx.strokeStyle = '#faad14';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([3, 3]);
    
    this.ctx.beginPath();
    this.ctx.moveTo(padding.left, y);
    this.ctx.lineTo(padding.left + chartWidth, y);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    this.ctx.fillStyle = '#faad14';
    this.ctx.font = '11px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('均价 ' + avgPrice.toFixed(2), padding.left + chartWidth + 5, y + 16);
  },

  /**
   * 绘制价格曲线 - 分段着色（每段根据该时刻相对昨收的涨跌）
   */
  drawPriceLineWithSegments(xScale, yScale, yTop, yBottom) {
    // 绘制填充区域（整体）
    const lastPrice = this.stats.close;
    const isUp = lastPrice >= this.prevClose;
    const areaColor = isUp ? 'rgba(255, 77, 79, 0.08)' : 'rgba(82, 196, 26, 0.08)';
    const lineColor = isUp ? '#ff4d4f' : '#52c41a';

    this.ctx.beginPath();
    this.ctx.moveTo(xScale(0), yScale(this.prevClose));
    for (let i = 0; i < this.data.length; i++) {
      this.ctx.lineTo(xScale(i), yScale(this.data[i].price));
    }
    this.ctx.lineTo(xScale(this.data.length - 1), yScale(this.prevClose));
    this.ctx.closePath();
    this.ctx.fillStyle = areaColor;
    this.ctx.fill();

    // 绘制曲线 - 分段着色
    this.ctx.lineWidth = 1.5;
    for (let i = 0; i < this.data.length - 1; i++) {
      const price = this.data[i].price;
      const segmentUp = price >= this.prevClose;
      
      this.ctx.beginPath();
      this.ctx.moveTo(xScale(i), yScale(price));
      this.ctx.lineTo(xScale(i + 1), yScale(this.data[i + 1].price));
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

    // 收盘价标签（右侧）
    const change = lastPrice - this.prevClose;
    const changePercent = (change / this.prevClose) * 100;
    const sign = change >= 0 ? '+' : '';
    
    this.ctx.fillStyle = lineColor;
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(lastPrice.toFixed(2), lastX + 10, lastY - 5);
    this.ctx.font = '11px Arial';
    this.ctx.fillText(`${sign}${changePercent.toFixed(2)}%`, lastX + 10, lastY + 10);
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
    
    this.ctx.fillStyle = '#1890ff';
    this.ctx.font = '11px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('盘后', lastIntradayX + 35, yScale(this.afterHoursData[this.afterHoursData.length - 1]?.price || closePrice));
  },

  drawStats(x, y, chartWidth) {
    const change = this.stats.close - this.prevClose;
    const changePercent = (change / this.prevClose) * 100;
    const isUp = change >= 0;
    const color = isUp ? '#ff4d4f' : '#52c41a';
    const sign = isUp ? '+' : '';

    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'left';
    
    const lines = [
      `开 ${this.stats.open.toFixed(2)}`,
      `高 ${this.stats.high.toFixed(2)}`,
      `低 ${this.stats.low.toFixed(2)}`,
      `收 ${this.stats.close.toFixed(2)}`
    ];

    const colWidth = chartWidth / 2;
    for (let i = 0; i < lines.length; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const px = x + col * colWidth;
      const py = y - 10 + row * 16;
      this.ctx.fillStyle = '#8b949e';
      this.ctx.fillText(lines[i], px, py);
    }
    
    // 涨跌幅显示在顶部右侧
    this.ctx.fillStyle = color;
    this.ctx.font = 'bold 13px Arial';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`${sign}${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)`, x + chartWidth, y - 10);
  },

  drawVolumeBar(padding, chartWidth, volumeHeight, yBase) {
    const volumes = this.data.map(d => d.volume || 0);
    const maxVolume = Math.max(...volumes) || 1;
    const barWidth = Math.max(1, chartWidth / this.data.length * 0.8);

    for (let i = 0; i < this.data.length; i++) {
      const x = padding.left + (i / (this.data.length - 1)) * chartWidth - barWidth / 2;
      const barHeight = (volumes[i] / maxVolume) * volumeHeight;
      const y = yBase + volumeHeight - barHeight;

      const price = this.data[i].price;
      this.ctx.fillStyle = price >= this.prevClose ? 'rgba(255, 77, 79, 0.7)' : 'rgba(82, 196, 26, 0.7)';
      this.ctx.fillRect(x, y, barWidth, barHeight);
    }

    const totalAmount = this.data.reduce((sum, d) => sum + d.price * (d.volume || 0), 0);
    const amountText = totalAmount > 1e8 ? (totalAmount / 1e8).toFixed(2) + '亿' : 
                       totalAmount > 1e4 ? (totalAmount / 1e4).toFixed(2) + '万' : totalAmount.toFixed(0);
    
    this.ctx.fillStyle = '#8b949e';
    this.ctx.font = '11px Arial';
    this.ctx.textAlign = 'right';
    this.ctx.fillText('成交额 ' + amountText, padding.left + chartWidth, yBase - 5);
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
