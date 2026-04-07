/**
 * 用户管理页面逻辑
 */

// 页面状态
const pageState = {
  users: [],
  currentPage: 1,
  pageSize: 20,
  totalUsers: 0,
  totalPages: 0,
  searchTerm: ''
};

// DOM 元素
let elements = {};

// 待删除用户 ID
let userToDelete = null;

// ==================== 初始化 ====================

console.log('init 函数定义完成');

function init() {
  cacheElements();
  checkLoginStatus();
  bindEvents();
  loadUsers();
}

function cacheElements() {
  elements = {
    userName: document.getElementById('user-name'),
    logoutBtn: document.getElementById('logout-btn'),
    btnAddUser: document.getElementById('btn-add-user'),
    btnRefresh: document.getElementById('btn-refresh'),
    searchInput: document.getElementById('search-input'),
    btnSearch: document.getElementById('btn-search'),
    usersTableBody: document.getElementById('users-table-body'),
    paginationBar: document.getElementById('pagination-bar'),
    totalCount: document.getElementById('total-count'),
    currentPage: document.getElementById('current-page'),
    totalPages: document.getElementById('total-pages'),
    btnFirst: document.getElementById('btn-first'),
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next'),
    btnLast: document.getElementById('btn-last'),
    pageSizeSelect: document.getElementById('page-size-select'),
    userModal: document.getElementById('user-modal'),
    modalTitle: document.getElementById('modal-title'),
    userIdHidden: document.getElementById('user-id-hidden'),
    userId: document.getElementById('user-id'),
    username: document.getElementById('username'),
    password: document.getElementById('password'),
    role: document.getElementById('role'),
    isActive: document.getElementById('is-active'),
    modalClose: document.getElementById('modal-close'),
    modalCancel: document.getElementById('modal-cancel'),
    modalSave: document.getElementById('modal-save'),
    confirmModal: document.getElementById('confirm-modal'),
    deleteUserId: document.getElementById('delete-user-id'),
    confirmClose: document.getElementById('confirm-close'),
    confirmCancel: document.getElementById('confirm-cancel'),
    confirmDeleteBtn: document.getElementById('confirm-delete')
  };
}

// ==================== 登录状态 ====================

function checkLoginStatus() {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  const username = localStorage.getItem('username');
  
  if (isLoggedIn && username) {
    if (elements.userName) elements.userName.textContent = '👤 ' + username;
  } else {
    window.location.href = '/login.html';
  }
}

// ==================== 数据加载 ====================

async function loadUsers() {
  try {
    const response = await fetch('/api/users/list');
    const result = await response.json();
    
    if (result.success) {
      pageState.users = result.data || [];
      pageState.totalUsers = pageState.users.length;
      applyFiltersAndRender();
    } else {
      alert('❌ 加载用户列表失败');
    }
  } catch (error) {
    console.error('加载用户失败:', error);
    alert('❌ 网络错误，请稍后重试');
  }
}

function applyFiltersAndRender() {
  let filteredUsers = pageState.users;
  
  if (pageState.searchTerm) {
    const term = pageState.searchTerm.toLowerCase();
    filteredUsers = filteredUsers.filter(user => 
      user.user_id.toLowerCase().includes(term) ||
      user.username.toLowerCase().includes(term)
    );
  }
  
  pageState.totalUsers = filteredUsers.length;
  pageState.totalPages = Math.ceil(pageState.totalUsers / pageState.pageSize) || 1;
  
  if (pageState.currentPage > pageState.totalPages) {
    pageState.currentPage = Math.max(1, pageState.totalPages);
  }
  
  const startIndex = (pageState.currentPage - 1) * pageState.pageSize;
  const endIndex = startIndex + pageState.pageSize;
  const pageUsers = filteredUsers.slice(startIndex, endIndex);
  
  renderTable(pageUsers);
  updatePagination();
}

// ==================== 渲染表格 ====================

