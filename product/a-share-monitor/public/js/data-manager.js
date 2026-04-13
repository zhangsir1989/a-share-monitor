/**
 * 数据管理页面逻辑
 * 管理员专用：用户数据管理、自选股数据管理
 */

// 页面状态
const pageState = {
  users: {
    page: 1,
    pageSize: 20,
    total: 0,
    keyword: ''
  },
  stocks: {
    page: 1,
    pageSize: 20,
    total: 0,
    userId: '',
    stockCode: ''
  },
  groups: {
    page: 1,
    pageSize: 20,
    total: 0,
    groupName: ''
  }
};

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', () => {
  // sidebar.js 已处理 initSubSidebar
  initSubTabs();
  initUsersTab();
  initStocksTab();
  initGroupsTab();
});

// ==================== 二级侧边栏子标签切换 ====================

function initSubTabs() {
  // 二级侧边栏链接点击切换子标签
  document.querySelectorAll('.sub-sidebar-link').forEach(link => {
    link.addEventListener('click', (e) => {
      const subtab = link.dataset.subtab;
      
      // 如果链接有 data-subtab 属性，则在当前页面切换标签
      if (subtab) {
        e.preventDefault();
        
        // 更新激活状态
        document.querySelectorAll('.sub-sidebar-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        // 切换内容
        document.getElementById('users-tab').style.display = subtab === 'users' ? 'block' : 'none';
        document.getElementById('custom-stocks-tab').style.display = subtab === 'custom-stocks' ? 'block' : 'none';
        document.getElementById('groups-tab').style.display = subtab === 'groups' ? 'block' : 'none';
        
        // 动态更新标题
        const titleMap = {
          'users': '👥 用户数据管理',
          'custom-stocks': '⭐ 自选股数据管理'
        };
        const titleElement = document.getElementById('data-manager-title');
        if (titleElement && titleMap[subtab]) {
          titleElement.innerHTML = titleMap[subtab];
        }
        
        // 加载对应数据
        if (subtab === 'users') {
          loadUsersData();
        } else {
          loadStocksData();
        }
      }
      // 如果链接没有 data-subtab 属性（如 /securities），则允许正常跳转
      // 不调用 e.preventDefault()，让链接正常工作
    });
  });
}

// ==================== 用户数据管理 ====================

function initUsersTab() {
  document.getElementById('btn-user-search').addEventListener('click', () => {
    pageState.users.keyword = document.getElementById('user-keyword').value.trim();
    pageState.users.page = 1;
    loadUsersData();
  });
  
  document.getElementById('user-keyword').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      pageState.users.keyword = e.target.value.trim();
      pageState.users.page = 1;
      loadUsersData();
    }
  });
  
  document.getElementById('user-page-size').addEventListener('change', (e) => {
    pageState.users.pageSize = parseInt(e.target.value);
    pageState.users.page = 1;
    loadUsersData();
  });
  
  // 分页按钮
  document.getElementById('user-btn-first').addEventListener('click', () => {
    pageState.users.page = 1;
    loadUsersData();
  });
  
  document.getElementById('user-btn-prev').addEventListener('click', () => {
    if (pageState.users.page > 1) {
      pageState.users.page--;
      loadUsersData();
    }
  });
  
  document.getElementById('user-btn-next').addEventListener('click', () => {
    const totalPages = Math.ceil(pageState.users.total / pageState.users.pageSize);
    if (pageState.users.page < totalPages) {
      pageState.users.page++;
      loadUsersData();
    }
  });
  
  document.getElementById('user-btn-last').addEventListener('click', () => {
    pageState.users.page = Math.ceil(pageState.users.total / pageState.users.pageSize) || 1;
    loadUsersData();
  });
  
  // 初始加载
  loadUsersData();
}

async function loadUsersData() {
  try {
    const { page, pageSize, keyword } = pageState.users;
    const response = await fetch(`/api/admin/users?page=${page}&pageSize=${pageSize}&keyword=${encodeURIComponent(keyword)}`);
    const result = await response.json();
    
    if (!result.success) {
      alert(result.message || '加载失败');
      return;
    }
    
    pageState.users.total = result.total;
    renderUsersTable(result.data);
    updateUsersPagination();
  } catch (error) {
    console.error('加载用户数据失败:', error);
    document.getElementById('users-table-body').innerHTML = '<tr><td colspan="7" class="loading">加载失败</td></tr>';
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('users-table-body');
  
  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading">暂无数据</td></tr>';
    return;
  }
  
  tbody.innerHTML = users.map(user => {
    const roleText = user.role === '1' ? '👑 管理员' : '👤 用户';
    const statusText = user.is_active === 1 ? '✓ 激活' : '✗ 停用';
    const statusClass = user.is_active === 1 ? 'up' : 'down';
    
    return `
      <tr>
        <td>${user.user_id}</td>
        <td>${user.username}</td>
        <td>${user.password}</td>
        <td>${roleText}</td>
        <td class="${statusClass}">${statusText}</td>
        <td>${user.created_at || '--'}</td>
        <td>${user.last_login || '--'}</td>
      </tr>
    `;
  }).join('');
}

