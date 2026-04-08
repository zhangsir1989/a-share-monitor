// 逐笔成交明细同步模块 - 对接 MyData API
// Licence: FB1A859B-6832-4F70-AAA2-38274F23FC90

const axios = require('axios');
const LICENCE = 'FB1A859B-6832-4F70-AAA2-38274F23FC90';
const BASE_URL = 'https://api.mairuiapi.com';

// 延迟函数
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// 速率限制：1 分钟 2999 次 = 每秒约 50 次，即每 20ms 一次
const RATE_LIMIT_MS = 20;
const MAX_REQUESTS_PER_MINUTE = 2999;
let requestCount = 0;
let lastResetTime = Date.now();

// 暂停标志
let abortFlag = false;

/**
 * 设置暂停标志
 * @param {boolean} abort - true 表示暂停同步
 */
function setAbort(abort) {
  abortFlag = abort;
  if (abort) {
    console.log('⏸️ 已设置暂停标志，同步将在下一次循环时停止');
  }
}

/**
 * 获取暂停标志状态
 */
function getAbortStatus() {
  return abortFlag;
}

/**
 * 从证券信息表获取需要同步逐笔成交的证券
 * 包括：沪深 A 股（主板、创业板、科创板）、ETF、LOF、场内基金
 */
function getSecuritiesForTickTrade(db) {
  console.log('📋 获取需要同步逐笔成交的证券列表...');
  
  // 查询沪深 A 股（主板、创业板、科创板）和 ETF/LOF/场内基金
  // 注意：stock_code 格式为 "000001.SZ" 或 "600000.SH"（带市场后缀）
  const result = db.exec(`
    SELECT stock_code, stock_name, market 
    FROM securities 
    WHERE status = 1 
    AND (
      -- 沪市 A 股（主板 60、科创板 68）
      (market = 'sh' AND stock_code LIKE '60____%')
      OR (market = 'sh' AND stock_code LIKE '68____%')
      -- 深市 A 股（主板 00、创业板 30）
      OR (market = 'sz' AND stock_code LIKE '00____%')
      OR (market = 'sz' AND stock_code LIKE '30____%')
      -- ETF/LOF/场内基金（沪市 51/58，深市 15/16/18）
      OR (market = 'sh' AND stock_code LIKE '51____%')
      OR (market = 'sh' AND stock_code LIKE '58____%')
      OR (market = 'sz' AND stock_code LIKE '15____%')
      OR (market = 'sz' AND stock_code LIKE '16____%')
      OR (market = 'sz' AND stock_code LIKE '18____%')
    )
    ORDER BY market, stock_code
  `);
  
  if (result.length === 0) {
    console.log('⚠️ 未找到需要同步的证券');
    return [];
  }
  
  const securities = [];
  for (const row of result[0].values) {
    securities.push({
      code: row[0],
      name: row[1],
      market: row[2]
    });
  }
  
  console.log(`✓ 获取到 ${securities.length} 只证券需要同步逐笔成交（沪深 A 股+ETF/LOF/场内基金）`);
  return securities;
}

/**
 * 速率限制控制
 */
function rateLimit() {
  const now = Date.now();
  
  // 每分钟重置计数器
  if (now - lastResetTime > 60000) {
    requestCount = 0;
    lastResetTime = now;
    console.log(`🔄 速率限制计数器已重置`);
  }
  
  // 检查是否超过限制
  if (requestCount >= MAX_REQUESTS_PER_MINUTE) {
    const waitTime = 60000 - (now - lastResetTime);
    console.log(`⏳ 已达到每分钟 ${MAX_REQUESTS_PER_MINUTE} 次限制，等待 ${Math.ceil(waitTime/1000)} 秒...`);
    return delay(waitTime);
  }
  
  requestCount++;
  return delay(RATE_LIMIT_MS);
}

/**
 * 同步单只证券的逐笔成交数据（使用 MyData API）
 * API 格式：https://api.mairuiapi.com/hsrl/zbjy/{code}/{licence}
 * 注意：code 不带市场后缀（如 600570，不是 600570.SH）
 */
