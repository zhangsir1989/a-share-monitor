/**
 * 自选股分组管理逻辑
 * 功能：创建/编辑/删除分组，管理股票分组归属，按分组筛选
 * 独立模块，不影响原有自选股功能
 */

// 分组管理状态
const GroupManager = {
  groups: [],  // 分组列表 [{id, name, icon, color, createdAt}]
  stockGroups: {},  // 股票 - 分组映射 {code: type}（type=分组 type）
  currentFilter: 1,  // 当前筛选的分组 type，1=默认自选股
  currentType: 1,  // 当前选中的分组 type（用于添加股票）
  elements: {}
};

// ==================== 初始化 ====================

function initGroupManager() {
  console.log('📁 初始化分组管理器...');
  
  // 初始化 DOM 元素
  GroupManager.elements = {
    groupManagerBtn: document.getElementById('group-manager-btn'),
    groupDropdown: document.getElementById('group-dropdown'),
    groupFilterSelect: document.getElementById('group-filter-select'),
    createGroupInput: document.getElementById('create-group-input'),
    createGroupBtn: document.getElementById('create-group-btn'),
    groupList: document.getElementById('group-list'),
    stockCountLabel: document.getElementById('stock-count-label')
  };
  
  // 从数据库加载分组
  loadGroups();
  
  // 绑定事件
  bindGroupEvents();
}

// ==================== 分组数据管理 ====================

async function loadGroups() {
  try {
    const response = await fetch('/api/custom-groups/list');
    const result = await response.json();
    
    if (result.success) {
      GroupManager.groups = result.data.groups || [];
      GroupManager.stockGroups = result.data.stockGroups || {};  // {code: type}
      console.log('📁 加载分组:', GroupManager.groups.length, '个');
      renderGroupDropdown();
      renderGroupFilter();
      renderGroupTabs();  // 渲染分组标签
      
      // 重新渲染股票列表，确保显示分组选择器
      if (typeof updateStockList === 'function') {
        updateStockList();
      }
    }
  } catch (error) {
    console.error('加载分组失败:', error);
  }
}

async function saveGroup(name, icon = '📁', color = '#4a9eff') {
  try {
    const response = await fetch('/api/custom-groups/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, icon, color })
    });
    const result = await response.json();
    
    if (result.success) {
      await loadGroups();
      showToast(`分组 "${name}" 创建成功`, 'success');
      return result.data;
    } else {
      showToast(result.message || '创建失败', 'error');
      return null;
    }
  } catch (error) {
    console.error('创建分组失败:', error);
    showToast('网络错误', 'error');
    return null;
  }
}

async function updateGroup(groupId, name, icon, color) {
  try {
    const response = await fetch('/api/custom-groups/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: groupId, name, icon, color })
    });
    const result = await response.json();
    
    if (result.success) {
      await loadGroups();
      showToast('分组更新成功', 'success');
      return true;
    } else {
      showToast(result.message || '更新失败', 'error');
      return false;
    }
  } catch (error) {
    console.error('更新分组失败:', error);
    showToast('网络错误', 'error');
    return false;
  }
}

async function deleteGroup(groupId) {
  if (!confirm('⚠️ 确定要删除这个分组吗？\n\n删除后：\n- 该分组下的所有股票将被删除\n- 此操作不可恢复')) {
    return false;
  }
  
  try {
    const response = await fetch('/api/custom-groups/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: groupId })
    });
    const result = await response.json();
    
    if (result.success) {
      await loadGroups();
      // 如果在自选股页面，刷新股票列表
      if (typeof loadStocks === 'function') {
        await loadStocks(1);
      }
      showToast('分组删除成功，股票已回归默认自选股', 'success');
      return true;
    } else {
      showToast(result.message || '删除失败', 'error');
      return false;
    }
  } catch (error) {
    console.error('删除分组失败:', error);
    showToast('网络错误', 'error');
    return false;
  }
}

