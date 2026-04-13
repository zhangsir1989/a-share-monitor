/**
 * 自选股分组功能 - 快速筛选和删除
 * 独立模块，负责快速筛选按钮渲染和删除功能
 */

// 快速筛选状态
const QuickFilter = {
  currentType: 1  // 当前筛选的分组 type，1=默认自选股
};

// ==================== 初始化 ====================

function initQuickFilter() {
  console.log('📁 初始化快速筛选...');
  renderQuickFilterButtons();
  bindQuickFilterEvents();
}

// ==================== 渲染快速筛选按钮 ====================

function renderQuickFilterButtons(groups = [], stockGroups = {}, stocks = []) {
  const container = document.getElementById('quick-filter-container');
  const buttonsContainer = document.getElementById('quick-filter-buttons');
  
  if (!container || !buttonsContainer) {
    console.warn('快速筛选容器不存在');
    return;
  }
  
  // 如果没有分组数据，隐藏容器
  if (!groups || groups.length === 0) {
    container.style.display = 'none';
    return;
  }
  
  // 显示容器
  container.style.display = 'flex';
  
  // 渲染按钮
  buttonsContainer.innerHTML = `
    <button class="quick-filter-btn ${QuickFilter.currentType === 1 ? 'active' : ''}" data-type="1">
      📁 我的自选股 (${stocks.filter(s => (stockGroups[s.code] || 1) === 1).length})
    </button>
    ${groups.filter(g => g.type !== 1).map(g => {
      const count = stocks.filter(s => (stockGroups[s.code] || 1) === g.type).length;
      return `
        <button class="quick-filter-btn ${QuickFilter.currentType === g.type ? 'active' : ''}" data-type="${g.type}">
          ${g.icon} ${g.name} (${count})
          <span class="delete-btn" data-type="${g.type}" title="删除分组">✕</span>
        </button>
      `;
    }).join('')}
  `;
  
  // 绑定筛选按钮事件
  document.querySelectorAll('.quick-filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      // 如果点击的是删除按钮，不触发筛选
      if (e.target.classList.contains('delete-btn')) {
        return;
      }
      
      // 切换激活状态
      document.querySelectorAll('.quick-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // 筛选分组
      const type = parseInt(btn.dataset.type);
      QuickFilter.currentType = type;
      
      // 触发自选股筛选
      if (typeof filterByGroup === 'function') {
        filterByGroup(type);
      }
    });
  });
  
  // 绑定删除按钮事件
  document.querySelectorAll('.quick-filter-btn .delete-btn').forEach(delBtn => {
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();  // 阻止冒泡，避免触发筛选
      
      const groupType = parseInt(delBtn.dataset.type);
      await handleDeleteGroup(groupType);
    });
  });
}

// ==================== 删除分组处理 ====================

async function handleDeleteGroup(groupType) {
  if (groupType === 1) {
    showToast('不能删除默认自选股分组', 'error');
    return false;
  }
  
  // 获取分组信息
  let groupName = `分组 ${groupType}`;
  if (typeof GroupManager !== 'undefined' && GroupManager.groups) {
    const group = GroupManager.groups.find(g => g.type === groupType);
    if (group) {
      groupName = group.name;
    }
  }
  
  if (!confirm(`确定要删除分组"${groupName}"吗？\n\n分组内的股票将回归默认自选股。`)) {
    return false;
  }
  
  try {
    // 先根据 type 找到分组 id
    let groupId = null;
    if (typeof GroupManager !== 'undefined' && GroupManager.groups) {
      const group = GroupManager.groups.find(g => g.type === groupType);
      if (group) {
        groupId = group.id;
      }
    }
    
    if (!groupId) {
      showToast('分组不存在', 'error');
      return false;
    }
    
    // 调用删除 API
    const response = await fetch('/api/custom-groups/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: groupId })
    });
    const result = await response.json();
    
    if (result.success) {
      // 重新加载分组
      if (typeof loadGroups === 'function') {
        await loadGroups();
      }
      
      // 刷新股票列表
      if (typeof loadStocks === 'function') {
        await loadStocks(1);
      }
      
      // 重置筛选到默认分组
      QuickFilter.currentType = 1;
      
      showToast('分组删除成功，股票已回归默认自选股', 'success');
      return true;
    } else {
      showToast(result.message || '删除失败', 'error');
      return false;
    }
  } catch (error) {
    console.error('删除分组失败:', error);
    showToast('删除失败：' + error.message, 'error');
    return false;
  }
}

// ==================== 事件绑定 ====================

function bindQuickFilterEvents() {
  // 监听分组管理按钮点击，刷新快速筛选按钮
  const groupManagerBtn = document.getElementById('group-manager-btn');
  if (groupManagerBtn) {
    groupManagerBtn.addEventListener('click', () => {
      // 延迟刷新，等待分组下拉菜单加载完成
      setTimeout(() => {
        if (typeof GroupManager !== 'undefined' && typeof pageState !== 'undefined') {
          renderQuickFilterButtons(
            GroupManager.groups,
            GroupManager.stockGroups,
            pageState.stocks || []
          );
        }
      }, 100);
    });
  }
}

// ==================== 更新快速筛选按钮股票数量 ====================

function updateQuickFilterCounts(stocks = []) {
  const buttonsContainer = document.getElementById('quick-filter-buttons');
  if (!buttonsContainer) return;
  
  const stockGroups = (typeof GroupManager !== 'undefined') ? GroupManager.stockGroups : {};
  const groups = (typeof GroupManager !== 'undefined') ? GroupManager.groups : [];
  
  // 重新渲染按钮（带最新数量）
  renderQuickFilterButtons(groups, stockGroups, stocks);
}
