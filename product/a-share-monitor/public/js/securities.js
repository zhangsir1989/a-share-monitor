/**
 * 证券信息管理页面
 */

// 页面状态
const pageState = {
  securities: [],
  currentPage: 1,
  pageSize: 20,
  total: 0,
  search: '',
  market: ''
};

// DOM 元素
let elements = {};

// 搜索建议
let searchTimeout = null;
let selectedIndex = -1;
let currentSuggestions = [];

// ==================== 初始化 ====================

function init() {
  try {
    cacheElements();
    
    // 检查登录状态，失败会跳转
    if (!checkLoginStatus()) return;
    
    bindEvents();
    loadStats();
    loadSecurities();
  } catch (error) {
    console.error('初始化失败:', error);
    // 即使出错也显示基本内容
    if (elements.securitiesTable) {
      elements.securitiesTable.innerHTML = '<tr><td colspan="5" class="loading">加载失败，请刷新页面</td></tr>';
    }
  }
}

function cacheElements() {
  elements = {
    sidebarUsername: document.getElementById('sidebar-username'),
    btnSync: document.getElementById('btn-sync'),
    searchInput: document.getElementById('search-input'),
    searchSuggestions: document.getElementById('search-suggestions'),
    marketFilter: document.getElementById('market-filter'),
    pageSizeSelect: document.getElementById('page-size-select'),
    btnSearch: document.getElementById('btn-search'),
    btnReset: document.getElementById('btn-reset'),
    btnClearAll: document.getElementById('btn-clear-all'),
    securitiesTable: document.getElementById('securities-table'),
    totalCount: document.getElementById('total-count'),
    shCount: document.getElementById('sh-count'),
    szCount: document.getElementById('sz-count'),
    bjCount: document.getElementById('bj-count'),
    kcCount: document.getElementById('kc-count'),
    etfCount: document.getElementById('etf-count'),
    fundCount: document.getElementById('fund-count'),
    idxCount: document.getElementById('idx-count'),
    pageInfo: document.getElementById('page-info'),
    pageNum: document.getElementById('page-num'),
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next')
  };
}

// ==================== 登录状态 ====================

function checkLoginStatus() {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  const username = localStorage.getItem('username');
  const userRole = localStorage.getItem('userRole') || '0';
  
  if (!isLoggedIn || !username || userRole !== '1') {
    console.warn('未登录或非管理员，跳转到登录页');
    window.location.href = '/login.html';
    return false;
  }
  
  if (elements.sidebarUsername) {
    elements.sidebarUsername.textContent = username;
  }
  return true;
}

// ==================== 加载统计数据 ====================

async function loadStats() {
  try {
    const response = await fetch('/api/securities/stats');
    const result = await response.json();
    
    if (result.success) {
      const { total, byMarket } = result.data;
      if (elements.totalCount) elements.totalCount.textContent = total.toLocaleString();
      if (elements.shCount) elements.shCount.textContent = (byMarket.sh || 0).toLocaleString();
      if (elements.szCount) elements.szCount.textContent = (byMarket.sz || 0).toLocaleString();
      if (elements.bjCount) elements.bjCount.textContent = (byMarket.bj || 0).toLocaleString();
      if (elements.kcCount) elements.kcCount.textContent = (byMarket.kc || 0).toLocaleString();
      if (elements.etfCount) elements.etfCount.textContent = (byMarket.etf || 0).toLocaleString();
      if (elements.fundCount) elements.fundCount.textContent = (byMarket.fund || 0).toLocaleString();
      if (elements.idxCount) elements.idxCount.textContent = (byMarket.idx || 0).toLocaleString();
    }
  } catch (error) {
    console.error('加载统计失败:', error);
    if (elements.totalCount) elements.totalCount.textContent = '-';
  }
}

// ==================== 加载证券列表 ====================

async function loadSecurities() {
  try {
    const params = new URLSearchParams({
      page: pageState.currentPage,
      pageSize: pageState.pageSize,
      search: pageState.search,
      market: pageState.market,
      fuzzy: 'true'  // 启用模糊查询
    });
    
    const response = await fetch(`/api/securities?${params}`);
    const result = await response.json();
    
    if (result.success) {
      pageState.securities = result.data || [];
      pageState.total = result.total || 0;
      renderTable();
      updatePagination();
    } else {
      console.warn('API 返回失败:', result.message);
      renderTable(); // 即使失败也显示空表格
      updatePagination();
    }
  } catch (error) {
    console.error('加载证券列表失败:', error);
    // 显示空表格而不是错误
    pageState.securities = [];
    pageState.total = 0;
    renderTable();
    updatePagination();
  }
}

// ==================== 渲染表格 ====================