// 按 type 删除分组（用于快速筛选按钮）
async function deleteGroupByType(groupType) {
  if (groupType === 1) {
    showToast('不能删除默认自选股分组', 'error');
    return false;
  }
  
  if (!confirm('⚠️ 确定要删除这个分组吗？\n\n删除后：\n- 该分组下的所有股票将被删除\n- 此操作不可恢复')) {
    return false;
  }
  
  try {
    // 先根据 type 找到分组 id
    const group = GroupManager.groups.find(g => g.type === groupType);
    if (!group) {
      showToast('分组不存在', 'error');
      return false;
    }
    
    const response = await fetch('/api/custom-groups/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: group.id })
    });
    const result = await response.json();
    
    if (result.success) {
      await loadGroups();
      // 如果在自选股页面，刷新股票列表
      if (typeof loadStocks === 'function') {
        await loadStocks(1);
      }
      showToast('分组删除成功，股票已回归默认自选股', 'success');
      return true;
    } else {
      showToast(result.message || '删除失败', 'error');
      return false;
    }
  } catch (error) {
    console.error('删除分组失败:', error);
    showToast('网络错误', 'error');
    return false;
  }
}

async function assignStockToGroup(code, groupId) {
  try {
    const response = await fetch('/api/custom-groups/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, groupId })
    });
    const result = await response.json();
    
    if (result.success) {
      await loadGroups();
      return true;
    } else {
      showToast(result.message || '分配失败', 'error');
      return false;
    }
  } catch (error) {
    console.error('分配分组失败:', error);
    showToast('网络错误', 'error');
    return false;
  }
}

async function removeStockFromGroup(code, groupId) {
  try {
    const response = await fetch('/api/custom-groups/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, groupId })
    });
    const result = await response.json();
    
    if (result.success) {
      await loadGroups();
      return true;
    } else {
      showToast(result.message || '移除失败', 'error');
      return false;
    }
  } catch (error) {
    console.error('移除分组失败:', error);
    return false;
  }
}

// ==================== UI 渲染 ====================

function renderGroupDropdown() {
  const btn = GroupManager.elements.groupManagerBtn;
  const dropdown = GroupManager.elements.groupDropdown;
  
  if (!btn || !dropdown) return;
  
  // 更新按钮计数
  const totalGroups = GroupManager.groups.length;
  btn.innerHTML = `📁 分组管理 (${totalGroups})`;
  
  // 渲染下拉列表
  dropdown.innerHTML = `
    <div class="group-dropdown-header">
      <h4>我的分组</h4>
      <button class="btn-create-group" id="btn-create-group">➕ 新建分组</button>
    </div>
    
    <div class="group-dropdown-content">
      <div class="group-filter-section">
        <label>快速筛选：</label>
        <div class="group-filter-buttons" id="group-filter-buttons">
          <button class="group-filter-btn active" data-group="1">📁 我的自选股 (${pageState.stocks.filter(s => (GroupManager.stockGroups[s.code] || 1) === 1).length})</button>
          ${GroupManager.groups.filter(g => g.type !== 1).map(g => {
            const count = pageState.stocks.filter(s => (GroupManager.stockGroups[s.code] || 1) === g.type).length;
            return `<button class="group-filter-btn" data-group="${g.type}">${g.icon} ${g.name} (${count})</button>`;
          }).join('')}
        </div>
      </div>
      
      <div class="group-list-section">
        <h5>分组列表</h5>
        <div class="group-list" id="group-list-inner">
          ${renderGroupListHTML()}
        </div>
      </div>
    </div>
  `;
  
  // 绑定新建分组按钮事件
  document.getElementById('btn-create-group')?.addEventListener('click', showCreateGroupModal);
  
  // 绑定筛选按钮事件
  document.querySelectorAll('.group-filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.group-filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      filterByGroup(e.target.dataset.group);
    });
  });
  
  // 绑定分组列表事件
  bindGroupListEvents();
}

