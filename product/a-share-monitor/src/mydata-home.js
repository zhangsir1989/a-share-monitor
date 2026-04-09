/**
 * MyData API 首页数据对接
 * 添加到 data-api.js 的函数
 */

// ==================== 成交量数据 ====================

/**
 * 获取全市场成交量数据（使用 MyData API 指数实时数据）
 */
async function fetchMarketVolumeMyData() {
  try {
    // 使用 MyData API 获取上证指数和深证成指的实时数据
    const [shResp, szResp] = await Promise.all([
      mydataApi.get(`${MYDATA_BASE_URL}/hsindex/real/time/000001.SH/${MYDATA_LICENCE}`),
      mydataApi.get(`${MYDATA_BASE_URL}/hsindex/real/time/399001.SZ/${MYDATA_LICENCE}`)
    ]);
    
    const shData = shResp.data;
    const szData = szResp.data;
    
    if (!shData || !shData.cje || !szData || !szData.cje) {
      console.error('MyData 指数数据格式错误');
      return null;
    }
    
    // MyData API: cje 是成交额（元），cjl 是成交量（手）
    const shAmount = shData.cje / 100000000; // 元转亿元
    const szAmount = szData.cje / 100000000;
    const shVolume = shData.cjl / 10000; // 手转万手
    const szVolume = szData.cjl / 10000;
    const totalAmount = shAmount + szAmount;
    const totalVolume = shVolume + szVolume;
    
    dataSourceStatus.volume = 'mydata';
    
    return {
      totalVolume: Math.round(totalVolume),
      totalAmount: Math.round(totalAmount * 100) / 100,
      shVolume: Math.round(shVolume),
      szVolume: Math.round(szVolume),
      shAmount: Math.round(shAmount * 100) / 100,
      szAmount: Math.round(szAmount * 100) / 100,
      shRatio: totalAmount > 0 ? ((shAmount / totalAmount) * 100).toFixed(2) : '0',
      szRatio: totalAmount > 0 ? ((szAmount / totalAmount) * 100).toFixed(2) : '0'
    };
  } catch (e) {
    console.error('MyData获取成交量失败:', e.message);
    return null;
  }
}

// ==================== 涨停股池数据 ====================

/**
 * 获取涨停股池数据（使用 MyData API）
 */
async function fetchLimitUpStocksMyData() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const resp = await mydataApi.get(`${MYDATA_BASE_URL}/hslt/ztgc/${today}/${MYDATA_LICENCE}`);
    
    const data = resp.data;
    if (!Array.isArray(data)) {
      console.error('MyData 涨停股池数据格式错误');
      return [];
    }
    
    dataSourceStatus.limitUp = 'mydata';
    
    return data.map(item => ({
      code: item.dm,
      name: item.mc,
      price: item.p,
      changePercent: item.zf,
      amount: item.cje / 100000000, // 元转亿元
      turnover: item.hs,
      lbc: item.lbc || 1, // 连板数
      fbt: item.fbt, // 首次封板时间
      lbt: item.lbt, // 最后封板时间
      industry: item.hy || ''
    }));
  } catch (e) {
    console.error('MyData获取涨停股池失败:', e.message);
    return [];
  }
}

// ==================== 高换手率数据 ====================

/**
 * 获取高换手率数据（使用 MyData API 全市场实时数据）
 */
async function fetchHighTurnoverMyData() {
  try {
    // 使用 MyData API 获取全部A股实时数据
    const resp = await mydataApi.get(`${MYDATA_BASE_URL}/hsrl/ssjy_more/${MYDATA_LICENCE}?stock_codes=all&sort=hs&limit=50`);
    
    const data = resp.data;
    if (!Array.isArray(data)) {
      console.error('MyData 高换手率数据格式错误');
      return [];
    }
    
    // 按换手率排序，取TOP50
    const sorted = data.sort((a, b) => (b.hs || 0) - (a.hs || 0)).slice(0, 50);
    
    dataSourceStatus.turnover = 'mydata';
    
    return sorted.map(item => ({
      code: item.dm,
      name: item.mc,
      price: item.p,
      changePercent: item.pc,
      turnoverRate: item.hs,
      actualTurnoverRate: item.hs, // 实际换手率（MyData暂无区分）
      amount: item.cje / 100000000, // 元转亿元
      volume: item.cjl,
      industry: ''
    }));
  } catch (e) {
    console.error('MyData获取高换手率失败:', e.message);
    return [];
  }
}

module.exports = {
  fetchMarketVolumeMyData,
  fetchLimitUpStocksMyData,
  fetchHighTurnoverMyData
};