function renderTable(users) {
  if (!users || users.length === 0) {
    elements.usersTableBody.innerHTML = '<tr><td colspan="7" class="loading">暂无用户数据</td></tr>';
    return;
  }
  
  let html = users.map(user => {
    const statusClass = user.is_active === 1 ? 'active' : 'inactive';
    const statusText = user.is_active === 1 ? '✓ 激活' : '✗ 停用';
    const roleClass = user.role === '1' ? 'role-admin' : 'role-user';
    const roleText = user.role === '1' ? '👑 管理员' : '👤 普通用户';
    const lastLogin = user.last_login || '从未登录';
    
    return '<tr data-user-id="' + user.user_id + '" class="user-row">' +
      '<td>' + escapeHtml(user.user_id) + '</td>' +
      '<td>' + escapeHtml(user.username) + '</td>' +
      '<td><span class="role-badge ' + roleClass + '">' + roleText + '</span></td>' +
      '<td><span class="password-mask">••••••</span>' +
      ' <button class="btn-sm btn-toggle-password" type="button">👁️</button></td>' +
      '<td><span class="status-badge ' + statusClass + '">' + statusText + '</span></td>' +
      '<td>' + (user.created_at || '--') + '</td>' +
      '<td>' + lastLogin + '</td>' +
      '<td class="action-cell">' +
      '<button class="btn-icon btn-edit-row" type="button" title="编辑">✏️</button>' +
      '<button class="btn-icon btn-delete-row" type="button" title="删除">🗑️</button>' +
      '</td></tr>';
  }).join('');
  
  elements.usersTableBody.innerHTML = html;
  bindRowEvents();
  updatePagination();
}

function bindRowEvents() {
  // 编辑按钮
  document.querySelectorAll('.btn-edit-row').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const row = this.closest('tr');
      const userId = row.getAttribute('data-user-id');
      editUser(userId);
    });
  });
  
  // 删除按钮
  document.querySelectorAll('.btn-delete-row').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const row = this.closest('tr');
      const userId = row.getAttribute('data-user-id');
      confirmDelete(userId);
    });
  });
  
  // 密码切换
  document.querySelectorAll('.btn-toggle-password').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const row = this.closest('tr');
      const passwordCell = row.cells[3];
      const passwordMask = passwordCell ? passwordCell.querySelector('.password-mask') : null;
      const userId = row.getAttribute('data-user-id');
      const user = pageState.users.find(u => u.user_id === userId);
      
      if (passwordMask && user) {
        if (passwordMask.textContent === '••••••') {
          passwordMask.textContent = user.password;
          this.textContent = '🙈';
        } else {
          passwordMask.textContent = '••••••';
          this.textContent = '👁️';
        }
      }
    });
  });
  
  // 行选中
  document.querySelectorAll('.user-row').forEach(row => {
    row.addEventListener('click', function() {
      document.querySelectorAll('.user-row').forEach(r => r.classList.remove('selected'));
      this.classList.add('selected');
    });
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== 分页 ====================

function updatePagination() {
  if (elements.totalCount) elements.totalCount.textContent = pageState.totalUsers;
  if (elements.currentPage) elements.currentPage.textContent = pageState.currentPage;
  if (elements.totalPages) elements.totalPages.textContent = pageState.totalPages;
  
  if (elements.btnFirst) elements.btnFirst.disabled = pageState.currentPage === 1;
  if (elements.btnPrev) elements.btnPrev.disabled = pageState.currentPage === 1;
  if (elements.btnNext) elements.btnNext.disabled = pageState.currentPage >= pageState.totalPages;
  if (elements.btnLast) elements.btnLast.disabled = pageState.currentPage >= pageState.totalPages;
}

// ==================== 事件绑定 ====================

function bindEvents() {
  // 新增用户
  if (elements.btnAddUser) {
    elements.btnAddUser.addEventListener('click', showAddModal);
  }
  
  // 刷新
  if (elements.btnRefresh) {
    elements.btnRefresh.addEventListener('click', loadUsers);
  }
  
  // 搜索
  if (elements.btnSearch) {
    elements.btnSearch.addEventListener('click', function() {
      pageState.searchTerm = elements.searchInput ? elements.searchInput.value.trim() : '';
      pageState.currentPage = 1;
      applyFiltersAndRender();
    });
  }
  
  if (elements.searchInput) {
    elements.searchInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        pageState.searchTerm = this.value.trim();
        pageState.currentPage = 1;
        applyFiltersAndRender();
      }
    });
  }
  
  // 分页
  if (elements.btnFirst) elements.btnFirst.addEventListener('click', function() { goToPage(1); });
  if (elements.btnPrev) elements.btnPrev.addEventListener('click', function() { goToPage(pageState.currentPage - 1); });
  if (elements.btnNext) elements.btnNext.addEventListener('click', function() { goToPage(pageState.currentPage + 1); });
  if (elements.btnLast) elements.btnLast.addEventListener('click', function() { goToPage(pageState.totalPages); });
  if (elements.pageSizeSelect) {
    elements.pageSizeSelect.addEventListener('change', function() {
      pageState.pageSize = parseInt(this.value);
      pageState.currentPage = 1;
      applyFiltersAndRender();
    });
  }
  
  // 模态框关闭
  if (elements.modalClose) elements.modalClose.addEventListener('click', closeModal);
  if (elements.modalCancel) elements.modalCancel.addEventListener('click', closeModal);
  if (elements.modalSave) elements.modalSave.addEventListener('click', saveUser);
  if (elements.userModal) {
    elements.userModal.addEventListener('click', function(e) {
      if (e.target === this) closeModal();
    });
  }
  
  // 确认删除模态框
  if (elements.confirmClose) elements.confirmClose.addEventListener('click', closeConfirmModal);
  if (elements.confirmCancel) elements.confirmCancel.addEventListener('click', closeConfirmModal);
  if (elements.confirmDeleteBtn) elements.confirmDeleteBtn.addEventListener('click', deleteUser);
  if (elements.confirmModal) {
    elements.confirmModal.addEventListener('click', function(e) {
      if (e.target === this) closeConfirmModal();
    });
  }
  
  // 登出
  if (elements.logoutBtn) {
    elements.logoutBtn.addEventListener('click', function() {
      if (!confirm('确定要退出登录吗？')) return;
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('username');
      window.location.href = '/login.html';
    });
  }
}

