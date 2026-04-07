// 同步证券信息 - 对接 MyData 数据 API（全市场）
// 此函数需要在 server.js 中调用，db 和 saveDatabase 来自 server.js 作用域

module.exports = function(db, saveDatabase) {
  return async function syncSecurities() {
    console.log('🔄 开始同步证券信息（MyData API 全市场）...');
    const startTime = Date.now();
    
    let totalSynced = 0;
    let totalInserted = 0;
    let totalUpdated = 0;
    const stats = { sh: 0, sz: 0, bj: 0, ct: 0, etf: 0, hk: 0, index: 0 };
    
    try {
      const axios = require('axios');
      
      // MyData API 配置（从环境变量或.env 文件获取）
      let MYDATA_API_KEY = process.env.MYDATA_API_KEY || 'FB1A859B-6832-4F70-AAA2-38274F23FC90';
      
      // 尝试从.env 文件加载
      if (!MYDATA_API_KEY) {
        try {
          const envPath = require('path').join(__dirname, '../.env');
          const envContent = require('fs').readFileSync(envPath, 'utf8');
          const match = envContent.match(/MYDATA_API_KEY=(.+)/);
          if (match) MYDATA_API_KEY = match[1].trim();
        } catch (e) {
          // .env 文件不存在或读取失败
        }
      }
      
      if (!MYDATA_API_KEY) {
        console.log('⚠️ 未配置 MYDATA_API_KEY，使用本地股票列表');
        return await syncFromLocal(db, saveDatabase);
      }
      
      console.log('📍 请求 MyData API 获取全市场证券列表...');
      
      let securities = [];
      
      // 请求延迟函数（避免 429 频率限制）
      const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
      
      // 1. 沪深 A 股列表
      console.log('📊 同步沪深 A 股...');
      let hsltResp;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const hsltUrl = `https://api.mairuiapi.com/hslt/list/${MYDATA_API_KEY}`;
          hsltResp = await axios.get(hsltUrl, { timeout: 60000 });
          break;
        } catch (e) {
          if (e.response && e.response.status === 429 && attempt < 4) {
            const waitTime = (attempt + 1) * 5000;  // 5 秒、10 秒、15 秒、20 秒
            console.log(`⚠️ 频率限制，等待${waitTime/1000}秒后重试...`);
            await delay(waitTime);
          } else if (attempt === 4) {
            console.log('⚠️ 沪深 A 股同步失败:', e.message);
          }
        }
      }
      
      if (hsltResp && Array.isArray(hsltResp.data)) {
        for (const item of hsltResp.data) {
          const dm = item.dm || '';
          const code = dm.split('.')[0];
          const name = item.mc || '';
          const jys = (item.jys || '').toUpperCase();
          
          let market = '';
          if (jys === 'SH' || jys === 'SSE') market = 'sh';
          else if (jys === 'SZ' || jys === 'SZSE') market = 'sz';
          else if (code.startsWith('6')) market = 'sh';
          else if (code.startsWith('0') || code.startsWith('3')) market = 'sz';
          
          if (code && name && market) {
            securities.push({ code, name, market, type: 'stock' });
          }
        }
        console.log(`✅ 沪深 A 股：${hsltResp.data.length} 条`);
      }
      
      // 2. 概念板块/指数列表
      console.log('📊 同步概念板块/指数...');
      let sectorsResp;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const sectorsUrl = `https://api.mairuiapi.com/hslt/sectorslist/${MYDATA_API_KEY}`;
          sectorsResp = await axios.get(sectorsUrl, { timeout: 60000 });
          break;
        } catch (e) {
          if (e.response && e.response.status === 429 && attempt < 2) {
            console.log(`⚠️ 频率限制，等待${(attempt + 1) * 2}秒后重试...`);
            await delay((attempt + 1) * 2000);
          } else if (attempt === 2) {
            console.log('⚠️ 概念板块/指数同步失败:', e.message);
          }
        }
      }
      
      if (sectorsResp && Array.isArray(sectorsResp.data)) {
        for (const item of sectorsResp.data) {
          const dm = item.dm || '';
          const code = dm.split('.')[0];
          const name = item.mc || '';
          
          // 指数代码通常包含 BKZS 或以 000/399 开头
          if (code && name && (dm.includes('BKZS') || code.startsWith('000') || code.startsWith('399'))) {
            const market = code.startsWith('000') ? 'sh' : 'sz';
            securities.push({ code, name, market, type: 'index' });
          }
        }
        console.log(`✅ 概念板块/指数：${sectorsResp.data.length} 条`);
      }
      
      // 3. 新股日历（包含北交所新股）
      console.log('📊 同步新股日历...');
      let newStocksResp;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const newStocksUrl = `https://api.mairuiapi.com/hslt/new/${MYDATA_API_KEY}`;
          newStocksResp = await axios.get(newStocksUrl, { timeout: 60000 });
          break;
        } catch (e) {
          if (e.response && e.response.status === 429 && attempt < 2) {
            console.log(`⚠️ 频率限制，等待${(attempt + 1) * 2}秒后重试...`);
            await delay((attempt + 1) * 2000);
          } else if (attempt === 2) {
            console.log('⚠️ 新股日历同步失败:', e.message);
          }
        }
      }
      
      if (newStocksResp && Array.isArray(newStocksResp.data)) {
        for (const item of newStocksResp.data) {
          const zqdm = item.zqdm || '';
          const zqjc = item.zqjc || '';
          
          let market = '';
          if (zqdm.startsWith('8')) market = 'bj';
          else if (zqdm.startsWith('6')) market = 'sh';
          else if (zqdm.startsWith('0') || zqdm.startsWith('3')) market = 'sz';
          
          if (zqdm && zqjc && market) {
            securities.push({ code: zqdm, name: zqjc, market, type: 'stock' });
          }
        }
        console.log(`✅ 新股日历：${newStocksResp.data.length} 条`);
      }
      
      console.log(`📈 总计获取 ${securities.length} 条数据`);
      
      // 处理证券数据
      for (const sec of securities) {
        const result = db.run(`
          INSERT INTO securities (stock_code, stock_name, market, status, updated_at)
          VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
          ON CONFLICT(stock_code, market) DO UPDATE SET
            stock_name = excluded.stock_name,
            updated_at = CURRENT_TIMESTAMP
        `, [sec.code, sec.name, sec.market]);
        
        totalSynced++;
        
        // 统计各市场数量
        if (sec.type === 'etf') stats.etf++;
        else if (sec.type === 'index') stats.index++;
        else if (sec.market === 'sh') stats.sh++;
        else if (sec.market === 'sz') stats.sz++;
        else if (sec.market === 'bj') stats.bj++;
        else if (sec.market === 'hk') stats.hk++;
        else if (sec.market === 'ct') stats.ct++;
        
        if (result.changes > 0) {
          if (result.lastInsertRowid) {
            totalInserted++;
          } else {
            totalUpdated++;
          }
        }
      }
      
      console.log(`✓ MyData API 同步完成`);
      
      // 保存数据库
      saveDatabase();
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const message = `共同步 ${totalSynced} 只证券（新增${totalInserted}，更新${totalUpdated}），耗时${duration}秒`;
      console.log(`✅ ${message}`);
      console.log(`📊 市场分布：沪市 A 股${stats.sh} 深市 A 股${stats.sz} 北交所${stats.bj} ETF${stats.etf} 指数${stats.index} 港股${stats.hk}`);
      
      return {
        success: true,
        totalSynced,
        totalInserted,
        totalUpdated,
        stats,
        duration,
        message,
        source: 'mydata'
      };
    } catch (error) {
      console.error('❌ 证券同步失败:', error.message);
      console.log('📝 降级使用本地股票列表...');
      return await syncFromLocal(db, saveDatabase);
    }
  };
};