function renderTable() {
  // 即使没有数据也要显示表格结构
  if (!pageState.securities || pageState.securities.length === 0) {
    // 显示“暂无数据”行，但保持表格结构
    elements.securitiesTable.innerHTML = '<tr><td colspan="5" class="loading">暂无数据</td></tr>';
  } else {
    const html = pageState.securities.map(sec => {
      const marketText = {
        'sh': '沪市',
        'sz': '深市',
        'bj': '北交所',
        'kc': '科创板',
        'etf': 'ETF',
        'fund': '基金',
        'idx': '指数/概念',
        'hk': '港股',
        'ct': '股转'
      }[sec.market] || sec.market;
      
      const statusClass = sec.status === 1 ? 'active' : 'inactive';
      const statusText = sec.status === 1 ? '✓ 正常' : '✗ 停牌';
      
      return `<tr>
        <td>${sec.stock_code}</td>
        <td>${sec.stock_name || '--'}</td>
        <td>${marketText}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td>${sec.updated_at || '--'}</td>
      </tr>`;
    }).join('');
    
    elements.securitiesTable.innerHTML = html;
  }
}

// ==================== 分页 ====================

function updatePagination() {
  const totalPages = Math.ceil(pageState.total / pageState.pageSize) || 1;
  
  elements.pageInfo.textContent = `共 ${pageState.total} 条`;
  elements.pageNum.textContent = `${pageState.currentPage} / ${totalPages}`;
  
  elements.btnPrev.disabled = pageState.currentPage === 1;
  elements.btnNext.disabled = pageState.currentPage >= totalPages;
  
  // 更新分页大小选择框
  if (elements.pageSizeSelect) {
    elements.pageSizeSelect.value = pageState.pageSize;
  }
}

// ==================== 事件绑定 ====================

function bindEvents() {
  // 同步证券
  if (elements.btnSync) {
    elements.btnSync.addEventListener('click', handleSync);
  }
  
  // 搜索
  if (elements.btnSearch) {
    elements.btnSearch.addEventListener('click', () => {
      pageState.search = elements.searchInput ? elements.searchInput.value.trim() : '';
      pageState.market = elements.marketFilter ? elements.marketFilter.value : '';
      pageState.currentPage = 1;
      loadSecurities();
    });
  }
  
  if (elements.searchInput) {
    // 输入时显示搜索建议
    elements.searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      
      // 清除之前的定时器
      if (searchTimeout) clearTimeout(searchTimeout);
      
      if (!query || query.length < 1) {
        hideSuggestions();
        return;
      }
      
      // 延迟 300ms 后再请求，避免频繁请求
      searchTimeout = setTimeout(() => {
        fetchSuggestions(query);
      }, 300);
    });
    
    // 键盘导航
    elements.searchInput.addEventListener('keydown', (e) => {
      if (!currentSuggestions || currentSuggestions.length === 0) return;
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % currentSuggestions.length;
        highlightSuggestion(selectedIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + currentSuggestions.length) % currentSuggestions.length;
        highlightSuggestion(selectedIndex);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0 && currentSuggestions[selectedIndex]) {
          selectSuggestion(currentSuggestions[selectedIndex]);
        } else {
          pageState.search = elements.searchInput.value.trim();
          pageState.currentPage = 1;
          loadSecurities();
        }
      } else if (e.key === 'Escape') {
        hideSuggestions();
      }
    });
    
    // 点击外部关闭建议框
    document.addEventListener('click', (e) => {
      if (elements.searchSuggestions && !elements.searchSuggestions.contains(e.target)) {
        hideSuggestions();
      }
    });
    
    elements.searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        pageState.search = this.value.trim();
        pageState.currentPage = 1;
        loadSecurities();
      }
    });
  }
  
  if (elements.marketFilter) {
    elements.marketFilter.addEventListener('change', () => {
      pageState.market = this.value;
      pageState.currentPage = 1;
      loadSecurities();
    });
  }
  
  // 重置
  if (elements.btnReset) {
    elements.btnReset.addEventListener('click', () => {
      if (elements.searchInput) elements.searchInput.value = '';
      if (elements.marketFilter) elements.marketFilter.value = '';
      pageState.search = '';
      pageState.market = '';
      pageState.currentPage = 1;
      loadSecurities();
    });
  }
  
  // 全部清空（删除所有证券数据）
  if (elements.btnClearAll) {
    elements.btnClearAll.addEventListener('click', async () => {
      if (!confirm('⚠️ 确定要清空所有证券信息吗？\n\n此操作将删除数据库中所有证券数据，不可恢复！')) {
        return;
      }
      
      try {
        const response = await fetch('/api/securities/clear-all', {
          method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
          alert('✅ 已清空所有证券信息！');
          // 清空搜索框和筛选条件
          if (elements.searchInput) elements.searchInput.value = '';
          if (elements.marketFilter) elements.marketFilter.value = '';
          if (elements.pageSizeSelect) elements.pageSizeSelect.value = '20';
          pageState.search = '';
          pageState.market = '';
          pageState.pageSize = 20;
          pageState.currentPage = 1;
          // 重新加载数据和统计
          loadStats();
          loadSecurities();
        } else {
          alert('❌ 清空失败：' + result.message);
        }
      } catch (error) {
        console.error('清空证券信息失败:', error);
        alert('❌ 网络错误，请稍后重试');
      }
    });
  }
  
  // 分页大小选择
  if (elements.pageSizeSelect) {
    elements.pageSizeSelect.addEventListener('change', () => {
      const newSize = parseInt(elements.pageSizeSelect.value);
      if (newSize > 0 && newSize <= 200) {
        pageState.pageSize = newSize;
        pageState.currentPage = 1; // 重置到第一页
        loadSecurities();
      }
    });
  }
  
  // 分页
  if (elements.btnPrev) {
    elements.btnPrev.addEventListener('click', () => {
      if (pageState.currentPage > 1) {
        pageState.currentPage--;
        loadSecurities();
      }
    });
  }
  
  if (elements.btnNext) {
    elements.btnNext.addEventListener('click', () => {
      const totalPages = Math.ceil(pageState.total / pageState.pageSize) || 1;
      if (pageState.currentPage < totalPages) {
        pageState.currentPage++;
        loadSecurities();
      }
    });
  }
}