function renderGroupListHTML() {
  if (GroupManager.groups.length === 0) {
    return '<div class="empty-groups">暂无分组，点击右上角新建</div>';
  }
  
  return GroupManager.groups.map(group => {
    // 计算分组内股票数量（type = group.type）
    const stockCount = Object.keys(GroupManager.stockGroups).filter(code => {
      const type = GroupManager.stockGroups[code] || 1;
      const isInCustomStocks = pageState.stocks.some(s => s.code === code);
      return type === group.type && isInCustomStocks;
    }).length;
    
    return `
      <div class="group-item" data-group-type="${group.type}">
        <div class="group-item-header">
          <span class="group-icon">${group.icon}</span>
          <span class="group-name">${group.name}</span>
          <span class="group-count">${stockCount}</span>
          <div class="group-item-actions">
            <button class="btn-group-action btn-edit" title="编辑">✏️</button>
            <button class="btn-group-action btn-delete" title="删除">🗑️</button>
          </div>
        </div>
        <div class="group-item-stocks" id="group-stocks-${group.type}">
          ${renderGroupStocksHTML(group.type)}
        </div>
      </div>
    `;
  }).join('');
}

function renderGroupStocksHTML(groupType) {
  // 只显示自选股中属于该分组的股票（type = groupType）
  const stocks = pageState.stocks.filter(stock => {
    const type = GroupManager.stockGroups[stock.code] || 1;
    return type === groupType;
  });
  
  if (stocks.length === 0) {
    return '<div class="empty-group-stocks">暂无股票</div>';
  }
  
  return stocks.map(stock => `
    <div class="group-stock-item" data-code="${stock.code}">
      <span class="stock-name">${stock.name}</span>
      <span class="stock-code">${stock.code}</span>
      <button class="btn-remove-stock" title="从分组移除" onclick="removeStockFromGroup('${stock.code}')">❌</button>
    </div>
  `).join('');
}

// ==================== 分组标签页 ====================

function renderGroupTabs() {
  const container = document.getElementById('group-tabs');
  if (!container) {
    console.warn('分组标签容器不存在');
    return;
  }
  
  if (!GroupManager.groups || GroupManager.groups.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  // 计算每个分组的股票数量（使用 stockGroups，包含所有股票）
  const stockCounts = {};
  GroupManager.groups.forEach(g => {
    stockCounts[g.type] = 0;  // 初始化为 0
  });
  
  // 遍历 stockGroups 统计每个分组的股票数
  Object.values(GroupManager.stockGroups || {}).forEach(type => {
    if (stockCounts[type] !== undefined) {
      stockCounts[type]++;
    }
  });
  
  // 渲染分组标签
  container.innerHTML = GroupManager.groups.map(group => {
    const isActive = GroupManager.currentType === group.type;
    return `
      <div class="group-tab ${isActive ? 'active' : ''}" data-type="${group.type}" title="${group.name}">
        <span>${group.icon}</span>
        <span>${group.name}</span>
        <span class="stock-count">${stockCounts[group.type] || 0}</span>
      </div>
    `;
  }).join('');
  
  // 绑定点击事件
  document.querySelectorAll('.group-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const type = parseInt(tab.dataset.type);
      switchGroup(type);
    });
  });
}

// 切换分组
async function switchGroup(type) {
  if (GroupManager.currentType === type) {
    return;  // 已经是当前分组，无需切换
  }
  
  GroupManager.currentType = type;
  GroupManager.currentFilter = type;  // 同步更新 currentFilter，确保筛选逻辑正确
  
  // 重新渲染标签（更新激活状态）
  renderGroupTabs();
  
  // 从后端加载该分组的股票
  if (typeof loadStocks === 'function') {
    await loadStocks(type);
  }
  
  // 更新分组管理按钮的计数
  const groupManagerBtn = document.getElementById('group-manager-btn');
  if (groupManagerBtn) {
    groupManagerBtn.innerHTML = `📁 分组管理 (${GroupManager.groups.length})`;
  }
  
  const groupName = GroupManager.groups.find(g => g.type === type)?.name || '我的自选股';
  console.log('📁 切换到分组:', groupName, '(type=' + type + ', currentFilter=' + GroupManager.currentFilter + ')');
}