// ==================== 分页操作 ====================

function goToPage(page) {
  if (page < 1 || page > pageState.totalPages) return;
  pageState.currentPage = page;
  applyFiltersAndRender();
}

// ==================== 新增/编辑用户 ====================

function showAddModal() {
  console.log('=== showAddModal 被调用 ===');
  
  if (!elements.userModal || !elements.modalTitle) {
    console.error('模态框元素不存在！');
    alert('❌ 模态框元素不存在');
    return;
  }
  
  elements.modalTitle.textContent = '➕ 新增用户';
  if (elements.userIdHidden) elements.userIdHidden.value = '';
  if (elements.userId) { elements.userId.value = ''; elements.userId.disabled = false; }
  if (elements.username) elements.username.value = '';
  if (elements.password) elements.password.value = '';
  if (elements.role) elements.role.value = '0';
  if (elements.isActive) elements.isActive.value = '1';
  
  // 同时添加 show 和 active 类
  elements.userModal.classList.add('show', 'active');
  elements.userModal.style.display = 'flex';
  elements.userModal.style.visibility = 'visible';
  elements.userModal.style.opacity = '1';
  elements.userModal.style.zIndex = '999999';
  elements.userModal.style.pointerEvents = 'auto';
  
  // 确保模态框内容可点击
  const modalContent = elements.userModal.querySelector('.modal-content');
  if (modalContent) {
    modalContent.style.zIndex = '1000000';
    modalContent.style.pointerEvents = 'auto';
  }
  
  // 确保所有按钮可点击
  const buttons = elements.userModal.querySelectorAll('button');
  buttons.forEach(btn => {
    btn.style.pointerEvents = 'auto';
    btn.disabled = false;
  });
  
  console.log('模态框已显示，classList:', elements.userModal.classList);
  
  setTimeout(() => {
    if (elements.userId) {
      elements.userId.focus();
      console.log('已聚焦到 userId 输入框');
    }
  }, 100);
}

