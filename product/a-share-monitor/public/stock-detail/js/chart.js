/**
 * 分时走势图渲染
 * 使用 Canvas 绘制简单的分时图
 */

const Chart = {
  canvas: null,
  ctx: null,
  data: null,
  prevClose: 0,

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
    const width = container.clientWidth - 20;
    const height = 280;
    
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

    this.data = responseData.data;
    this.prevClose = responseData.prevClose || this.data[0]?.prevClose || 0;
    
    this.draw();
  },

  /**
   * 绘制图表
   */
  draw() {
    if (!this.ctx || !this.data) return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    const padding = { top: 30, right: 60, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // 清空画布
    this.ctx.clearRect(0, 0, width, height);

    // 获取价格范围
    const prices = this.data.map(d => d.price);
    const maxPrice = Math.max(...prices, this.prevClose);
    const minPrice = Math.min(...prices, this.prevClose);
    const priceRange = maxPrice - minPrice;
    const pricePadding = priceRange * 0.1 || 0.1;

    // 计算坐标转换函数
    const xScale = (i) => padding.left + (i / (this.data.length - 1)) * chartWidth;
    const yScale = (price) => {
      const range = (maxPrice + pricePadding) - (minPrice - pricePadding);
      return padding.top + chartHeight - ((price - (minPrice - pricePadding)) / range) * chartHeight;
    };

    // 绘制背景网格
    this.drawGrid(padding, chartWidth, chartHeight, maxPrice + pricePadding, minPrice - pricePadding);

    // 绘制昨收价参考线
    this.drawBaseline(padding, chartWidth, yScale(this.prevClose), this.prevClose);

    // 绘制价格曲线
    this.drawPriceLine(xScale, yScale);

    // 绘制成交量柱状图（底部）
    this.drawVolumeBar(padding, chartWidth, chartHeight);

    // 绘制时间轴标签
    this.drawTimeAxis(padding, chartWidth, height);
  },

  /**
   * 绘制网格
   */
  drawGrid(padding, chartWidth, chartHeight, maxPrice, minPrice) {
    this.ctx.strokeStyle = '#30363d';
    this.ctx.lineWidth = 0.5;

    // 横线（价格）
    const priceLines = 5;
    for (let i = 0; i <= priceLines; i++) {
      const y = padding.top + (i / priceLines) * chartHeight;
      this.ctx.beginPath();
      this.ctx.moveTo(padding.left, y);
      this.ctx.lineTo(padding.left + chartWidth, y);
      this.ctx.stroke();

      // 价格标签
      const price = maxPrice - (i / priceLines) * (maxPrice - minPrice);
      this.ctx.fillStyle = '#8b949e';
      this.ctx.font = '11px Arial';
      this.ctx.textAlign = 'right';
      this.ctx.fillText(price.toFixed(2), padding.left - 5, y + 4);
    }

    // 竖线（时间）
    const timeLines = 4;
    for (let i = 0; i <= timeLines; i++) {
      const x = padding.left + (i / timeLines) * chartWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(x, padding.top);
      this.ctx.lineTo(x, padding.top + chartHeight);
      this.ctx.stroke();
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
    this.ctx.textAlign = 'right';
    this.ctx.fillText(prevClose.toFixed(2), padding.left - 5, y + 4);
  },

  /**
   * 绘制价格曲线
   */
  drawPriceLine(xScale, yScale) {
    // 绘制填充区域
    this.ctx.beginPath();
    this.ctx.moveTo(xScale(0), yScale(this.prevClose));
    
    for (let i = 0; i < this.data.length; i++) {
      this.ctx.lineTo(xScale(i), yScale(this.data[i].price));
    }
    
    this.ctx.lineTo(xScale(this.data.length - 1), yScale(this.prevClose));
    this.ctx.closePath();
    
    // 根据涨跌选择颜色
    const lastPrice = this.data[this.data.length - 1].price;
    if (lastPrice >= this.prevClose) {
      this.ctx.fillStyle = 'rgba(255, 77, 79, 0.1)';  // 红色
    } else {
      this.ctx.fillStyle = 'rgba(82, 196, 26, 0.1)';  // 绿色
    }
    this.ctx.fill();

    // 绘制曲线
    this.ctx.beginPath();
    this.ctx.moveTo(xScale(0), yScale(this.data[0].price));
    
    for (let i = 1; i < this.data.length; i++) {
      this.ctx.lineTo(xScale(i), yScale(this.data[i].price));
    }
    
    this.ctx.strokeStyle = lastPrice >= this.prevClose ? '#ff4d4f' : '#52c41a';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // 绘制当前价格点
    const lastX = xScale(this.data.length - 1);
    const lastY = yScale(lastPrice);
    
    this.ctx.beginPath();
    this.ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    this.ctx.fillStyle = lastPrice >= this.prevClose ? '#ff4d4f' : '#52c41a';
    this.ctx.fill();
    
    // 当前价格标签
    this.ctx.fillStyle = lastPrice >= this.prevClose ? '#ff4d4f' : '#52c41a';
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(lastPrice.toFixed(2), lastX + 10, lastY);
  },

  /**
   * 绘制成交量柱状图
   */
  drawVolumeBar(padding, chartWidth, chartHeight) {
    const volumeHeight = 50;
    const volumes = this.data.map(d => d.volume || 0);
    const maxVolume = Math.max(...volumes) || 1;

    const barWidth = chartWidth / this.data.length * 0.8;
    const yBase = padding.top + chartHeight + 10;

    for (let i = 0; i < this.data.length; i++) {
      const x = padding.left + (i / (this.data.length - 1)) * chartWidth - barWidth / 2;
      const barHeight = (volumes[i] / maxVolume) * volumeHeight;
      const y = yBase + volumeHeight - barHeight;

      // 根据涨跌选择颜色
      const price = this.data[i].price;
      if (price >= this.prevClose) {
        this.ctx.fillStyle = 'rgba(255, 77, 79, 0.6)';
      } else {
        this.ctx.fillStyle = 'rgba(82, 196, 26, 0.6)';
      }

      this.ctx.fillRect(x, y, barWidth, barHeight);
    }
  },

  /**
   * 绘制时间轴标签
   */
  drawTimeAxis(padding, chartWidth, height) {
    const timeLabels = ['09:30', '11:30', '13:00', '15:00'];
    
    this.ctx.fillStyle = '#8b949e';
    this.ctx.font = '11px Arial';
    this.ctx.textAlign = 'center';

    for (let i = 0; i < timeLabels.length; i++) {
      const x = padding.left + (i / (timeLabels.length - 1)) * chartWidth;
      this.ctx.fillText(timeLabels[i], x, height - 10);
    }
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