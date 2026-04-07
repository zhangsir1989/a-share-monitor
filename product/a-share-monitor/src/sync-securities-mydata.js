// 证券信息同步模块 - 对接 MyData API
// Licence: FB1A859B-6832-4F70-AAA2-38274F23FC90

const axios = require('axios');
const LICENCE = 'FB1A859B-6832-4F70-AAA2-38274F23FC90';
const BASE_URL = 'https://api.mairuiapi.com';

// 延迟函数
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 同步股票列表（沪深 A 股）
 */
async function syncStocks(db) {
  console.log('📈 同步沪深 A 股...');
  try {
    const url = `${BASE_URL}/hslt/list/${LICENCE}`;
    const response = await axios.get(url, { timeout: 30000 });
    const stocks = response.data || [];
    
    let count = 0;
    for (const stock of stocks) {
      const code = stock.dm || '';
      const name = stock.mc || '';
      const jys = stock.jys || '';
      
      if (code && name && jys) {
        // 统一转换为小写市场代码
        const marketLower = jys.toLowerCase();
        db.run(`
          INSERT INTO securities (stock_code, stock_name, market, status, updated_at)
          VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
          ON CONFLICT(stock_code, market) DO UPDATE SET
            stock_name = excluded.stock_name,
            updated_at = CURRENT_TIMESTAMP
        `, [code, name, marketLower]);
        count++;
      }
    }
    
    console.log(`✓ 沪深 A 股同步完成：${count} 只`);
    return count;
  } catch (error) {
    console.error('✗ 沪深 A 股同步失败:', error.message);
    return 0;
  }
}

/**
 * 同步科创板股票
 */
async function syncKechuang(db) {
  console.log('🔬 同步科创板股票...');
  try {
    const url = `${BASE_URL}/kc/list/all/${LICENCE}`;
    const response = await axios.get(url, { timeout: 30000 });
    const stocks = response.data || [];
    
    let count = 0;
    for (const stock of stocks) {
      const code = stock.dm || stock.code || '';
      const name = stock.mc || stock.name || '';
      const jys = (stock.jys || 'SH').toLowerCase();  // 科创板属于沪市
      
      if (code && name) {
        db.run(`
          INSERT INTO securities (stock_code, stock_name, market, status, updated_at)
          VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
          ON CONFLICT(stock_code, market) DO UPDATE SET
            stock_name = excluded.stock_name,
            updated_at = CURRENT_TIMESTAMP
        `, [code, name, 'kc']);  // 科创板单独统计
        count++;
      }
    }
    
    console.log(`✓ 科创板股票同步完成：${count} 只`);
    return count;
  } catch (error) {
    console.error('✗ 科创板股票同步失败:', error.message);
    return 0;
  }
}

/**
 * 同步北交所股票
 */
async function syncBeijing(db) {
  console.log('🏛️ 同步北交所股票...');
  try {
    const url = `${BASE_URL}/bj/list/all/${LICENCE}`;
    const response = await axios.get(url, { timeout: 30000 });
    const stocks = response.data || [];
    
    let count = 0;
    for (const stock of stocks) {
      const code = stock.dm || stock.code || '';
      const name = stock.mc || stock.name || '';
      const jys = (stock.jys || 'BJ').toLowerCase();  // 北交所
      
      if (code && name) {
        db.run(`
          INSERT INTO securities (stock_code, stock_name, market, status, updated_at)
          VALUES (?, ?, 'bj', 1, CURRENT_TIMESTAMP)
          ON CONFLICT(stock_code, market) DO UPDATE SET
            stock_name = excluded.stock_name,
            updated_at = CURRENT_TIMESTAMP
        `, [code, name]);
        count++;
      }
    }
    
    console.log(`✓ 北交所股票同步完成：${count} 只`);
    return count;
  } catch (error) {
    console.error('✗ 北交所股票同步失败:', error.message);
    return 0;
  }
}

/**
 * 同步指数、行业、概念（全品类代码）
 */
async function syncIndices(db) {
  console.log('📊 同步指数、行业、概念...');
  try {
    const url = `${BASE_URL}/hszg/list/${LICENCE}`;
    const response = await axios.get(url, { timeout: 30000 });
    const items = response.data || [];
    
    let count = 0;
    for (const item of items) {
      // 只同步叶子节点
      if (item.isleaf !== 1) continue;
      
      const code = item.code || '';
      const name = item.name || '';
      const type1 = item.type1 || 0;
      
      // 根据 type1 确定市场类型
      let market = '';
      if (type1 === 0) market = 'sh';  // A 股
      else if (type1 === 1) market = 'sh';  // 创业板
      else if (type1 === 2) market = 'sh';  // 科创板
      else if (type1 === 3) market = 'sh';  // 基金
      else if (type1 === 4) market = 'hk';  // 港股
      else if (type1 === 5) market = 'sh';  // 债券
      else if (type1 === 6) market = 'us';  // 美股
      else if (type1 === 7) market = 'fx';  // 外汇
      else if (type1 === 8) market = 'qh';  // 期货
      else if (type1 === 9) market = 'au';  // 黄金
      else if (type1 === 10) market = 'uk';  // 英国股市
      else continue;
      
      if (code && name && market) {
        db.run(`
          INSERT INTO securities (stock_code, stock_name, market, status, updated_at)
          VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
          ON CONFLICT(stock_code, market) DO UPDATE SET
            stock_name = excluded.stock_name,
            updated_at = CURRENT_TIMESTAMP
        `, [code, name, market]);
        count++;
      }
    }
    
    console.log(`✓ 指数、行业、概念同步完成：${count} 只`);
    return count;
  } catch (error) {
    console.error('✗ 指数、行业、概念同步失败:', error.message);
    return 0;
  }
}