// 更新分组标签的股票数量
function updateGroupTabCounts(stocks = []) {
  // 使用 stockGroups 统计每个分组的股票数（不依赖 pageState.stocks）
  const stockCounts = {};
  GroupManager.groups.forEach(g => {
    stockCounts[g.type] = 0;  // 初始化为 0
  });
  
  // 遍历 stockGroups 统计每个分组的股票数
  Object.values(GroupManager.stockGroups || {}).forEach(type => {
    if (stockCounts[type] !== undefined) {
      stockCounts[type]++;
    }
  });
  
  // 更新每个标签的计数
  document.querySelectorAll('.group-tab').forEach(tab => {
    const type = parseInt(tab.dataset.type);
    const countEl = tab.querySelector('.stock-count');
    if (countEl) {
      countEl.textContent = stockCounts[type] || 0;
    }
  });
}

function renderGroupFilter() {
  const select = GroupManager.elements.groupFilterSelect;
  if (!select) return;
  
  select.innerHTML = `
    <option value="1">📁 我的自选股 (${pageState.stocks.filter(s => (GroupManager.stockGroups[s.code] || 1) === 1).length})</option>
    ${GroupManager.groups.filter(g => g.type !== 1).map(g => {
      // 只计算自选股中属于该分组的股票数量（type = g.type）
      const count = pageState.stocks.filter(s => (GroupManager.stockGroups[s.code] || 1) === g.type).length;
      return `<option value="${g.type}">${g.icon} ${g.name} (${count})</option>`;
    }).join('')}
  `;
}

// ==================== 事件绑定 ====================

function bindGroupEvents() {
  // 分组管理按钮点击
  GroupManager.elements.groupManagerBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = GroupManager.elements.groupDropdown;
    const overlay = document.getElementById('group-overlay');
    
    if (dropdown.classList.contains('show')) {
      // 关闭
      dropdown.classList.remove('show');
      overlay?.classList.remove('show');
    } else {
      // 打开
      dropdown.classList.add('show');
      overlay?.classList.add('show');
    }
  });
  
  // 点击遮罩层关闭下拉菜单
  document.getElementById('group-overlay')?.addEventListener('click', () => {
    GroupManager.elements.groupDropdown?.classList.remove('show');
    document.getElementById('group-overlay')?.classList.remove('show');
  });
  
  // 点击其他地方关闭下拉菜单
  document.addEventListener('click', () => {
    GroupManager.elements.groupDropdown?.classList.remove('show');
    document.getElementById('group-overlay')?.classList.remove('show');
  });
  
  // 筛选下拉框变化
  GroupManager.elements.groupFilterSelect?.addEventListener('change', (e) => {
    filterByGroup(e.target.value);
  });
}

function bindGroupListEvents() {
  // 编辑分组
  document.querySelectorAll('.btn-group-action.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const groupType = btn.closest('.group-item').dataset.groupType;
      const group = GroupManager.groups.find(g => g.type === parseInt(groupType));
      if (group) {
        showEditGroupModal(group);
      }
    });
  });
  
  // 删除分组
  document.querySelectorAll('.btn-group-action.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const groupType = btn.closest('.group-item').dataset.groupType;
      deleteGroupByType(parseInt(groupType));
    });
  });
  
  // 从分组移除股票（回归默认分组 type=1）
  document.querySelectorAll('.btn-remove-stock').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const stockCode = btn.closest('.group-stock-item').dataset.code;
      removeStockFromGroup(stockCode);
    });
  });
}

// ==================== 筛选功能 ====================

