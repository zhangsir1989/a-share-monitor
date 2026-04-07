/**
 * 修改密码页面逻辑
 */

// 页面状态
const pageState = {
  currentUser: null
};

// DOM 元素
let elements = {};

// ==================== 初始化 ====================

function init() {
  elements = {
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    menuToggle: document.getElementById('menu-toggle'),
    closeSidebar: document.getElementById('close-sidebar'),
    sidebarUsername: document.getElementById('sidebar-username'),
    userName: document.getElementById('user-name'),
    logoutBtn: document.getElementById('logout-btn'),
    sidebarLogoutBtn: document.getElementById('sidebar-logout-btn'),
    
    // 表单
    changePasswordForm: document.getElementById('change-password-form'),
    currentPassword: document.getElementById('current-password'),
    newPassword: document.getElementById('new-password'),
    confirmPassword: document.getElementById('confirm-password'),
    passwordStrength: document.getElementById('password-strength'),
    passwordMatch: document.getElementById('password-match'),
    btnCancel: document.getElementById('btn-cancel')
  };
  
  // 检查登录状态
  checkLoginStatus();
  
  // 绑定事件
  bindEvents();
}

// ==================== 登录状态 ====================

async function checkLoginStatus() {
  try {
    const response = await fetch('/api/auth/status');
    const result = await response.json();
    
    if (!result.isAuthenticated) {
      window.location.href = '/login.html';
      return;
    }
    
    pageState.currentUser = {
      userId: result.userId,
      username: result.username,
      userRole: result.userRole
    };
    
    // 显示用户信息
    if (elements.userName) elements.userName.textContent = `👤 ${result.username}`;
    if (elements.sidebarUsername) elements.sidebarUsername.textContent = result.username;
    
    // 根据用户角色显示不同菜单
    const userRole = result.userRole || '0';
    console.log('📋 当前用户角色:', userRole, '(1=管理员，0=普通用户)');
    
    const usersMenuLink = document.querySelector('.sidebar-link[data-page="users"]');
    const changePasswordLink = document.querySelector('.sidebar-link[data-page="change-password"]');
    
    // 管理员显示用户管理菜单（role='1'）
    if (usersMenuLink) {
      if (userRole === '1') {
        usersMenuLink.style.display = 'flex';
        console.log('✅ 显示用户管理菜单');
      } else {
        usersMenuLink.style.display = 'none';
        console.log('🚫 隐藏用户管理菜单（非管理员）');
      }
    }
    
    // 普通用户显示修改密码菜单（role='0'）
    if (changePasswordLink) {
      if (userRole !== '1') {
        changePasswordLink.style.display = 'flex';
        console.log('✅ 显示修改密码菜单');
      } else {
        changePasswordLink.style.display = 'none';
        console.log('🚫 隐藏修改密码菜单（管理员）');
      }
    }
    
  } catch (error) {
    console.error('检查登录状态失败:', error);
    window.location.href = '/login.html';
  }
}

// ==================== 侧边栏 ====================

// 侧边栏功能由 sidebar.js 统一处理

// ==================== 事件绑定 ====================

function bindEvents() {
  // 表单提交
  elements.changePasswordForm.addEventListener('submit', handleChangePassword);
  
  // 密码强度检查
  elements.newPassword.addEventListener('input', checkPasswordStrength);
  
  // 密码匹配检查
  elements.confirmPassword.addEventListener('input', checkPasswordMatch);
  
  // 取消按钮
  elements.btnCancel.addEventListener('click', () => {
    if (confirm('确定要取消修改密码吗？')) {
      window.location.href = '/';
    }
  });
  
  // 登出
  if (elements.logoutBtn) {
    elements.logoutBtn.addEventListener('click', handleLogout);
  }
}

// ==================== 密码验证 ====================