// 降级使用本地股票列表
async function syncFromLocal(db, saveDatabase) {
  const startTime = Date.now();
  let totalSynced = 0;
  let totalInserted = 0;
  let totalUpdated = 0;
  const stats = { sh: 0, sz: 0, bj: 0, ct: 0, etf: 0 };
  
  try {
    const stockList = require('./stocks');
    
    for (const stock of stockList) {
      if (stock.type === 'index' || stock.type === 'bond') continue;
      
      const code = stock.code;
      const name = stock.name;
      let market = stock.market || '';
      
      if (!market) {
        if (code.startsWith('6')) market = 'sh';
        else if (code.startsWith('0') || code.startsWith('3')) market = 'sz';
        else if (code.startsWith('8') || code.startsWith('4')) market = 'bj';
        else if (code.startsWith('5')) market = 'sh';
        else continue;
      }
      
      const result = db.run(`
        INSERT INTO securities (stock_code, stock_name, market, status, updated_at)
        VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(stock_code, market) DO UPDATE SET
          stock_name = excluded.stock_name,
          updated_at = CURRENT_TIMESTAMP
      `, [code, name, market]);
      
      totalSynced++;
      if (result.changes > 0) {
        if (result.lastInsertRowid) totalInserted++;
        else totalUpdated++;
        
        if (market === 'sh') stats.sh++;
        else if (market === 'sz') stats.sz++;
        else if (market === 'bj') stats.bj++;
      }
    }
    
    saveDatabase();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const message = `共同步 ${totalSynced} 只证券（新增${totalInserted}，更新${totalUpdated}），耗时${duration}秒`;
    console.log(`✅ ${message}（本地列表）`);
    
    return {
      success: true,
      totalSynced,
      totalInserted,
      totalUpdated,
      stats,
      duration,
      message,
      source: 'local'
    };
  } catch (error) {
    console.error('❌ 本地列表同步失败:', error.message);
    return {
      success: false,
      message: error.message
    };
  }
}
