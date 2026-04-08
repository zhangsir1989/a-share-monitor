/**
 * 公共侧边栏逻辑
 * 支持主侧边栏和二级侧边栏的收缩/展开
 * 实现菜单折叠互斥逻辑
 */

// 全局状态
const sidebarState = {
  mainCollapsed: false,
  subCollapsed: false,
  hasSubSidebar: false,
  userRole: '0',
  currentPage: ''
};

// 初始化侧边栏
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const subSidebar = document.getElementById('sub-sidebar');
  
  console.log('🔍 侧边栏初始化检查:');
  console.log('  - sidebar:', sidebar ? '存在' : '不存在');
  console.log('  - subSidebar:', subSidebar ? '存在' : '不存在');
  
  if (!sidebar) {
    console.warn('⚠️ 侧边栏元素不存在');
    return;
  }
  
  // 获取用户信息
  sidebarState.userRole = localStorage.getItem('userRole') || '0';
  sidebarState.currentPage = window.location.pathname;
  sidebarState.hasSubSidebar = !!subSidebar;
  
  console.log('📋 侧边栏状态 - 角色:', sidebarState.userRole, '当前页:', sidebarState.currentPage, '有二级菜单:', sidebarState.hasSubSidebar);
  
  // 设置用户信息
  setupUserInfo();
  
  // 根据角色显示菜单
  setupMenuVisibility();
  
  // 高亮当前页面菜单
  highlightCurrentPage();
  highlightCurrentSubMenu();
  
  // 初始化主侧边栏折叠按钮
  initMainSidebarCollapse();
  
  // 初始化二级侧边栏折叠按钮
  if (subSidebar) {
    initSubSidebarCollapse();
  }
  
  // 初始化移动端菜单
  initMobileMenu();
  
  // 初始化退出登录
  initLogout();
}

// 设置用户信息
function setupUserInfo() {
  const username = localStorage.getItem('username') || '--';
  const usernameEl = document.getElementById('sidebar-username');
  if (usernameEl) {
    usernameEl.textContent = username;
  }
}

// 根据角色显示菜单 - 管理员显示所有菜单
function setupMenuVisibility() {
  const isAdmin = sidebarState.userRole === '1';
  
  // 管理员专用菜单
  const adminMenus = document.querySelectorAll('.sidebar-link[data-requires-admin="true"]');
  adminMenus.forEach(link => {
    link.style.display = isAdmin ? 'flex' : 'none';
  });
  
  // 普通用户专用菜单（修改密码）
  const userMenus = document.querySelectorAll('.sidebar-link[data-requires-user="true"]');
  userMenus.forEach(link => {
    link.style.display = !isAdmin ? 'flex' : 'none';
  });
  
  // 二级侧边栏菜单 - 管理员显示所有
  if (sidebarState.hasSubSidebar) {
    const subAdminMenus = document.querySelectorAll('.sub-sidebar-link[data-requires-admin="true"]');
    subAdminMenus.forEach(link => {
      link.style.display = isAdmin ? 'flex' : 'none';
    });
  }
  
  console.log('✅ 菜单可见性设置完成 - 管理员:', isAdmin);
}