async function syncSingleTickTrade(db, code, market) {
  try {
    // 速率限制
    await rateLimit();
    
    // 去掉证券代码中的市场后缀（如 600570.SH → 600570）
    const pureCode = code.split('.')[0];
    
    // MyData API：证券代码不带后缀
    const url = `${BASE_URL}/hsrl/zbjy/${pureCode}/${LICENCE}`;
    const response = await axios.get(url, { timeout: 30000 });
    const tickData = response.data || [];
    
    if (tickData.length === 0) {
      return 0;
    }
    
    let count = 0;
    const bizDate = new Date().toISOString().split('T')[0];  // 业务日期（备用）
    
    for (const tick of tickData) {
      // 日期字段：优先取接口里的日期，如果没有则取业务日期
      // 接口返回的日期格式可能是 "2026-04-03" 或 "20260403"
      let tradeDate = tick.d || tick.date || bizDate;
      // 标准化日期格式（去除连字符或转换为 YYYY-MM-DD）
      if (tradeDate && !tradeDate.includes('-')) {
        // 格式为 YYYYMMDD → YYYY-MM-DD
        tradeDate = tradeDate.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
      }
      const tradeTime = tick.t || tick.time || '';
      const volume = tick.v || tick.volume || 0;
      const price = tick.p || tick.price || 0;
      const direction = tick.ts || tick.direction || 0;  // 0:中性 1:买入 2:卖出
      const amount = tick.a || tick.amount || (price * volume);
      
      if (tradeTime && volume > 0 && price > 0) {
        db.run(`
          INSERT OR REPLACE INTO tick_trade (
            trade_date, symbol, market, trade_time, 
            price, volume, amount, direction
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          tradeDate,
          pureCode,  // 使用纯代码（不带后缀）
          market,
          tradeTime,
          price,
          volume,
          amount,
          direction
        ]);
        count++;
      }
    }
    
    return count;
  } catch (error) {
    // 404 或其他错误时不打印错误，因为不是所有股票都有逐笔成交数据
    if (error.response?.status !== 404) {
      console.error(`✗ ${code} 逐笔成交同步失败:`, error.message);
    }
    return 0;
  }
}

/**
 * 主同步函数
 * @param {Object} db - 数据库实例
 * @param {Function} onProgress - 进度回调函数 (current, total, records)
 */
async function syncAllTickTrade(db, onProgress) {
  console.log('🚀 开始同步逐笔成交明细（MyData API）...');
  console.log(`📊 速率限制：${MAX_REQUESTS_PER_MINUTE} 次/分钟，间隔 ${RATE_LIMIT_MS}ms`);
  const startTime = Date.now();
  requestCount = 0;  // 重置计数器
  lastResetTime = Date.now();
  abortFlag = false;  // 重置暂停标志
  
  // 1. 获取需要同步的证券列表
  const securities = getSecuritiesForTickTrade(db);
  
  if (securities.length === 0) {
    return {
      success: false,
      message: '未找到需要同步的证券'
    };
  }
  
  const total = securities.length;
  
  // 2. 逐只同步逐笔成交数据
  let totalSynced = 0;
  let successCount = 0;
  let failCount = 0;
  
  console.log(`📈 开始同步 ${total} 只证券的逐笔成交数据...`);
  
  for (let i = 0; i < securities.length; i++) {
    // 检查暂停标志
    if (abortFlag) {
      console.log(`⏸️ 同步已暂停，已处理 ${i} 只证券`);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      return {
        success: true,
        aborted: true,
        totalSecurities: i,
        successCount,
        failCount,
        totalRecords: totalSynced,
        apiCalls: requestCount,
        duration,
        message: `同步已暂停，${i} 只证券已处理，${totalSynced} 条成交记录`
      };
    const sec = securities[i];
    
    const count = await syncSingleTickTrade(db, sec.code, sec.market);
    
    if (count > 0) {
      totalSynced += count;
      successCount++;
    } else {
      failCount++;
    }
    
    // 每 10 只更新一次进度
    if ((i + 1) % 10 === 0) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`📊 进度：${i + 1}/${total}，成功：${successCount}，失败：${failCount}，成交记录：${totalSynced}，API 调用：${requestCount}，耗时：${duration}秒`);
      
      // 调用进度回调
      if (onProgress) {
        onProgress(i + 1, total, totalSynced);
      }
    }
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ 逐笔成交同步完成！`);
  console.log(`   同步证券：${total} 只`);
  console.log(`   成功：${successCount} 只，失败：${failCount} 只`);
  console.log(`   成交记录：${totalSynced} 条`);
  console.log(`   API 调用：${requestCount} 次`);
  console.log(`   耗时：${duration}秒`);
  
  return {
    success: true,
    totalSecurities: total,
    successCount,
    failCount,
    totalRecords: totalSynced,
    apiCalls: requestCount,
    duration,
    message: `同步完成，${successCount} 只证券成功，${totalSynced} 条成交记录`
  };
}

module.exports = {
  syncAllTickTrade,
  syncSingleTickTrade,
  getSecuritiesForTickTrade,
  setAbort,
  getAbortStatus
};
