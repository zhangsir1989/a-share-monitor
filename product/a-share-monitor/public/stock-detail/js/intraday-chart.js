/**
 * 分时走势图渲染模块
 * 独立文件，不影响其他模块
 */

const IntradayChart = {
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
    if (!this.ctx || !this.data || this.data.length === 0) return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    
    // 布局：价格图 (285px) + 成交量 (135px) + 时间轴 (30px) = 450px
    const padding = { top: 30, right: 70, bottom: 30, left: 55 };  // 右侧增加空间显示涨跌幅%
    const chartWidth = width - padding.left - padding.right;
    const priceChartHeight = 285;
    const volumeHeight = 135;

    this.ctx.clearRect(0, 0, width, height);
    
    // 获取当前时间，确定绘制到哪个时间点
    const now = new Date();
    const currentHour = now.getUTCHours() + 8; // 北京时间
    const currentMinute = now.getUTCMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    
    // 交易时间：9:30-11:30(120 分钟), 13:00-15:00(120 分钟)
    const marketOpen = 9 * 60 + 30;      // 570 - 上午开盘
    const marketNoonEnd = 11 * 60 + 30;  // 690 - 上午收盘
    const marketAfternoonStart = 13 * 60; // 780 - 下午开盘
    const marketClose = 15 * 60;         // 900 - 下午收盘
    
    // 计算当前应该绘制的数据点索引
    let currentIndex = this.data.length - 1; // 默认绘制全部
    
    if (currentTotalMinutes < marketOpen) {
      // 还没开盘，不绘制
      currentIndex = 0;
    } else if (currentTotalMinutes <= marketNoonEnd) {
      // 上午交易时间：9:30-11:30
      const minutesFromOpen = currentTotalMinutes - marketOpen;
      currentIndex = Math.floor((minutesFromOpen / 120) * 120);
    } else if (currentTotalMinutes < marketAfternoonStart) {
      // 午休时间：11:30-13:00，停留在上午收盘
      currentIndex = 120;
    } else if (currentTotalMinutes <= marketClose) {
      // 下午交易时间：13:00-15:00
      const afternoonMinutes = currentTotalMinutes - marketAfternoonStart;
      currentIndex = 121 + Math.floor((afternoonMinutes / 120) * 120);
    }
    
    // 确保索引有效
    currentIndex = Math.max(0, Math.min(currentIndex, this.data.length - 1));
    
    console.log('⏰ 当前时间:', currentHour + ':' + currentMinute, '(' + currentTotalMinutes + '分钟)');
    console.log('⏰ 当前索引:', currentIndex, '时间:', this.data[currentIndex]?.time, '价格:', this.data[currentIndex]?.price);

    const prices = this.data.map(d => d.price);
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    
    // 以昨收价为中心对称计算价格范围
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
    
    // 昨收价 Y 坐标（0 轴位置）
    const prevCloseY = yScale(this.prevClose);

    // 1. 绘制网格和刻度
    this.drawGrid(padding, chartWidth, priceChartHeight, displayMin, displayMax, yScale);

    // 2. 绘制昨收价线（0 轴）
    this.drawPrevCloseLine(padding, chartWidth, prevCloseY);

    // 3. 绘制均价线
    const avgY = yScale(this.stats.avgPrice);
    this.drawAvgLine(padding, chartWidth, avgY);

    // 4. 绘制填充区域（只到当前时间）
    this.drawAreaFill(xScale, yScale, prevCloseY, currentIndex);

    // 5. 绘制盘后数据
    if (this.afterHoursData?.length > 0) {
      this.drawAfterHoursData(xScale, yScale, this.stats.close);
    }

    // 6. 绘制统计信息（顶部）
    this.drawStats(padding.left, padding.top, chartWidth);

    // 7. 绘制成交量（红涨绿跌）
    const volumeYBase = padding.top + priceChartHeight;
    this.drawVolumeBar(padding, chartWidth, volumeHeight, volumeYBase);

    // 8. 绘制时间轴（底部）
    this.drawTimeAxis(padding, chartWidth, volumeYBase + volumeHeight);
  },

  drawGrid(padding, chartWidth, priceChartHeight, priceMin, priceMax, yScale) {
    this.ctx.strokeStyle = '#30363d';
    this.ctx.lineWidth = 0.5;

    const lines = 5;
    for (let i = 0; i <= lines; i++) {
      const y = padding.top + (i / lines) * priceChartHeight;
      
      this.ctx.beginPath();
      this.ctx.moveTo(padding.left, y);
      this.ctx.lineTo(padding.left + chartWidth, y);
      this.ctx.stroke();

      const price = priceMax - (i / lines) * (priceMax - priceMin);
      const isAbovePrevClose = price >= this.prevClose;
      
      // 左侧价格标签
      this.ctx.fillStyle = isAbovePrevClose ? '#ff4d4f' : '#52c41a';
      this.ctx.font = '11px Arial';
      this.ctx.textAlign = 'right';
      this.ctx.fillText(price.toFixed(2), padding.left - 5, y + 4);
      
      // 右侧涨跌幅%标签
      const changePercent = ((price - this.prevClose) / this.prevClose) * 100;
      const sign = changePercent >= 0 ? '+' : '';
      this.ctx.fillStyle = changePercent >= 0 ? '#ff4d4f' : '#52c41a';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(sign + changePercent.toFixed(2) + '%', padding.left + chartWidth + 5, y + 4);
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

    this.ctx.fillStyle = '#1890ff';
    this.ctx.font = '11px Arial';
    this.ctx.textAlign = 'right';
    this.ctx.fillText('均价 ' + this.stats.avgPrice.toFixed(2), padding.left - 5, y - 5);
  },

  drawAreaFill(xScale, yScale, prevCloseY, currentIndex) {
    const currentPrice = this.data[currentIndex].price;
    const isUp = currentPrice >= this.prevClose;
    const lineColor = isUp ? '#ff4d4f' : '#52c41a';

    // 绘制价格曲线（只到当前时间）
    this.ctx.beginPath();
    this.ctx.moveTo(xScale(0), yScale(this.data[0].price));
    for (let i = 1; i <= currentIndex; i++) {
      this.ctx.lineTo(xScale(i), yScale(this.data[i].price));
    }
    this.ctx.strokeStyle = lineColor;
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    // 填充区域（只到当前时间）- 整体填充，根据整体涨跌决定颜色
    this.ctx.beginPath();
    this.ctx.moveTo(xScale(0), prevCloseY);
    for (let i = 0; i <= currentIndex; i++) {
      this.ctx.lineTo(xScale(i), yScale(this.data[i].price));
    }
    this.ctx.lineTo(xScale(currentIndex), prevCloseY);
    this.ctx.closePath();
    
    // 根据整体涨跌决定填充颜色
    if (isUp) {
      this.ctx.fillStyle = 'rgba(255, 77, 79, 0.3)';  // 红色填充，30% 不透明度
    } else {
      this.ctx.fillStyle = 'rgba(82, 196, 26, 0.3)';  // 绿色填充，30% 不透明度
    }
    this.ctx.fill();
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

    this.ctx.font = '11px Arial';
    this.ctx.textAlign = 'left';
    
    // 第一行：开、高、低、收
    this.ctx.fillStyle = '#8b949e';
    this.ctx.fillText(`开 ${this.stats.open.toFixed(2)}`, x, y - 10);
    this.ctx.fillText(`高 ${this.stats.high.toFixed(2)}`, x + chartWidth / 4, y - 10);
    this.ctx.fillText(`低 ${this.stats.low.toFixed(2)}`, x + chartWidth / 2, y - 10);
    this.ctx.fillText(`收 ${this.stats.close.toFixed(2)}`, x + chartWidth * 3/4, y - 10);
    
    // 第二行：涨跌、涨幅、成交量、成交额
    this.ctx.fillStyle = color;
    this.ctx.font = 'bold 12px Arial';
    this.ctx.fillText(`${sign}${change.toFixed(2)}`, x, y + 8);
    this.ctx.fillText(`${sign}${changePercent.toFixed(2)}%`, x + chartWidth / 4, y + 8);
    
    // 计算成交量和成交额
    const totalVolume = this.data.reduce((sum, d) => sum + (d.volume || 0), 0);
    const totalAmount = this.data.reduce((sum, d) => sum + d.price * (d.volume || 0), 0);
    const volumeText = totalVolume > 1e8 ? (totalVolume / 1e8).toFixed(2) + '亿手' : 
                       totalVolume > 1e4 ? (totalVolume / 1e4).toFixed(2) + '万手' : totalVolume.toFixed(0) + '手';
    const amountText = totalAmount > 1e8 ? (totalAmount / 1e8).toFixed(2) + '亿' : 
                       totalAmount > 1e4 ? (totalAmount / 1e4).toFixed(2) + '万' : totalAmount.toFixed(0);
    
    this.ctx.fillStyle = '#8b949e';
    this.ctx.font = '11px Arial';
    this.ctx.fillText(`量 ${volumeText}`, x + chartWidth / 2, y + 8);
    this.ctx.fillText(`额 ${amountText}`, x + chartWidth * 3/4, y + 8);
    
    // 右侧：振幅
    const amplitude = ((this.stats.high - this.stats.low) / this.prevClose) * 100;
    this.ctx.fillStyle = '#8b949e';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`振幅 ${amplitude.toFixed(2)}%`, x + chartWidth, y + 8);
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
      const isUp = price >= this.prevClose;
      
      // 成交量柱状图颜色：红涨绿跌，使用实心颜色
      this.ctx.fillStyle = isUp ? '#ff4d4f' : '#52c41a';
      this.ctx.fillRect(x, y, barWidth, barHeight);
    }

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
    const targetMinutes = h * 60 + m;
    for (let i = 0; i < this.data.length; i++) {
      const [hh, mm] = this.data[i].time.split(':').map(Number);
      if (hh * 60 + mm >= targetMinutes) return i;
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

window.IntradayChart = IntradayChart;