// 高亮当前页面菜单
function highlightCurrentPage() {
  const currentPath = sidebarState.currentPage;
  
  // 高亮一级菜单
  document.querySelectorAll('.sidebar-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
  
  // 高亮二级菜单
  document.querySelectorAll('.sub-sidebar-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
  
  console.log('✅ 当前页面菜单已高亮');
}

// 初始化主侧边栏折叠按钮
function initMainSidebarCollapse() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  
  let collapseBtn = document.getElementById('sidebar-collapse-btn');
  
  if (!collapseBtn) {
    // 创建折叠按钮
    collapseBtn = document.createElement('button');
    collapseBtn.id = 'sidebar-collapse-btn';
    collapseBtn.className = 'sidebar-collapse-btn';
    collapseBtn.innerHTML = '《';
    collapseBtn.title = '折叠菜单';
    sidebar.appendChild(collapseBtn);
    console.log('✅ 主侧边栏收缩按钮已创建');
  }
  
  if (collapseBtn) {
    collapseBtn.addEventListener('click', handleMainSidebarCollapse);
  }
}

// 处理主侧边栏折叠
function handleMainSidebarCollapse() {
  const sidebar = document.getElementById('sidebar');
  const subSidebar = document.getElementById('sub-sidebar');
  const collapseBtn = document.getElementById('sidebar-collapse-btn');
  
  if (!sidebar || !collapseBtn) return;
  
  // 切换折叠状态
  sidebarState.mainCollapsed = !sidebarState.mainCollapsed;
  
  if (sidebarState.mainCollapsed) {
    sidebar.classList.add('collapsed');
    collapseBtn.innerHTML = '》';
    collapseBtn.title = '展开菜单';
  } else {
    sidebar.classList.remove('collapsed');
    collapseBtn.innerHTML = '《';
    collapseBtn.title = '折叠菜单';
  }
  
  updateLayoutClasses();
  saveSidebarState();
  
  console.log('✅ 主侧边栏折叠状态:', sidebarState.mainCollapsed ? '折叠' : '展开');
}

// 初始化二级侧边栏折叠按钮
function initSubSidebarCollapse() {
  const subSidebar = document.getElementById('sub-sidebar');
  if (!subSidebar) {
    console.warn('⚠️ 二级侧边栏不存在');
    return;
  }
  
  console.log('✅ 二级侧边栏存在，初始化收缩按钮');
  
  let collapseBtn = document.getElementById('sub-sidebar-collapse-btn');
  
  if (!collapseBtn) {
    // 创建折叠按钮
    collapseBtn = document.createElement('button');
    collapseBtn.id = 'sub-sidebar-collapse-btn';
    collapseBtn.className = 'sub-sidebar-collapse-btn';
    collapseBtn.innerHTML = '《';
    collapseBtn.title = '折叠菜单';
    subSidebar.appendChild(collapseBtn);
    console.log('✅ 二级侧边栏收缩按钮已创建');
  }
  
  if (collapseBtn) {
    collapseBtn.addEventListener('click', handleSubSidebarCollapse);
    console.log('✅ 二级侧边栏收缩按钮事件已绑定');
  }
  
  // 确保二级侧边栏初始状态为展开（不折叠）
  subSidebar.classList.remove('collapsed');
  updateSubSidebarButton(subSidebar);
  console.log('✅ 二级侧边栏初始状态：展开');
}

// 处理二级侧边栏折叠
function handleSubSidebarCollapse() {
  const subSidebar = document.getElementById('sub-sidebar');
  if (!subSidebar) return;
  
  sidebarState.subCollapsed = !sidebarState.subCollapsed;
  
  if (sidebarState.subCollapsed) {
    subSidebar.classList.add('collapsed');
  } else {
    subSidebar.classList.remove('collapsed');
  }
  
  updateSubSidebarButton(subSidebar);
  updateLayoutClasses();
  saveSidebarState();
  
  console.log('✅ 二级侧边栏折叠状态:', sidebarState.subCollapsed ? '折叠' : '展开');
}

// 更新二级侧边栏按钮
function updateSubSidebarButton(subSidebar) {
  const collapseBtn = document.getElementById('sub-sidebar-collapse-btn');
  if (!collapseBtn) return;
  
  if (subSidebar.classList.contains('collapsed')) {
    collapseBtn.innerHTML = '》';
    collapseBtn.title = '展开菜单';
  } else {
    collapseBtn.innerHTML = '《';
    collapseBtn.title = '折叠菜单';
  }
}

// 更新布局类名
function updateLayoutClasses() {
  const container = document.querySelector('.container');
  const mainContent = document.querySelector('.main-content');
  const header = document.querySelector('.header');
  const footer = document.querySelector('.footer');
  const subSidebar = document.getElementById('sub-sidebar');
  
  const hasSub = subSidebar && !sidebarState.subCollapsed;
  
  // 更新容器
  if (container) {
    container.classList.toggle('sidebar-collapsed', sidebarState.mainCollapsed);
    container.classList.toggle('sub-collapsed', sidebarState.subCollapsed);
    container.classList.toggle('no-sub-sidebar', !subSidebar);
  }
  
  // 更新主内容区
  if (mainContent) {
    mainContent.classList.toggle('sidebar-collapsed', sidebarState.mainCollapsed);
    mainContent.classList.toggle('has-sub-sidebar', hasSub);
    mainContent.classList.toggle('sub-collapsed', sidebarState.subCollapsed);
  }
  
  // 更新头部
  if (header) {
    header.classList.toggle('sidebar-collapsed', sidebarState.mainCollapsed);
    header.classList.toggle('has-sub-sidebar', hasSub);
    header.classList.toggle('sub-collapsed', sidebarState.subCollapsed);
  }
  
  // 更新页脚
  if (footer) {
    footer.classList.toggle('sidebar-collapsed', sidebarState.mainCollapsed);
    footer.classList.toggle('has-sub-sidebar', hasSub);
    footer.classList.toggle('sub-collapsed', sidebarState.subCollapsed);
  }
}

// 初始化移动端菜单
function initMobileMenu() {
  const menuToggle = document.getElementById('menu-toggle');
  const closeSidebar = document.getElementById('close-sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const sidebar = document.getElementById('sidebar');
  
  if (!menuToggle || !sidebar) return;
  
  function toggleSidebar() {
    sidebar.classList.toggle('open');
    if (sidebarOverlay) {
      sidebarOverlay.classList.toggle('active');
    }
  }
  
  function closeSidebarFunc() {
    sidebar.classList.remove('open');
    if (sidebarOverlay) {
      sidebarOverlay.classList.remove('active');
    }
  }
  
  menuToggle.addEventListener('click', toggleSidebar);
  
  if (closeSidebar) {
    closeSidebar.addEventListener('click', closeSidebarFunc);
  }
  
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeSidebarFunc);
  }
  
  // 点击菜单链接关闭侧边栏（移动端）
  sidebar.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        closeSidebarFunc();
      }
    });
  });
}