// ==================== 搜索建议 ====================

async function fetchSuggestions(query) {
  try {
    const response = await fetch(`/api/securities/suggestions?search=${encodeURIComponent(query)}&limit=10`);
    const result = await response.json();
    
    if (result.success && result.data && result.data.length > 0) {
      currentSuggestions = result.data;
      selectedIndex = -1;
      showSuggestions(result.data);
    } else {
      hideSuggestions();
    }
  } catch (error) {
    console.error('获取搜索建议失败:', error);
    hideSuggestions();
  }
}

function showSuggestions(suggestions) {
  if (!elements.searchSuggestions) return;
  
  const html = suggestions.map((item, index) => `
    <div class="suggestion-item" data-index="${index}" data-code="${item.stock_code}" data-name="${item.stock_name}">
      <span class="suggestion-code">${item.stock_code}</span>
      <span class="suggestion-name">${item.stock_name}</span>
      <span class="suggestion-market">${getMarketName(item.market)}</span>
    </div>
  `).join('');
  
  elements.searchSuggestions.innerHTML = html;
  elements.searchSuggestions.style.display = 'block';
  
  // 绑定点击事件
  elements.searchSuggestions.querySelectorAll('.suggestion-item').forEach(item => {
    item.addEventListener('click', () => {
      const code = item.getAttribute('data-code');
      const name = item.getAttribute('data-name');
      selectSuggestion({ stock_code: code, stock_name: name });
    });
  });
}

function hideSuggestions() {
  if (elements.searchSuggestions) {
    elements.searchSuggestions.style.display = 'none';
  }
  currentSuggestions = [];
  selectedIndex = -1;
}

function highlightSuggestion(index) {
  if (!elements.searchSuggestions) return;
  
  elements.searchSuggestions.querySelectorAll('.suggestion-item').forEach((item, i) => {
    if (i === index) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

function selectSuggestion(item) {
  elements.searchInput.value = item.stock_code;
  pageState.search = item.stock_code;
  pageState.currentPage = 1;
  hideSuggestions();
  loadSecurities();
}

function getMarketName(market) {
  const names = {
    'sh': '沪市',
    'sz': '深市',
    'bj': '北交所',
    'kc': '科创板',
    'etf': 'ETF',
    'fund': '基金',
    'idx': '指数/概念',
    'hk': '港股',
    'ct': '股转'
  };
  return names[market] || market;
}

// ==================== 同步证券 ====================

async function handleSync() {
  if (!confirm('确定要同步证券信息吗？\n\n这将获取所有 A 股、ETF、港股、北交所及股转市场的股票信息。\n可能需要几分钟时间...')) {
    return;
  }
  
  elements.btnSync.disabled = true;
  elements.btnSync.textContent = '🔄 同步中...';
  
  try {
    const response = await fetch('/api/securities/sync', {
      method: 'POST'
    });
    
    const result = await response.json();
    
    if (result.success) {
      alert('✅ 证券信息同步完成！\n\n' + result.message);
      loadStats();
      loadSecurities();
    } else {
      alert('❌ 同步失败：' + result.message);
    }
  } catch (error) {
    console.error('同步证券失败:', error);
    alert('❌ 网络错误，请稍后重试');
  } finally {
    elements.btnSync.disabled = false;
    elements.btnSync.textContent = '🔄 同步证券';
  }
}

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', init);
