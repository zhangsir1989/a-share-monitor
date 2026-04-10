/**
 * 分时数据查询页面
 */

const QueryState = {
  page: 1,
  pageSize: 50,
  total: 0,
  stockCode: '',
  tradeDate: '',
  market: ''
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  console.log('📈 分时数据查询页面初始化...');
  
  // 设置默认日期为今天
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('trade-date').value = today;
  QueryState.tradeDate = today.replace(/-/g, '');
  
  // 绑定事件
  document.getElementById('query-btn').addEventListener('click', () => {
    QueryState.page = 1;
    queryData();
  });
  
  document.getElementById('prev-btn').addEventListener('click', () => {
    if (QueryState.page > 1) {
      QueryState.page--;
      queryData();
    }
  });
  
  document.getElementById('next-btn').addEventListener('click', () => {
    const maxPage = Math.ceil(QueryState.total / QueryState.pageSize);
    if (QueryState.page < maxPage) {
      QueryState.page++;
      queryData();
    }
  });
  
  // 自动查询
  queryData();
});

// 查询数据
async function queryData() {
  const stockCode = document.getElementById('stock-code').value.trim();
  const tradeDate = document.getElementById('trade-date').value;
  const market = document.getElementById('market').value;
  
  QueryState.stockCode = stockCode;
  QueryState.tradeDate = tradeDate ? tradeDate.replace(/-/g, '') : '';
  QueryState.market = market;
  
  const params = new URLSearchParams({
    page: QueryState.page,
    pageSize: QueryState.pageSize
  });
  
  if (stockCode) params.append('stock_code', stockCode);
  if (QueryState.tradeDate) params.append('trade_date', QueryState.tradeDate);
  if (market) params.append('market', market);
  
  try {
    const response = await fetch(`/api/intraday-data?${params}`);
    const result = await response.json();
    
    if (result.success) {
      renderTable(result.data);
      renderPagination(result.total);
    } else {
      showError(result.message || '查询失败');
    }
  } catch (error) {
    console.error('查询失败:', error);
    showError('网络错误');
  }
}

// 渲染表格
function renderTable(data) {
  const tbody = document.getElementById('data-body');
  
  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-state">
          <div class="icon">📭</div>
          <p>暂无数据</p>
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = data.map(item => {
    const change = item.price - item.prevClose;
    const changePercent = item.prevClose > 0 ? (change / item.prevClose * 100) : 0;
    const changeClass = change >= 0 ? 'price-up' : 'price-down';
    const changeSign = change >= 0 ? '+' : '';
    
    return `
      <tr>
        <td>${item.time}</td>
        <td class="${changeClass}">${item.price.toFixed(2)}</td>
        <td>${item.open.toFixed(2)}</td>
        <td>${item.high.toFixed(2)}</td>
        <td>${item.low.toFixed(2)}</td>
        <td>${formatNumber(item.volume)}</td>
        <td>${formatAmount(item.amount)}</td>
        <td>${item.prevClose.toFixed(2)}</td>
        <td class="${changeClass}">${changeSign}${change.toFixed(2)} (${changeSign}${changePercent.toFixed(2)}%)</td>
      </tr>
    `;
  }).join('');
}

// 渲染分页
function renderPagination(total) {
  QueryState.total = total;
  const pagination = document.getElementById('pagination');
  const pageInfo = document.getElementById('page-info');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  
  if (total === 0) {
    pagination.style.display = 'none';
    return;
  }
  
  pagination.style.display = 'flex';
  
  const maxPage = Math.ceil(total / QueryState.pageSize);
  pageInfo.textContent = `第 ${QueryState.page} 页 / 共 ${maxPage} 页`;
  
  prevBtn.disabled = QueryState.page <= 1;
  nextBtn.disabled = QueryState.page >= maxPage;
}

// 格式化数字
function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1e8) return (num / 1e8).toFixed(2) + '亿';
  if (num >= 1e4) return (num / 1e4).toFixed(2) + '万';
  return num.toString();
}

// 格式化金额
function formatAmount(amount) {
  if (!amount) return '0';
  if (amount >= 1e8) return (amount / 1e8).toFixed(2) + '亿';
  if (amount >= 1e4) return (amount / 1e4).toFixed(2) + '万';
  return amount.toFixed(0);
}

// 显示错误
function showError(message) {
  const tbody = document.getElementById('data-body');
  tbody.innerHTML = `
    <tr>
      <td colspan="9" class="empty-state">
        <div class="icon">⚠️</div>
        <p>${message}</p>
      </td>
    </tr>
  `;
}