async function filterByGroup(type) {
  const newType = type === 'all' ? 1 : parseInt(type);
  GroupManager.currentFilter = newType;
  GroupManager.currentType = newType;  // 同步更新 currentType，确保添加股票到正确分组
  
  // 更新 URL 参数（可选，用于刷新后保持筛选状态）
  const url = new URL(window.location);
  if (GroupManager.currentFilter === 1) {
    url.searchParams.delete('group');
  } else {
    url.searchParams.set('group', GroupManager.currentFilter);
  }
  window.history.pushState({}, '', url);
  
  const groupName = GroupManager.groups.find(g => g.type === GroupManager.currentFilter)?.name || '我的自选股';
  console.log('📁 筛选分组:', groupName, '(type=' + GroupManager.currentFilter + ')');
  
  // 重新从数据库加载该分组的股票
  console.log('🔄 切换分组，重新加载股票数据...');
  if (typeof loadStocks === 'function') {
    await loadStocks(newType);
  } else {
    // 如果 loadStocks 不可用，回退到前端筛选
    if (typeof updateStockList === 'function') {
      updateStockList();
    }
  }
}

function getFilteredStocks() {
  if (GroupManager.currentFilter === 1 || GroupManager.currentFilter === 'all') {
    // 显示默认自选股（type=1）
    return pageState.stocks.filter(stock => {
      const type = GroupManager.stockGroups[stock.code] || 1;
      return type === 1;
    });
  }
  
  // 显示指定分组的股票（type = 分组 type）
  return pageState.stocks.filter(stock => {
    const type = GroupManager.stockGroups[stock.code] || 1;
    return type === GroupManager.currentFilter;
  });
}

// ==================== 模态框 ====================

