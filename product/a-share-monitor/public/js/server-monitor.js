/**
 * 服务器监控页面逻辑
 * 管理员专用：实时监控服务器资源使用情况
 */

// 页面状态
const pageState = {
  refreshTimer: null,
  refreshInterval: 5000  // 5 秒刷新
};

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', () => {
  // sidebar.js 已处理 initSubSidebar，这里只需初始化刷新和加载数据
  initRefresh();
  loadServerData();
});

// ==================== 刷新功能 ====================

function initRefresh() {
  document.getElementById('btn-refresh').addEventListener('click', loadServerData);
  
  // 自动刷新
  pageState.refreshTimer = setInterval(loadServerData, pageState.refreshInterval);
}

// ==================== 加载服务器数据 ====================

async function loadServerData() {
  try {
    const response = await fetch('/api/admin/server-monitor');
    const result = await response.json();
    
    if (!result.success) {
      alert(result.message || '加载失败');
      return;
    }
    
    const data = result.data;
    
    // 更新系统信息
    document.getElementById('sys-hostname').textContent = data.system.hostname;
    document.getElementById('sys-platform').textContent = `${data.system.platform} (${data.system.arch})`;
    document.getElementById('sys-uptime').textContent = data.system.uptimeStr;
    document.getElementById('sys-processes').textContent = data.processCount;
    
    // 更新 CPU
    document.getElementById('cpu-usage').textContent = `${data.cpu.usage}%`;
    document.getElementById('cpu-model').textContent = data.cpu.model.length > 25 ? data.cpu.model.substring(0, 25) + '...' : data.cpu.model;
    document.getElementById('cpu-cores').textContent = data.cpu.cores;
    document.getElementById('cpu-load').textContent = data.cpu.loadAvg.map(v => v.toFixed(2)).join(' / ');
    drawGauge('cpu-gauge', data.cpu.usage);
    
    // 更新内存
    document.getElementById('mem-usage').textContent = `${data.memory.usage}%`;
    document.getElementById('mem-total').textContent = formatBytes(data.memory.total);
    document.getElementById('mem-used').textContent = formatBytes(data.memory.used);
    document.getElementById('mem-free').textContent = formatBytes(data.memory.free);
    drawGauge('mem-gauge', data.memory.usage);
    
    // 更新磁盘
    document.getElementById('disk-usage').textContent = `${data.disk.usage}%`;
    document.getElementById('disk-total').textContent = formatBytes(data.disk.total);
    document.getElementById('disk-used').textContent = formatBytes(data.disk.used);
    document.getElementById('disk-free').textContent = formatBytes(data.disk.free);
    drawGauge('disk-gauge', data.disk.usage);
    
    // 更新网络
    renderNetworkList(data.network);
    
    // 更新时间
    document.getElementById('last-update').textContent = new Date().toLocaleString('zh-CN');
    
  } catch (error) {
    console.error('加载服务器数据失败:', error);
  }
}

// ==================== 仪表盘绘制 ====================

function drawGauge(canvasId, percentage) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = canvas.width / 2 - 10;
  
  // 清空画布
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 背景圆弧（灰色）
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, 2.25 * Math.PI);
  ctx.lineWidth = 15;
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineCap = 'round';
  ctx.stroke();
  
  // 进度圆弧（根据百分比变色）
  const startAngle = 0.75 * Math.PI;
  const endAngle = startAngle + (1.5 * Math.PI * percentage / 100);
  
  let gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  if (percentage < 50) {
    gradient.addColorStop(0, '#4caf50');
    gradient.addColorStop(1, '#8bc34a');
  } else if (percentage < 80) {
    gradient.addColorStop(0, '#ff9800');
    gradient.addColorStop(1, '#ffc107');
  } else {
    gradient.addColorStop(0, '#f44336');
    gradient.addColorStop(1, '#ff5722');
  }
  
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, startAngle, endAngle);
  ctx.lineWidth = 15;
  ctx.strokeStyle = gradient;
  ctx.lineCap = 'round';
  ctx.stroke();
}

// ==================== 网络列表渲染 ====================

function renderNetworkList(network) {
  const container = document.getElementById('network-list');
  
  if (!network || network.length === 0) {
    container.innerHTML = '<div class="loading">暂无网络接口</div>';
    return;
  }
  
  container.innerHTML = network.map(iface => `
    <div class="network-item">
      <span class="network-name">📡 ${iface.name}</span>
      <span class="network-address">${iface.address}</span>
    </div>
  `).join('');
}

// ==================== 格式化字节 ====================

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
}