function editUser(userId) {
  console.log('editUser called with:', userId);
  
  const user = pageState.users.find(u => u.user_id === userId);
  if (!user) {
    alert('❌ 用户不存在');
    return;
  }
  
  if (!elements.userModal || !elements.modalTitle) {
    alert('❌ 模态框元素不存在');
    return;
  }
  
  elements.modalTitle.textContent = '✏️ 编辑用户';
  if (elements.userIdHidden) elements.userIdHidden.value = user.user_id;
  if (elements.userId) { elements.userId.value = user.user_id; elements.userId.disabled = true; }
  if (elements.username) elements.username.value = user.username;
  if (elements.password) elements.password.value = user.password;
  if (elements.role) elements.role.value = user.role || '0';
  if (elements.isActive) elements.isActive.value = (user.is_active || 0).toString();
  
  // 同时添加 show 和 active 类
  elements.userModal.classList.add('show', 'active');
  elements.userModal.style.display = 'flex';
  elements.userModal.style.pointerEvents = 'auto';
  
  console.log('模态框已显示，classList:', elements.userModal.classList);
}

function closeModal() {
  if (elements.userModal) {
    elements.userModal.classList.remove('show', 'active');
    elements.userModal.style.display = '';
    elements.userModal.style.pointerEvents = '';
  }
}

async function saveUser() {
  console.log('=== saveUser 被调用 ===');
  
  const userId = elements.userId ? elements.userId.value.trim() : '';
  const username = elements.username ? elements.username.value.trim() : '';
  const password = elements.password ? elements.password.value.trim() : '';
  const role = elements.role ? elements.role.value : '0';
  const isActive = elements.isActive ? parseInt(elements.isActive.value) : 1;
  
  console.log('userId:', userId, 'username:', username, 'role:', role);
  
  if (!userId) {
    alert('❌ 请输入用户编号');
    return;
  }
  
  if (userId.length > 12) {
    alert('❌ 用户编号不能超过 12 位');
    return;
  }
  
  if (!username) {
    alert('❌ 请输入用户名');
    return;
  }
  
  if (!password) {
    alert('❌ 请输入密码');
    return;
  }
  
  if (password.length > 12) {
    alert('❌ 密码不能超过 12 位');
    return;
  }
  
  try {
    const isEdit = elements.userIdHidden && elements.userIdHidden.value !== '';
    const endpoint = isEdit ? '/api/users/update' : '/api/users/add';
    const data = {
      user_id: userId,
      username: username,
      password: password,
      role: role,
      is_active: isActive
    };
    
    console.log('发送请求:', endpoint, data);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    console.log('服务器响应:', result);
    
    if (result.success) {
      alert('✅ ' + (isEdit ? '用户已更新' : '用户已添加'));
      closeModal();
      loadUsers();
    } else {
      alert('❌ ' + (result.message || '操作失败'));
    }
  } catch (error) {
    console.error('保存用户失败:', error);
    alert('❌ 网络错误，请稍后重试');
  }
}

// ==================== 删除用户 ====================

function confirmDelete(userId) {
  console.log('confirmDelete called with:', userId);
  
  if (!elements.confirmModal || !elements.deleteUserId) {
    alert('❌ 确认模态框不存在');
    return;
  }
  
  userToDelete = userId;
  elements.deleteUserId.textContent = userId;
  
  // 同时添加 show 和 active 类
  elements.confirmModal.classList.add('show', 'active');
  elements.confirmModal.style.display = 'flex';
  elements.confirmModal.style.pointerEvents = 'auto';
  
  console.log('确认模态框已显示，classList:', elements.confirmModal.classList);
}

function closeConfirmModal() {
  if (elements.confirmModal) {
    elements.confirmModal.classList.remove('show', 'active');
    elements.confirmModal.style.display = '';
    elements.confirmModal.style.pointerEvents = '';
  }
  userToDelete = null;
}

function deleteUser() {
  if (!userToDelete) return;
  
  const currentUserId = userToDelete;
  userToDelete = null;  // 立即清空，防止重复删除
  
  fetch('/api/users/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: currentUserId })
  })
  .then(res => res.json())
  .then(result => {
    if (result.success) {
      alert('✅ 用户已删除');
      closeConfirmModal();
      loadUsers();
    } else {
      alert('❌ ' + (result.message || '删除失败'));
    }
  })
  .catch(error => {
    console.error('删除用户失败:', error);
    alert('❌ 网络错误，请稍后重试');
  });
}

// ==================== 全局函数 ====================

window.editUser = editUser;
window.confirmDelete = confirmDelete;

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', init);