function showCreateGroupModal() {
  const modal = document.createElement('div');
  modal.className = 'group-modal';
  modal.innerHTML = `
    <div class="group-modal-content">
      <h3>新建分组</h3>
      <div class="form-group">
        <label>分组名称：</label>
        <input type="text" id="new-group-name" placeholder="如：AI 算力、半导体、持仓股" maxlength="20">
      </div>
      <div class="form-group">
        <label>分组图标：</label>
        <select id="new-group-icon">
          <option value="📁">📁 文件夹</option>
          <option value="📂">📂 打开文件夹</option>
          <option value="🏷️">🏷️ 标签</option>
          <option value="⭐">⭐ 星标</option>
          <option value="🔥">🔥 热门</option>
          <option value="💎">💎 钻石</option>
          <option value="🚀">🚀 火箭</option>
          <option value="📈">📈 上涨</option>
          <option value="🤖">🤖 AI</option>
          <option value="💻">💻 科技</option>
          <option value="🏦">🏦 金融</option>
          <option value="💊">💊 医药</option>
        </select>
      </div>
      <div class="form-group">
        <label>分组颜色：</label>
        <input type="color" id="new-group-color" value="#4a9eff">
      </div>
      <div class="modal-actions">
        <button class="btn btn-cancel" onclick="this.closest('.group-modal').remove()">取消</button>
        <button class="btn btn-primary" id="confirm-create-group">创建</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById('confirm-create-group').addEventListener('click', async () => {
    const name = document.getElementById('new-group-name').value.trim();
    const icon = document.getElementById('new-group-icon').value;
    const color = document.getElementById('new-group-color').value;
    
    if (!name) {
      showToast('请输入分组名称', 'warning');
      return;
    }
    
    const success = await saveGroup(name, icon, color);
    if (success) {
      modal.remove();
      // 关闭下拉菜单
      GroupManager.elements.groupDropdown?.classList.remove('show');
    }
  });
}

function showEditGroupModal(group) {
  const modal = document.createElement('div');
  modal.className = 'group-modal';
  modal.innerHTML = `
    <div class="group-modal-content">
      <h3>编辑分组</h3>
      <div class="form-group">
        <label>分组名称：</label>
        <input type="text" id="edit-group-name" value="${group.name}" maxlength="20">
      </div>
      <div class="form-group">
        <label>分组图标：</label>
        <select id="edit-group-icon">
          <option value="📁" ${group.icon === '📁' ? 'selected' : ''}>📁 文件夹</option>
          <option value="📂" ${group.icon === '📂' ? 'selected' : ''}>📂 打开文件夹</option>
          <option value="🏷️" ${group.icon === '🏷️' ? 'selected' : ''}>🏷️ 标签</option>
          <option value="⭐" ${group.icon === '⭐' ? 'selected' : ''}>⭐ 星标</option>
          <option value="🔥" ${group.icon === '🔥' ? 'selected' : ''}>🔥 热门</option>
          <option value="💎" ${group.icon === '💎' ? 'selected' : ''}>💎 钻石</option>
          <option value="🚀" ${group.icon === '🚀' ? 'selected' : ''}>🚀 火箭</option>
          <option value="📈" ${group.icon === '📈' ? 'selected' : ''}>📈 上涨</option>
          <option value="🤖" ${group.icon === '🤖' ? 'selected' : ''}>🤖 AI</option>
          <option value="💻" ${group.icon === '💻' ? 'selected' : ''}>💻 科技</option>
          <option value="🏦" ${group.icon === '🏦' ? 'selected' : ''}>🏦 金融</option>
          <option value="💊" ${group.icon === '💊' ? 'selected' : ''}>💊 医药</option>
        </select>
      </div>
      <div class="form-group">
        <label>分组颜色：</label>
        <input type="color" id="edit-group-color" value="${group.color}">
      </div>
      <div class="modal-actions">
        <button class="btn btn-cancel" onclick="this.closest('.group-modal').remove()">取消</button>
        <button class="btn btn-primary" id="confirm-edit-group">保存</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById('confirm-edit-group').addEventListener('click', async () => {
    const name = document.getElementById('edit-group-name').value.trim();
    const icon = document.getElementById('edit-group-icon').value;
    const color = document.getElementById('edit-group-color').value;
    
    if (!name) {
      showToast('请输入分组名称', 'warning');
      return;
    }
    
    const success = await updateGroup(group.id, name, icon, color);
    if (success) {
      modal.remove();
    }
  });
}

// ==================== 添加到股票卡片 ====================

function renderGroupSelector(code, stockName) {
  const userGroups = GroupManager.groups;
  const currentType = GroupManager.stockGroups[code] || 1;  // 默认 type=1（我的自选股）
  
  // 找到当前分组
  const currentGroup = userGroups.find(g => g.type === currentType) || userGroups.find(g => g.type === 1);
  const currentIcon = currentGroup ? currentGroup.icon : '📁';
  const currentName = currentGroup ? currentGroup.name : '我的自选股';
  
  return `
    <div class="group-selector" onclick="event.stopPropagation()">
      <button class="btn-group-selector">${currentIcon} ${currentName}</button>
      <div class="group-selector-dropdown">
        ${userGroups.map(group => {
          const isSelected = group.type === currentType;
          return `
            <div class="group-selector-item ${isSelected ? 'selected' : ''}" 
                 onclick="assignStockToGroup('${code}', ${group.type})">
              <span>${group.icon}</span>
              <span>${group.name}${isSelected ? ' ✓' : ''}</span>
            </div>
          `;
        }).join('')}
        ${userGroups.length === 0 ? '<div class="empty-selector">暂无分组</div>' : ''}
      </div>
    </div>
  `;
}

// ==================== 导出 ====================

if (typeof window !== 'undefined') {
  window.GroupManager = GroupManager;
  window.initGroupManager = initGroupManager;
  window.filterByGroup = filterByGroup;
  window.getFilteredStocks = getFilteredStocks;
  window.renderGroupSelector = renderGroupSelector;
  window.toggleStockGroup = toggleStockGroup;
}