// 初始化退出登录
function initLogout() {
  const logoutBtn = document.getElementById('sidebar-logout-btn');
  if (!logoutBtn) return;
  
  logoutBtn.addEventListener('click', async () => {
    if (!confirm('确定要退出登录吗？')) return;
    
    try {
      const response = await fetch('/api/logout');
      const result = await response.json();
      
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('username');
      localStorage.removeItem('loginTime');
      localStorage.removeItem('userRole');
      
      window.location.href = '/login.html';
    } catch (error) {
      console.error('退出登录失败:', error);
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('username');
      localStorage.removeItem('userRole');
      window.location.href = '/login.html';
    }
  });
}

// 保存侧边栏状态到 localStorage
function saveSidebarState() {
  try {
    localStorage.setItem('sidebar-main-collapsed', sidebarState.mainCollapsed ? '1' : '0');
    localStorage.setItem('sidebar-sub-collapsed', sidebarState.subCollapsed ? '1' : '0');
  } catch (e) {
    console.warn('保存侧边栏状态失败:', e);
  }
}

// 恢复侧边栏状态
function restoreSidebarState() {
  try {
    const mainCollapsed = localStorage.getItem('sidebar-main-collapsed') === '1';
    const subCollapsed = localStorage.getItem('sidebar-sub-collapsed') === '1';
    
    const sidebar = document.getElementById('sidebar');
    const subSidebar = document.getElementById('sub-sidebar');
    const collapseBtn = document.getElementById('sidebar-collapse-btn');
    const subCollapseBtn = document.getElementById('sub-sidebar-collapse-btn');
    
    if (sidebar && mainCollapsed) {
      sidebar.classList.add('collapsed');
      sidebarState.mainCollapsed = true;
      if (collapseBtn) {
        collapseBtn.innerHTML = '》';
      }
    }
    
    if (subSidebar && subCollapsed) {
      subSidebar.classList.add('collapsed');
      sidebarState.subCollapsed = true;
      if (subCollapseBtn) {
        subCollapseBtn.innerHTML = '》';
      }
    }
    
    updateLayoutClasses();
  } catch (e) {
    console.warn('恢复侧边栏状态失败:', e);
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  // 默认展开所有侧边栏
  setTimeout(() => {
    // 初始化布局类名
    updateLayoutClasses();
  }, 100);
  console.log('✅ 侧边栏初始化完成，默认展开状态');
});

// 导出函数供外部调用
window.SidebarAPI = {
  collapseMain: () => {
    const sidebar = document.getElementById('sidebar');
    if (sidebar && !sidebar.classList.contains('collapsed')) {
      handleMainSidebarCollapse();
    }
  },
  expandMain: () => {
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('collapsed')) {
      handleMainSidebarCollapse();
    }
  },
  collapseSub: () => {
    const subSidebar = document.getElementById('sub-sidebar');
    if (subSidebar && !subSidebar.classList.contains('collapsed')) {
      handleSubSidebarCollapse();
    }
  },
  expandSub: () => {
    const subSidebar = document.getElementById('sub-sidebar');
    if (subSidebar && subSidebar.classList.contains('collapsed')) {
      handleSubSidebarCollapse();
    }
  }
};
// 高亮当前页面的二级菜单
function highlightCurrentSubMenu() {
  const currentPath = window.location.pathname;
  document.querySelectorAll('.sub-sidebar-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}
