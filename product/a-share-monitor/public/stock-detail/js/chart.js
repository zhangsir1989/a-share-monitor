/**
 * 分时走势图渲染 - 优化版
 * 符合金融行情软件通用展示规范
 */

const Chart = {
  canvas: null,
  ctx: null,
  data: null,
  prevClose: 0,
  stats: null,  // 统计信息
  afterHoursData: null,  // 盘后数据

  /**
   * 初始化图表
   */
  init(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.error('找不到 Canvas 元素:', canvasId);
      return false;
    }
    this.ctx = this.canvas.getContext('2d');
    
    // 设置 Canvas 尺寸
    this.resize();
    
    // 监听窗口大小变化
    window.addEventListener('resize', () => this.resize());
    
    return true;
  },

  /**
   * 调整 Canvas 尺寸
   */
  resize() {
    if (!this.canvas) return;
    
    const container = this.canvas.parentElement;
    if (!container) return;
    
    // 确保容器有有效尺寸
    let width = Math.max(container.clientWidth - 20, 300);  // 最小宽度 300px
    let height = 450;  // 增加高度到 450px，让图表更清晰
    
    // 如果容器宽度为 0，等待下一帧重新计算
    if (container.clientWidth <= 20) {
      requestAnimationFrame(() => this.resize());
      return;
    }
    
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    
    // 如果有数据，重新绘制
    if (this.data) {
      this.draw();
    }
  },

  /**
   * 渲染分时图
   */
  render(responseData) {
    if (!responseData || !responseData.data || responseData.data.length === 0) {
      this.drawPlaceholder('暂无分时数据');
      return;
    }

    // 分离盘中数据和盘后数据
    this.data = responseData.data.filter(d => {
      const time = d.time;
      return time >= '09:30' && time <= '15:00';
    });
    
    this.afterHoursData = responseData.data.filter(d => {
      const time = d.time;
      return time > '15:00';
    });
    
    this.prevClose = responseData.prevClose || this.data[0]?.prevClose || 0;
    
    // 计算统计信息（仅盘中数据）
    this.calculateStats();
    
    this.draw();
  },

  /**
   * 计算统计信息
   */
  calculateStats() {
    const prices = this.data.map(d => d.price);
    const volumes = this.data.map(d => d.volume || 0);
    
    this.stats = {
      open: this.data[0]?.price || 0,
      high: Math.max(...prices),
      low: Math.min(...prices),
      close: this.data[this.data.length - 1]?.price || 0,
      totalVolume: volumes.reduce((a, b) => a + b, 0),
      avgPrice: this.calculateAvgPrice()
    };
  },

  /**
   * 计算均价
   */
  calculateAvgPrice() {
    let totalAmount = 0;
    let totalVolume = 0;
    
    for (const d of this.data) {
      const vol = d.volume || 0;
      totalAmount += d.price * vol;
      totalVolume += vol;
    }
    
    return totalVolume > 0 ? totalAmount / totalVolume : this.prevClose;
  },

  /**
   * 绘制图表
   */
  draw() {
    if (!this.ctx || !this.data) return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    
    // 布局：价格图 (315px) + 成交量 (135px) = 450px，比例约 7:3
    const padding = { top: 25, right: 65, bottom: 25, left: 55 };
    const chartWidth = width - padding.left - padding.right;
    const priceChartHeight = 315;  // 价格图高度 (70%)
    const volumeHeight = 135;      // 成交量高度 (30%)

    // 清空画布
    this.ctx.clearRect(0, 0, width, height);

    // 获取价格范围（仅盘中数据）
    const prices = this.data.map(d => d.price);
    const maxPrice = Math.max(...prices, this.prevClose);
    const minPrice = Math.min(...prices, this.prevClose);
    
    // 计算价格坐标（固定间距）
    const priceStep = this.calculatePriceStep(maxPrice, minPrice);
    const priceMin = Math.floor(minPrice / priceStep) * priceStep;
    const priceMax = Math.ceil(maxPrice / priceStep) * priceStep;

    // 计算坐标转换函数
    const xScale = (i) => padding.left + (i / (this.data.length - 1)) * chartWidth;
    const yScale = (price) => {
      const range = priceMax - priceMin;
      return padding.top + priceChartHeight - ((price - priceMin) / range) * priceChartHeight;
    };

    // 绘制背景网格和价格刻度
    this.drawGrid(padding, chartWidth, priceChartHeight, priceMin, priceMax, priceStep);

    // 绘制昨收价参考线
    this.drawBaseline(padding, chartWidth, yScale(this.prevClose), this.prevClose);

    // 绘制均价线
    this.drawAvgLine(padding, chartWidth, yScale(this.stats.avgPrice), this.stats.avgPrice);

    // 绘制价格曲线（仅盘中）
    this.drawPriceLine(xScale, yScale);

    // 绘制盘后数据（如果有）
    if (this.afterHoursData && this.afterHoursData.length > 0) {
      this.drawAfterHoursData(xScale, yScale, padding.top, padding.top + priceChartHeight);
    }

    // 绘制统计信息
    this.drawStats(padding.left, padding.top, chartWidth);

    // 绘制成交量柱状图（仅盘中）
    const volumeYBase = padding.top + priceChartHeight + 5;
    this.drawVolumeBar(padding, chartWidth, volumeHeight, volumeYBase);

    // 绘制时间轴标签
    this.drawTimeAxis(padding, chartWidth, volumeYBase + volumeHeight + 5);
  },

  /**
   * 计算价格刻度间距
   */
  calculatePriceStep(maxPrice, minPrice) {
    const range = maxPrice - minPrice;
    
    // 根据价格范围选择合适的刻度间距
    if (range < 0.5) return 0.1;
    if (range < 1) return 0.2;
    if (range < 2) return 0.5;
    if (range < 5) return 1;
    if (range < 10) return 2;
    if (range < 20) return 5;
    return 10;
  },

  /**
   * 绘制网格和价格刻度
   */
  drawGrid(padding, chartWidth, priceChartHeight, priceMin, priceMax, step) {
    this.ctx.strokeStyle = '#30363d';
    this.ctx.lineWidth = 0.5;

    // 横线（价格）- 按固定间距绘制
    for (let price = priceMin; price <= priceMax; price += step) {
      const y = padding.top + priceChartHeight - ((price - priceMin) / (priceMax - priceMin)) * priceChartHeight;
      
      this.ctx.beginPath();
      this.ctx.moveTo(padding.left, y);
      this.ctx.lineTo(padding.left + chartWidth, y);
      this.ctx.stroke();

      // 价格标签
      this.ctx.fillStyle = '#8b949e';
      this.ctx.font = '11px Arial';
      this.ctx.textAlign = 'right';
      this.ctx.fillText(price.toFixed(2), padding.left - 5, y + 4);
    }

    // 竖线（时间）- 根据实际时间点位置绘制
    const timePoints = ['09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00'];
    for (const targetTime of timePoints) {
      const index = this.findTimeIndex(targetTime);
      if (index >= 0) {
        const x = padding.left + (index / (this.data.length - 1)) * chartWidth;
        this.ctx.beginPath();
        this.ctx.moveTo(x, padding.top);
        this.ctx.lineTo(x, padding.top + priceChartHeight);
        this.ctx.stroke();
      }
    }
  },

  /**
   * 绘制昨收价参考线
   */
  drawBaseline(padding, chartWidth, y, prevClose) {
    this.ctx.strokeStyle = '#faad14';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([5, 5]);
    
    this.ctx.beginPath();
    this.ctx.moveTo(padding.left, y);
    this.ctx.lineTo(padding.left + chartWidth, y);
    this.ctx.stroke();
    
    this.ctx.setLineDash([]);

    // 昨收价标签
    this.ctx.fillStyle = '#faad14';
    this.ctx.font = '11px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('昨收 ' + prevClose.toFixed(2), padding.left + chartWidth + 5, y + 4);
  },

  /**
   * 绘制均价线
   */
  drawAvgLine(padding, chartWidth, y, avgPrice) {
    this.ctx.strokeStyle = '#faad14';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([3, 3]);
    
    this.ctx.beginPath();
    this.ctx.moveTo(padding.left, y);
    this.ctx.lineTo(padding.left + chartWidth, y);
    this.ctx.stroke();
    
    this.ctx.setLineDash([]);

    // 均价标签
    this.ctx.fillStyle = '#faad14';
    this.ctx.font = '11px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('均价 ' + avgPrice.toFixed(2), padding.left + chartWidth + 5, y + 16);
  },

  /**
   * 绘制价格曲线
   */
  drawPriceLine(xScale, yScale) {
    const lastPrice = this.stats.close;  // 使用收盘价（15:00 的价格）
    const isUp = lastPrice >= this.prevClose;
    const color = isUp ? '#ff4d4f' : '#52c41a';

    // 绘制填充区域
    this.ctx.beginPath();
    this.ctx.moveTo(xScale(0), yScale(this.prevClose));
    
    for (let i = 0; i < this.data.length; i++) {
      this.ctx.lineTo(xScale(i), yScale(this.data[i].price));
    }
    
    this.ctx.lineTo(xScale(this.data.length - 1), yScale(this.prevClose));
    this.ctx.closePath();
    
    this.ctx.fillStyle = isUp ? 'rgba(255, 77, 79, 0.1)' : 'rgba(82, 196, 26, 0.1)';
    this.ctx.fill();

    // 绘制曲线
    this.ctx.beginPath();
    this.ctx.moveTo(xScale(0), yScale(this.data[0].price));
    
    for (let i = 1; i < this.data.length; i++) {
      this.ctx.lineTo(xScale(i), yScale(this.data[i].price));
    }
    
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // 绘制收盘价点（15:00）
    const lastX = xScale(this.data.length - 1);
    const lastY = yScale(lastPrice);
    
    this.ctx.beginPath();
    this.ctx.arc(lastX, lastY, 5, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    
    // 收盘价标签
    this.ctx.fillStyle = color;
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(lastPrice.toFixed(2) + ' (收盘)', lastX + 10, lastY);
  },

  /**
   * 绘制盘后数据（如果有）
   */
  drawAfterHoursData(xScale, yScale, yTop, yBottom) {
    if (!this.afterHoursData || this.afterHoursData.length === 0) return;
    
    this.ctx.strokeStyle = '#1890ff';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    
    this.ctx.beginPath();
    
    // 从 15:00 的收盘价开始
    const closePrice = this.stats.close;
    const lastIntradayX = xScale(this.data.length - 1);
    const closeY = yScale(closePrice);
    
    this.ctx.moveTo(lastIntradayX, closeY);
    
    // 绘制盘后数据点
    for (const d of this.afterHoursData) {
      // 盘后数据在 15:00 右侧延伸
      const extraX = lastIntradayX + 30;  // 向右延伸 30px
      const y = yScale(d.price);
      this.ctx.lineTo(extraX, y);
    }
    
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    
    // 盘后数据标签
    this.ctx.fillStyle = '#1890ff';
    this.ctx.font = '11px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('盘后', lastIntradayX + 35, yScale(this.afterHoursData[this.afterHoursData.length - 1]?.price || closePrice));
  },

  /**
   * 绘制统计信息
   */
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
      `涨 ${sign}${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)`
    ];

    // 分两列显示
    const colWidth = chartWidth / 2;
    
    for (let i = 0; i < lines.length; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const px = x + col * colWidth;
      const py = y - 10 + row * 16;
      
      this.ctx.fillStyle = '#8b949e';
      this.ctx.fillText(lines[i], px, py);
    }
  },

  /**
   * 绘制成交量柱状图
   */
  drawVolumeBar(padding, chartWidth, volumeHeight, yBase) {
    const volumes = this.data.map(d => d.volume || 0);
    const maxVolume = Math.max(...volumes) || 1;
    const barWidth = Math.max(1, chartWidth / this.data.length * 0.8);

    for (let i = 0; i < this.data.length; i++) {
      const x = padding.left + (i / (this.data.length - 1)) * chartWidth - barWidth / 2;
      const barHeight = (volumes[i] / maxVolume) * volumeHeight;
      const y = yBase + volumeHeight - barHeight;

      // 根据涨跌选择颜色
      const price = this.data[i].price;
      this.ctx.fillStyle = price >= this.prevClose ? 'rgba(255, 77, 79, 0.7)' : 'rgba(82, 196, 26, 0.7)';
      this.ctx.fillRect(x, y, barWidth, barHeight);
    }

    // 绘制总成交额标签
    const totalAmount = this.data.reduce((sum, d) => sum + d.price * (d.volume || 0), 0);
    const amountText = totalAmount > 1e8 ? (totalAmount / 1e8).toFixed(2) + '亿' : 
                       totalAmount > 1e4 ? (totalAmount / 1e4).toFixed(2) + '万' : totalAmount.toFixed(0);
    
    this.ctx.fillStyle = '#8b949e';
    this.ctx.font = '11px Arial';
    this.ctx.textAlign = 'right';
    this.ctx.fillText('成交额 ' + amountText, padding.left + chartWidth, yBase - 5);
  },

  /**
   * 绘制时间轴标签
   */
  drawTimeAxis(padding, chartWidth, yPosition) {
    const targetTimes = ['09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00'];
    
    this.ctx.fillStyle = '#8b949e';
    this.ctx.font = '11px Arial';
    this.ctx.textAlign = 'center';

    for (const targetTime of targetTimes) {
      const index = this.findTimeIndex(targetTime);
      if (index >= 0) {
        const x = padding.left + (index / (this.data.length - 1)) * chartWidth;
        this.ctx.fillText(targetTime, x, yPosition);
      }
    }
  },

  /**
   * 找出指定时间在数据中的索引
   */
  findTimeIndex(targetTime) {
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i].time === targetTime) {
        return i;
      }
    }
    // 如果找不到精确匹配，返回近似位置
    const [targetHour, targetMin] = targetTime.split(':').map(Number);
    const targetMinutes = targetHour * 60 + targetMin;
    
    for (let i = 0; i < this.data.length; i++) {
      const [h, m] = this.data[i].time.split(':').map(Number);
      const minutes = h * 60 + m;
      if (minutes >= targetMinutes) {
        return i;
      }
    }
    return this.data.length - 1;
  },

  /**
   * 绘制占位符
   */
  drawPlaceholder(message) {
    if (!this.ctx) return;
    
    const width = this.canvas.width;
    const height = this.canvas.height;

    this.ctx.clearRect(0, 0, width, height);
    
    this.ctx.fillStyle = '#21262d';
    this.ctx.fillRect(0, 0, width, height);
    
    this.ctx.fillStyle = '#8b949e';
    this.ctx.font = '14px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(message, width / 2, height / 2);
  }
};

// 导出到全局
window.Chart = Chart;
