/**
 * 定时任务管理页面
 * 支持任务的增删改查和执行
 */

// 页面状态
const state = {
  tasks: [],
  logs: []
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadTasks();
  initEvents();
});

// 事件绑定
function initEvents() {
  // 新增任务按钮
  document.getElementById('btn-add-task').addEventListener('click', () => openModal());
  
  // 模态框关闭
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('task-modal').addEventListener('click', (e) => {
    if (e.target.id === 'task-modal') closeModal();
  });
  
  // 保存任务
  document.getElementById('btn-save').addEventListener('click', saveTask);
  
  // Cron 表达式预览
  document.getElementById('task-cron').addEventListener('input', updateCronPreview);
}

// 加载任务列表
async function loadTasks() {
  try {
    const response = await fetch('/api/scheduled-tasks');
    const result = await response.json();
    
    if (result.success) {
      state.tasks = result.data || [];
      renderTasks();
    }
  } catch (error) {
    console.error('加载任务失败:', error);
  }
}

// 渲染任务列表
function renderTasks() {
  const tbody = document.getElementById('tasks-table-body');
  
  if (state.tasks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading">暂无任务，点击"新增任务"添加</td></tr>';
    return;
  }
  
  tbody.innerHTML = state.tasks.map(task => {
    const typeNames = {
      'sync-securities': '📊 证券同步',
      'sync-stock-data': '📈 股票行情',
      'clear-cache': '🧹 清理缓存',
      'backup-db': '💾 备份数据库'
    };
    const typeName = typeNames[task.type] || task.type;
    
    return `
    <tr>
      <td><strong>${task.name}</strong></td>
      <td>${typeName}</td>
      <td>${formatCron(task.cron)}</td>
      <td><code>${task.cron}</code></td>
      <td>${task.lastRun ? new Date(task.lastRun).toLocaleString('zh-CN') : '--'}</td>
      <td><span class="status-badge ${task.status === 1 ? 'active' : 'inactive'}">${task.status === 1 ? '✓ 启用' : '✗ 停用'}</span></td>
      <td>
        <button class="btn-sm btn-success" onclick="runTask('${task.id}')" title="立即执行">▶</button>
        <button class="btn-sm" onclick="editTask('${task.id}')" title="编辑">✏️</button>
        <button class="btn-sm btn-danger" onclick="deleteTask('${task.id}')" title="删除">🗑️</button>
      </td>
    </tr>
  `}).join('');
}

// 打开模态框
function openModal(task = null) {
  const modal = document.getElementById('task-modal');
  const title = document.getElementById('modal-title');
  const form = document.getElementById('task-form');
  
  form.reset();
  
  if (task) {
    title.textContent = '编辑任务';
    document.getElementById('task-id').value = task.id;
    document.getElementById('task-name').value = task.name;
    // 任务类型下拉框只有一个选项，直接设置
    document.getElementById('task-type').value = 'sync-securities';
    document.getElementById('task-cron').value = task.cron;
    document.getElementById('task-status').value = task.status;
  } else {
    title.textContent = '新增任务';
    document.getElementById('task-id').value = '';
    // 默认设置为证券同步
    document.getElementById('task-type').value = 'sync-securities';
  }
  
  modal.style.display = 'flex';
  modal.classList.add('active');
  updateCronPreview();
}

// 关闭模态框
function closeModal() {
  const modal = document.getElementById('task-modal');
  modal.classList.remove('active');
  modal.style.display = 'none';
}

// 保存任务
async function saveTask() {
  const taskId = document.getElementById('task-id').value;
  const taskData = {
    name: document.getElementById('task-name').value.trim(),
    type: 'sync-securities',  // 固定为证券同步类型
    cron: document.getElementById('task-cron').value.trim(),
    status: parseInt(document.getElementById('task-status').value)
  };
  
  if (!taskData.name || !taskData.cron) {
    alert('请填写完整信息');
    return;
  }
  
  try {
    const url = taskId ? `/api/scheduled-tasks/${taskId}` : '/api/scheduled-tasks';
    const method = taskId ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskData)
    });
    
    const result = await response.json();
    
    if (result.success) {
      closeModal();
      loadTasks();
      addLog(taskId ? '任务已更新' : '任务已创建', 'success');
    } else {
      alert(result.message || '保存失败');
    }
  } catch (error) {
    alert('保存失败: ' + error.message);
  }
}

// 编辑任务
function editTask(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (task) {
    openModal(task);
  }
}

// 删除任务
async function deleteTask(taskId) {
  if (!confirm('确定要删除此任务吗？')) return;
  
  try {
    const response = await fetch(`/api/scheduled-tasks/${taskId}`, { method: 'DELETE' });
    const result = await response.json();
    
    if (result.success) {
      loadTasks();
      addLog('任务已删除', 'info');
    }
  } catch (error) {
    alert('删除失败: ' + error.message);
  }
}

// 立即执行任务
async function runTask(taskId) {
  try {
    const response = await fetch(`/api/scheduled-tasks/${taskId}/run`, { method: 'POST' });
    const result = await response.json();
    
    if (result.success) {
      addLog(`✅ 任务 [${taskId}] 执行成功`, 'success');
      setTimeout(loadTasks, 2000);
    } else {
      addLog(`❌ 任务❌ 执行失败: ${result.message}`, 'error');
    }
  } catch (error) {
    addLog('❌ 执行失败: ' + error.message, 'error');
  }
}

// 更新 Cron 预览
function updateCronPreview() {
  const cron = document.getElementById('task-cron').value;
  const preview = document.getElementById('cron-preview');
  
  if (!cron) {
    preview.textContent = '--';
    return;
  }
  
  // 简单解析 Cron 表达式
  const parts = cron.split(' ');
  if (parts.length >= 5) {
    const [min, hour, day, month, weekday] = parts.slice(-5);
    let desc = '';
    
    if (min === '0' && hour === '6' && day === '*' && month === '*') {
      desc = '每天 06:00 执行';
    } else if (min === '0' && hour === '*' && day === '*') {
      desc = '每小时执行一次';
    } else if (min === '0' && hour.includes(',')) {
      desc = `每天 ${hour.split(',').map(h => `${h}:00`).join(', ')} 执行`;
    } else {
      desc = `Cron: ${cron}`;
    }
    
    preview.textContent = desc;
  } else {
    preview.textContent = '格式错误';
  }
}

// 格式化 Cron 显示
function formatCron(cron) {
  const parts = cron.split(' ');
  if (parts.length >= 5) {
    const [min, hour, day, month, weekday] = parts.slice(-5);
    if (min === '0' && hour === '6' && day === '*' && month === '*') return '每天 06:00';
    if (min === '0' && hour === '*' && day === '*') return '每小时';
    if (min === '30' && hour === '9' && day === '*') return '每天 09:30';
    return cron;
  }
  return cron;
}

// 添加日志
function addLog(message, type = 'info') {
  const container = document.getElementById('logs-container');
  const now = new Date().toLocaleString('zh-CN');
  
  const logItem = document.createElement('div');
  logItem.className = `log-item log-${type}`;
  logItem.innerHTML = `<span class="log-time">${now}</span><span class="log-message">${message}</span>`;
  
  container.insertBefore(logItem, container.firstChild);
  
  // 保留最近 50 条
  while (container.children.length > 50) {
    container.removeChild(container.lastChild);
  }
}