/**
 * 同步概念指数
 */
async function syncConceptIndices(db) {
  console.log('💡 同步概念指数...');
  try {
    const url = `${BASE_URL}/hslt/sectorslist/${LICENCE}`;
    const response = await axios.get(url, { timeout: 30000 });
    const items = response.data || [];
    
    let count = 0;
    for (const item of items) {
      const code = item.dm || '';
      const name = item.mc || '';
      const jys = (item.jys || 'bk').toLowerCase();  // 板块指数
      
      if (code && name) {
        db.run(`
          INSERT INTO securities (stock_code, stock_name, market, status, updated_at)
          VALUES (?, ?, 'idx', 1, CURRENT_TIMESTAMP)
          ON CONFLICT(stock_code, market) DO UPDATE SET
            stock_name = excluded.stock_name,
            updated_at = CURRENT_TIMESTAMP
        `, [code, name]);  // 概念指数统一为 idx
        count++;
      }
    }
    
    console.log(`✓ 概念指数同步完成：${count} 只`);
    return count;
  } catch (error) {
    console.error('✗ 概念指数同步失败:', error.message);
    return 0;
  }
}

/**
 * 同步基金（ETF、沪深基金）
 */
async function syncFunds(db) {
  console.log('💰 同步基金（ETF、沪深基金）...');
  try {
    // 同步 ETF 基金
    const etfUrl = `${BASE_URL}/fd/list/etf/${LICENCE}`;
    const etfResponse = await axios.get(etfUrl, { timeout: 30000 });
    const etfFunds = etfResponse.data || [];
    
    let count = 0;
    for (const fund of etfFunds) {
      const code = fund.dm || fund.code || '';
      const name = fund.mc || fund.name || '';
      const jys = (fund.jys || 'SH').toLowerCase();  // 根据交易所区分
      
      if (code && name) {
        db.run(`
          INSERT INTO securities (stock_code, stock_name, market, status, updated_at)
          VALUES (?, ?, 'etf', 1, CURRENT_TIMESTAMP)
          ON CONFLICT(stock_code, market) DO UPDATE SET
            stock_name = excluded.stock_name,
            updated_at = CURRENT_TIMESTAMP
        `, [code, name]);  // ETF单独统计
        count++;
      }
    }
    
    // 同步沪深基金（LOF、场内基金等）
    const fundUrl = `${BASE_URL}/fd/list/all/${LICENCE}`;
    const fundResponse = await axios.get(fundUrl, { timeout: 30000 });
    const funds = fundResponse.data || [];
    
    let fundCount = 0;
    for (const fund of funds) {
      const code = fund.dm || fund.code || '';
      const name = fund.mc || fund.name || '';
      
      // 跳过已同步的 ETF
      if (etfFunds.some(e => (e.dm || e.code) === code)) continue;
      
      if (code && name) {
        db.run(`
          INSERT INTO securities (stock_code, stock_name, market, status, updated_at)
          VALUES (?, ?, 'fund', 1, CURRENT_TIMESTAMP)
          ON CONFLICT(stock_code, market) DO UPDATE SET
            stock_name = excluded.stock_name,
            updated_at = CURRENT_TIMESTAMP
        `, [code, name]);  // 其他基金单独统计
        fundCount++;
      }
    }
    
    console.log(`✓ 基金同步完成：ETF ${count} 只，沪深基金 ${fundCount} 只`);
    return count + fundCount;
  } catch (error) {
    console.error('✗ 基金同步失败:', error.message);
    return 0;
  }
}

/**
 * 同步一级市场板块
 */
async function syncPrimaryMarket(db) {
  console.log('📋 同步一级市场板块...');
  try {
    const url = `${BASE_URL}/hslt/primarylist/${LICENCE}`;
    const response = await axios.get(url, { timeout: 30000 });
    const items = response.data || [];
    
    let count = 0;
    for (const item of items) {
      const name = item.mc || '';
      
      if (name) {
        // 一级市场板块作为特殊证券存储
        db.run(`
          INSERT INTO securities (stock_code, stock_name, market, status, updated_at)
          VALUES (?, ?, 'board', 1, CURRENT_TIMESTAMP)
          ON CONFLICT(stock_code, market) DO UPDATE SET
            stock_name = excluded.stock_name,
            updated_at = CURRENT_TIMESTAMP
        `, [name, name]);
        count++;
      }
    }
    
    console.log(`✓ 一级市场板块同步完成：${count} 个`);
    return count;
  } catch (error) {
    console.error('✗ 一级市场板块同步失败:', error.message);
    return 0;
  }
}

/**
 * 主同步函数
 */
async function syncAllSecurities(db) {
  console.log('🚀 开始同步证券信息（MyData API）...');
  const startTime = Date.now();
  
  let total = 0;
  total += await syncStocks(db);
  await delay(500);  // 避免频率限制
  
  total += await syncKechuang(db);
  await delay(500);
  
  total += await syncBeijing(db);
  await delay(500);
  
  total += await syncIndices(db);
  await delay(500);
  
  total += await syncConceptIndices(db);
  await delay(500);
  
  total += await syncFunds(db);
  await delay(500);
  
  total += await syncPrimaryMarket(db);
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ 证券信息同步完成！共计：${total} 只证券，耗时：${duration}秒`);
  
  return {
    success: true,
    total,
    duration,
    message: `同步完成，共计 ${total} 只证券`
  };
}

module.exports = {
  syncAllSecurities,
  syncStocks,
  syncKechuang,
  syncBeijing,
  syncIndices,
  syncConceptIndices,
  syncFunds,
  syncPrimaryMarket
};