function updateUsersPagination() {
  const { page, pageSize, total } = pageState.users;
  const totalPages = Math.ceil(total / pageSize) || 1;
  
  document.getElementById('user-total').textContent = total;
  document.getElementById('user-current-page').textContent = page;
  document.getElementById('user-total-pages').textContent = totalPages;
  
  document.getElementById('user-btn-first').disabled = page === 1;
  document.getElementById('user-btn-prev').disabled = page === 1;
  document.getElementById('user-btn-next').disabled = page >= totalPages;
  document.getElementById('user-btn-last').disabled = page >= totalPages;
}

// ==================== 自选股数据管理 ====================

function initStocksTab() {
  document.getElementById('btn-stock-search').addEventListener('click', () => {
    pageState.stocks.userId = document.getElementById('stock-user-id').value.trim();
    pageState.stocks.stockCode = document.getElementById('stock-code').value.trim();
    pageState.stocks.page = 1;
    loadStocksData();
  });
  
  document.getElementById('btn-stock-reset').addEventListener('click', () => {
    document.getElementById('stock-user-id').value = '';
    document.getElementById('stock-code').value = '';
    pageState.stocks.userId = '';
    pageState.stocks.stockCode = '';
    pageState.stocks.page = 1;
    loadStocksData();
  });
  
  document.getElementById('stock-user-id').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      pageState.stocks.userId = e.target.value.trim();
      pageState.stocks.page = 1;
      loadStocksData();
    }
  });
  
  document.getElementById('stock-code').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      pageState.stocks.stockCode = e.target.value.trim();
      pageState.stocks.page = 1;
      loadStocksData();
    }
  });
  
  document.getElementById('stock-page-size').addEventListener('change', (e) => {
    pageState.stocks.pageSize = parseInt(e.target.value);
    pageState.stocks.page = 1;
    loadStocksData();
  });
  
  // 分页按钮
  document.getElementById('stock-btn-first').addEventListener('click', () => {
    pageState.stocks.page = 1;
    loadStocksData();
  });
  
  document.getElementById('stock-btn-prev').addEventListener('click', () => {
    if (pageState.stocks.page > 1) {
      pageState.stocks.page--;
      loadStocksData();
    }
  });
  
  document.getElementById('stock-btn-next').addEventListener('click', () => {
    const totalPages = Math.ceil(pageState.stocks.total / pageState.stocks.pageSize);
    if (pageState.stocks.page < totalPages) {
      pageState.stocks.page++;
      loadStocksData();
    }
  });
  
  document.getElementById('stock-btn-last').addEventListener('click', () => {
    pageState.stocks.page = Math.ceil(pageState.stocks.total / pageState.stocks.pageSize) || 1;
    loadStocksData();
  });
}

async function loadStocksData() {
  try {
    const { page, pageSize, userId, stockCode } = pageState.stocks;
    const response = await fetch(`/api/admin/custom-stocks?page=${page}&pageSize=${pageSize}&userId=${encodeURIComponent(userId)}&stockCode=${encodeURIComponent(stockCode)}`);
    const result = await response.json();
    
    if (!result.success) {
      alert(result.message || '加载失败');
      return;
    }
    
    pageState.stocks.total = result.total;
    renderStocksTable(result.data);
    updateStocksPagination();
  } catch (error) {
    console.error('加载自选股数据失败:', error);
    document.getElementById('stocks-table-body').innerHTML = '<tr><td colspan="4" class="loading">加载失败</td></tr>';
  }
}

function renderStocksTable(stocks) {
  const tbody = document.getElementById('stocks-table-body');
  
  if (stocks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading">暂无数据</td></tr>';
    return;
  }
  
  const marketNames = { sh: '沪市', sz: '深市', bj: '北交所' };
  const typeNames = { 1: '我的自选股' };
  
  tbody.innerHTML = stocks.map(stock => `
    <tr>
      <td>${stock.user_id}</td>
      <td>${stock.stock_code}</td>
      <td>${marketNames[stock.stock_market] || stock.stock_market}</td>
      <td>${stock.type || 1}</td>
      <td>${stock.group_name || typeNames[stock.type] || '未知分组'}</td>
      <td>${stock.added_at || '--'}</td>
    </tr>
  `).join('');
}

