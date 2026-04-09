async function fetchMarketVolume() {
  try {
    // 使用 MyData API 获取上证指数和深证成指的实时数据
    const [shResp, szResp] = await Promise.all([
      mydataApi.get(`${MYDATA_BASE_URL}/hsindex/real/time/000001.SH/${MYDATA_LICENCE}`),
      mydataApi.get(`${MYDATA_BASE_URL}/hsindex/real/time/399001.SZ/${MYDATA_LICENCE}`)
    ]);
    
    const shData = shResp.data;
    const szData = szResp.data;
    
    if (!shData || !shData.cje || !szData || !szData.cje) {
      console.error('MyData 指数数据格式错误，回退腾讯API');
      const resp = await txApi.get('http://qt.gtimg.cn/q=sh000001,sz399001');
      const text = iconv.decode(resp.data, 'gbk');
      const shMatch = text.match(/v_sh000001="([^"]+)"/);
      const szMatch = text.match(/v_sz399001="([^"]+)"/);
      if (!shMatch || !szMatch) return null;
      const shParts = shMatch[1].split('~');
      const szParts = szMatch[1].split('~');
      dataSourceStatus.volume = 'tencent';
      const shAmount = (parseFloat(shParts[37]) || 0) / 10000;
      const szAmount = (parseFloat(szParts[37]) || 0) / 10000;
      const totalAmount = shAmount + szAmount;
      const totalVolume = (parseFloat(shParts[6]) + parseFloat(szParts[6])) / 10000;
      return {
        totalVolume: Math.round(totalVolume),
        totalAmount: Math.round(totalAmount * 100) / 100,
        shVolume: Math.round(parseFloat(shParts[6]) / 10000),
        szVolume: Math.round(parseFloat(szParts[6]) / 10000),
        shAmount: Math.round(shAmount * 100) / 100,
        szAmount: Math.round(szAmount * 100) / 100,
        shRatio: totalAmount > 0 ? ((shAmount / totalAmount) * 100).toFixed(2) : '0',
        szRatio: totalAmount > 0 ? ((szAmount / totalAmount) * 100).toFixed(2) : '0'
      };
    }
    
    // MyData API: cje 是成交额（元），cjl 是成交量（手）
    const shAmount = shData.cje / 100000000;
    const szAmount = szData.cje / 100000000;
    const shVolume = shData.cjl / 10000;
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
