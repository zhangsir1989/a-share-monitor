/**
 * 分时走势图渲染 - 正确逻辑版
 * 时间轴：9:30 开始，15:00 结束
 * 根据 API 返回的数据，找出每个时间点对应的价格，连线绘制
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
    
    console.log('📊 分时图数据:', this.data.length, '个点');
    console.log('📊 第一个点:', this.data[0]?.time, this.data[0]?.price);
    console.log('📊 最后一个点:', this.data[this.data.length - 1]?.time, this.data[this.data.length - 1]?.price);
    console.log('📊 昨收价:', this.prevClose);
    
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
    
    // 布局：价格图 (315px) + 成交量 (135px) = 450px
    const padding = { top: 30, right: 60, bottom: 25, left: 55 };
    const chartWidth = width - padding.left - padding.right;
    const priceChartHeight = 315;
    const volumeHeight = 135;

    this.ctx.clearRect(0, 0, width, height);

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

    // 坐标转换函数：根据数据索引计算 x 坐标，根据价格计算 y 坐标
    const xScale = (i) => padding.left + (i / (this.data.length - 1)) * chartWidth;
    const yScale = (price) => {
      const range = displayMax - displayMin || 0.01;
      return padding.top + priceChartHeight - ((price - displayMin) / range) * priceChartHeight;
    };

    // 1. 绘制网格和刻度
    this.drawGrid(padding, chartWidth, priceChartHeight, displayMin, displayMax, yScale);

    // 2. 绘制昨收价线（0 轴）
    const prevCloseY = yScale(this.prevClose);
    this.drawPrevCloseLine(padding, chartWidth, prevCloseY);

    // 3. 绘制均价线
    const avgY = yScale(this.stats.avgPrice);
    this.drawAvgLine(padding, chartWidth, avgY);

    // 4. 绘制填充区域（0 轴上方红色，下方绿色）
    this.drawAreaFill(xScale, yScale, prevCloseY);

    // 5. 绘制盘后数据
    if (this.afterHoursData?.length > 0) {
      this.drawAfterHoursData(xScale, yScale, this.stats.close);
    }

    // 6. 绘制统计信息（顶部）
    this.drawStats(padding.left, padding.top, chartWidth);

    // 7. 绘制成交量（红涨绿跌）
    const volumeYBase = padding.top + priceChartHeight + 5;
    this.drawVolumeBar(padding, chartWidth, volumeHeight, volumeYBase);

    // 8. 绘制时间轴（9:30-15:00）
    this.drawTimeAxis(padding, chartWidth, volumeYBase + volumeHeight + 5);
  },

  drawGrid(padding, chartWidth, priceChartHeight, priceMin, priceMax, yScale) {
    this.ctx.strokeStyle = '#30363d';
    this.ctx.lineWidth = 0.5;

    // 绘制 5 条横线（价格刻度），均匀分布
    const lines = 5;
    for (let i = 0; i <= lines; i++) {
      const y = padding.top + (i / lines) * priceChartHeight;
      
      // 横线
      this.ctx.beginPath();
      this.ctx.moveTo(padding.left, y);
      this.ctx.lineTo(padding.left + chartWidth, y);
      this.ctx.stroke();

      // 左侧价格标签（根据相对昨收价位置显示颜色）
      const price = priceMax - (i / lines) * (priceMax - priceMin);
      const isAbovePrevClose = price >= this.prevClose;
      
      this.ctx.fillStyle = isAbovePrevClose ? '#ff4d4f' : '#52c41a';
      this.ctx.font = '11px Arial';
      this.ctx.textAlign = 'right';
      this.ctx.fillText(price.toFixed(2), padding.left - 5, y + 4);

      // 右侧涨跌幅标签
      const change = price - this.prevClose;
      const changePercent = (change / this.prevClose) * 100;
      const sign = change >= 0 ? '+' : '';
      const color = change >= 0 ? '#ff4d4f' : '#52c41a';
      
      this.ctx.fillStyle = color;
      this.ctx.font = '10px Arial';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(`${sign}${changePercent.toFixed(2)}%`, padding.left + chartWidth + 5, y + 4);
    }

    // 竖线（时间）- 根据实际数据中的时间点位置绘制
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
   * 绘制填充区域 - 核心逻辑
   * 遍历每个数据点，根据时间顺序获取价格，判断在 0 轴上方还是下方
   * 0 轴上方填充红色，下方填充绿色
   */
  drawAreaFill(xScale, yScale, prevCloseY) {
    const lastPrice = this.stats.close;
    const isUp = lastPrice >= this.prevClose;
    const lineColor = isUp ? '#ff4d4f' : '#52c41a';

    // 先绘制价格曲线（单色线，根据整体涨跌）
    this.ctx.beginPath();
    this.ctx.moveTo(xScale(0), yScale(this.data[0].price));
    for (let i = 1; i < this.data.length; i++) {
      this.ctx.lineTo(xScale(i), yScale(this.data[i].price));
    }
    this.ctx.strokeStyle = lineColor;
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    // 填充区域：遍历每个线段，判断在 0 轴上方还是下方
    for (let i = 0; i < this.data.length - 1; i++) {
      const price1 = this.data[i].price;
      const price2 = this.data[i + 1].price;
      const x1 = xScale(i);
      const x2 = xScale(i + 1);
      const y1 = yScale(price1);
      const y2 = yScale(price2);

      // 判断这个线段是在 0 轴上方还是下方
      const isAbove1 = price1 >= this.prevClose;
      const isAbove2 = price2 >= this.prevClose;

      if (isAbove1 && isAbove2) {
        // 整个线段在 0 轴上方，填充红色
        this.ctx.beginPath();
        this.ctx.moveTo(x1, prevCloseY);
        this.ctx.lineTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.lineTo(x2, prevCloseY);
        this.ctx.closePath();
        this.ctx.fillStyle = 'rgba(255, 77, 79, 0.15)';
        this.ctx.fill();
      } else if (!isAbove1 && !isAbove2) {
        // 整个线段在 0 轴下方，填充绿色
        this.ctx.beginPath();
        this.ctx.moveTo(x1, prevCloseY);
        this.ctx.lineTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.lineTo(x2, prevCloseY);
        this.ctx.closePath();
        this.ctx.fillStyle = 'rgba(82, 196, 26, 0.15)';
        this.ctx.fill();
      } else {
        // 线段跨越 0 轴，需要分割
        const intersectX = x1 + (x2 - x1) * (this.prevClose - price1) / (price2 - price1);
        const intersectY = prevCloseY;

        if (isAbove1) {
          // 上方部分（红色）
          this.ctx.beginPath();
          this.ctx.moveTo(x1, prevCloseY);
          this.ctx.lineTo(x1, y1);
          this.ctx.lineTo(intersectX, intersectY);
          this.ctx.closePath();
          this.ctx.fillStyle = 'rgba(255, 77, 79, 0.15)';
          this.ctx.fill();

          // 下方部分（绿色）
          this.ctx.beginPath();
          this.ctx.moveTo(intersectX, prevCloseY);
          this.ctx.lineTo(x2, y2);
          this.ctx.lineTo(x2, prevCloseY);
          this.ctx.closePath();
          this.ctx.fillStyle = 'rgba(82, 196, 26, 0.15)';
          this.ctx.fill();
        } else {
          // 下方部分（绿色）
          this.ctx.beginPath();
          this.ctx.moveTo(x1, prevCloseY);
          this.ctx.lineTo(x1, y1);
          this.ctx.lineTo(intersectX, intersectY);
          this.ctx.closePath();
          this.ctx.fillStyle = 'rgba(82, 196, 26, 0.15)';
          this.ctx.fill();

          // 上方部分（红色）
          this.ctx.beginPath();
          this.ctx.moveTo(intersectX, prevCloseY);
          this.ctx.lineTo(x2, y2);
          this.ctx.lineTo(x2, prevCloseY);
          this.ctx.closePath();
          this.ctx.fillStyle = 'rgba(255, 77, 79, 0.15)';
          this.ctx.fill();
        }
      }
    }
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
    
    // 第一行：开、高
    this.ctx.fillStyle = '#8b949e';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`开 ${this.stats.open.toFixed(2)}`, x, y - 10);
    this.ctx.fillText(`高 ${this.stats.high.toFixed(2)}`, x + chartWidth / 2 - 30, y - 10);
    
    // 第二行：低、收
    this.ctx.fillText(`低 ${this.stats.low.toFixed(2)}`, x, y + 5);
    this.ctx.fillText(`收 ${this.stats.close.toFixed(2)}`, x + chartWidth / 2 - 30, y + 5);
    
    // 涨跌幅在右上角
    this.ctx.fillStyle = color;
    this.ctx.font = 'bold 13px Arial';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`${sign}${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)`, x + chartWidth, y - 10);
  },

  /**
   * 绘制成交量柱状图 - 红涨绿跌
   */
  drawVolumeBar(padding, chartWidth, volumeHeight, yBase) {
    const volumes = this.data.map(d => d.volume || 0);
    const maxVolume = Math.max(...volumes) || 1;
    const barWidth = Math.max(1, chartWidth / this.data.length * 0.8);

    for (let i = 0; i < this.data.length; i++) {
      const x = padding.left + (i / (this.data.length - 1)) * chartWidth - barWidth / 2;
      const barHeight = (volumes[i] / maxVolume) * volumeHeight;
      const y = yBase + volumeHeight - barHeight;

      // 颜色根据该时刻价格相对昨收的涨跌
      const price = this.data[i].price;
      const isUp = price >= this.prevClose;
      
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
    // 时间轴：9:30 开始，15:00 结束
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

  /**
   * 找出指定时间在数据中的索引位置
   * 通过遍历数据，找到 time 字段匹配的时间点
   */
  findTimeIndex(targetTime) {
    // 精确匹配
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