function updateStocksPagination() {
  const { page, pageSize, total } = pageState.stocks;
  const totalPages = Math.ceil(total / pageSize) || 1;
  
  document.getElementById('stock-total').textContent = total;
  document.getElementById('stock-current-page').textContent = page;
  document.getElementById('stock-total-pages').textContent = totalPages;
  
  document.getElementById('stock-btn-first').disabled = page === 1;
  document.getElementById('stock-btn-prev').disabled = page === 1;
  document.getElementById('stock-btn-next').disabled = page >= totalPages;
  document.getElementById('stock-btn-last').disabled = page >= totalPages;
}

// ==================== 分组查询标签页 ====================

function initGroupsTab() {
  // 查询按钮
  document.getElementById('btn-group-search')?.addEventListener('click', () => {
    pageState.groups.groupName = document.getElementById('group-name').value.trim();
    pageState.groups.page = 1;
    loadGroupsData();
  });
  
  // 重置按钮
  document.getElementById('btn-group-reset')?.addEventListener('click', () => {
    document.getElementById('group-name').value = '';
    pageState.groups.groupName = '';
    pageState.groups.page = 1;
    loadGroupsData();
  });
  
  // 分页事件
  document.getElementById('group-btn-first')?.addEventListener('click', () => {
    pageState.groups.page = 1;
    loadGroupsData();
  });
  
  document.getElementById('group-btn-prev')?.addEventListener('click', () => {
    if (pageState.groups.page > 1) {
      pageState.groups.page--;
      loadGroupsData();
    }
  });
  
  document.getElementById('group-btn-next')?.addEventListener('click', () => {
    const totalPages = Math.ceil(pageState.groups.total / pageState.groups.pageSize);
    if (pageState.groups.page < totalPages) {
      pageState.groups.page++;
      loadGroupsData();
    }
  });
  
  document.getElementById('group-btn-last')?.addEventListener('click', () => {
    pageState.groups.page = Math.ceil(pageState.groups.total / pageState.groups.pageSize) || 1;
    loadGroupsData();
  });
  
  document.getElementById('group-page-size')?.addEventListener('change', (e) => {
    pageState.groups.pageSize = parseInt(e.target.value);
    pageState.groups.page = 1;
    loadGroupsData();
  });
  
  // 初始加载
  loadGroupsData();
}

async function loadGroupsData() {
  const { page, pageSize, groupName } = pageState.groups;
  
  try {
    const response = await fetch(`/api/admin/custom-groups?page=${page}&pageSize=${pageSize}&groupName=${encodeURIComponent(groupName)}`);
    const result = await response.json();
    
    if (!result.success) {
      alert(result.message || '加载失败');
      return;
    }
    
    pageState.groups.total = result.total;
    renderGroupsTable(result.data);
    updateGroupsPagination();
  } catch (error) {
    console.error('加载分组数据失败:', error);
    document.getElementById('groups-table-body').innerHTML = '<tr><td colspan="6" class="loading">加载失败</td></tr>';
  }
}

function renderGroupsTable(groups) {
  const tbody = document.getElementById('groups-table-body');
  
  if (groups.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading">暂无数据</td></tr>';
    return;
  }
  
  tbody.innerHTML = groups.map(group => `
    <tr>
      <td><span style="font-weight: bold; color: ${group.color || '#4a9eff'}">${group.type}</span></td>
      <td>${group.icon || '📁'} ${group.name}</td>
      <td>${group.icon || '📁'}</td>
      <td><span style="display: inline-block; width: 20px; height: 20px; background: ${group.color || '#4a9eff'}; border-radius: 3px; vertical-align: middle;"></span> ${group.color || '#4a9eff'}</td>
      <td>${group.user_id || '--'}</td>
      <td>${group.created_at || '--'}</td>
    </tr>
  `).join('');
}

function updateGroupsPagination() {
  const { page, pageSize, total } = pageState.groups;
  const totalPages = Math.ceil(total / pageSize) || 1;
  
  document.getElementById('group-total').textContent = total;
  document.getElementById('group-current-page').textContent = page;
  document.getElementById('group-total-pages').textContent = totalPages;
  
  document.getElementById('group-btn-first').disabled = page === 1;
  document.getElementById('group-btn-prev').disabled = page === 1;
  document.getElementById('group-btn-next').disabled = page >= totalPages;
  document.getElementById('group-btn-last').disabled = page >= totalPages;
}