function checkPasswordStrength() {
  const password = elements.newPassword.value;
  const strengthEl = elements.passwordStrength;
  
  if (!password) {
    strengthEl.textContent = '';
    strengthEl.className = 'password-strength';
    return;
  }
  
  let strength = 0;
  const tips = [];
  
  // 长度检查
  if (password.length >= 6) strength++;
  else tips.push('密码长度至少 6 位');
  
  // 数字检查
  if (/\d/.test(password)) strength++;
  else tips.push('包含数字');
  
  // 字母检查
  if (/[a-zA-Z]/.test(password)) strength++;
  else tips.push('包含字母');
  
  // 特殊字符检查
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;
  else tips.push('包含特殊字符');
  
  // 简单密码检查
  const simplePasswords = ['123456', 'password', 'admin123', '111111'];
  if (simplePasswords.includes(password.toLowerCase())) {
    strength = 0;
    tips.push('不要使用简单密码');
  }
  
  // 显示强度
  const strengthLevels = [
    { text: '❌ 密码太弱', class: 'strength-weak' },
    { text: '⚠️ 密码较弱', class: 'strength-fair' },
    { text: '✅ 密码中等', class: 'strength-good' },
    { text: '👍 密码较强', class: 'strength-strong' },
    { text: '🎉 密码很强', class: 'strength-excellent' }
  ];
  
  strengthEl.textContent = strengthLevels[strength].text;
  strengthEl.className = `password-strength ${strengthLevels[strength].class}`;
  
  if (tips.length > 0 && strength < 3) {
    strengthEl.textContent += ' - 建议：' + tips.join('、');
  }
}

function checkPasswordMatch() {
  const newPassword = elements.newPassword.value;
  const confirmPassword = elements.confirmPassword.value;
  const matchEl = elements.passwordMatch;
  
  if (!confirmPassword) {
    matchEl.textContent = '';
    matchEl.className = 'password-match';
    return;
  }
  
  if (newPassword === confirmPassword) {
    matchEl.textContent = '✅ 两次输入的密码一致';
    matchEl.className = 'password-match match-success';
  } else {
    matchEl.textContent = '❌ 两次输入的密码不一致';
    matchEl.className = 'password-match match-error';
  }
}

// ==================== 修改密码 ====================

async function handleChangePassword(e) {
  e.preventDefault();
  
  const currentPassword = elements.currentPassword.value;
  const newPassword = elements.newPassword.value;
  const confirmPassword = elements.confirmPassword.value;
  
  // 验证
  if (!currentPassword) {
    showError('请输入当前密码');
    elements.currentPassword.focus();
    return;
  }
  
  if (!newPassword) {
    showError('请输入新密码');
    elements.newPassword.focus();
    return;
  }
  
  if (newPassword.length > 12) {
    showError('密码长度不能超过 12 位');
    elements.newPassword.focus();
    return;
  }
  
  if (newPassword !== confirmPassword) {
    showError('两次输入的新密码不一致');
    elements.confirmPassword.focus();
    return;
  }
  
  // 提交修改
  try {
    const response = await fetch('/api/users/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: pageState.currentUser.userId,
        current_password: currentPassword,
        new_password: newPassword
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showSuccess('密码修改成功！请牢记新密码');
      // 清空表单
      elements.changePasswordForm.reset();
      elements.passwordStrength.textContent = '';
      elements.passwordMatch.textContent = '';
      
      // 3 秒后跳转到首页
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);
    } else {
      showError(result.message || '密码修改失败');
    }
  } catch (error) {
    console.error('修改密码失败:', error);
    showError('网络错误，请稍后重试');
  }
}

// ==================== 登出 ====================

async function handleLogout() {
  if (!confirm('确定要退出登录吗？')) return;
  
  try {
    const response = await fetch('/api/logout');
    const result = await response.json();
    
    if (result.success) {
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('username');
      localStorage.removeItem('loginTime');
      localStorage.removeItem('userRole');
      window.location.href = '/login.html';
    }
  } catch (error) {
    console.error('登出失败:', error);
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
    window.location.href = '/login.html';
  }
}

// ==================== 工具函数 ====================

function showError(message) {
  alert('❌ ' + message);
}

function showSuccess(message) {
  alert('✅ ' + message);
}

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', init);
