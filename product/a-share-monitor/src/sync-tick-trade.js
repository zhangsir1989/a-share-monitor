// 逐笔成交明细同步函数
// 此函数需要在 server.js 中调用，db 和 saveDatabase 来自 server.js 作用域

module.exports = function(db, saveDatabase) {
  return async function syncTickTrade(trade_date) {
    const startTime = Date.now();
    
    let totalSynced = 0;
    let totalInserted = 0;
    let totalUpdated = 0;
    const stats = { sh: 0, sz: 0 };
    
    try {
      const axios = require('axios');
      
      // MyData API 配置
      let MYDATA_API_KEY = process.env.MYDATA_API_KEY || 'FB1A859B-6832-4F70-AAA2-38274F23FC90';
      
      // 逐笔成交 API 基础 URL（包年版）
      const TICK_API_BASE = 'https://api.mairuiapi.com/hsrl/zbjy';
      
      if (!MYDATA_API_KEY) {
        try {
          const envPath = require('path').join(__dirname, '../.env');
          const envContent = require('fs').readFileSync(envPath, 'utf8');
          const match = envContent.match(/MYDATA_API_KEY=(.+)/);
          if (match) MYDATA_API_KEY = match[1].trim();
        } catch (e) {}
      }
      
      if (!MYDATA_API_KEY) {
        console.log('⚠️ 未配置 MYDATA_API_KEY，无法同步逐笔成交');
        return {
          success: false,
          message: '未配置 API Key',
          totalSynced: 0
        };
      }
      
      console.log('📍 获取证券列表...');
      
      // 获取证券列表（股票 + ETF）
      let securities = [];
      
      try {
        // 沪深 A 股
        const hsltUrl = `https://api.mairuiapi.com/hslt/list/${MYDATA_API_KEY}`;
        const hsltResp = await axios.get(hsltUrl, { timeout: 60000 });
        
        if (Array.isArray(hsltResp.data)) {
          for (const item of hsltResp.data) {
            const dm = item.dm || '';
            const code = dm.split('.')[0];
            const name = item.mc || '';
            const jys = (item.jys || '').toUpperCase();
            
            let market = '';
            if (jys === 'SH' || jys === 'SSE') market = 'SH';
            else if (jys === 'SZ' || jys === 'SZSE') market = 'SZ';
            else if (code.startsWith('6')) market = 'SH';
            else if (code.startsWith('0') || code.startsWith('3')) market = 'SZ';
            
            if (code && name && market) {
              securities.push({ code, name, market });
            }
          }
        }
        console.log(`✅ 获取到 ${securities.length} 只证券`);
      } catch (e) {
        console.error('获取证券列表失败:', e.message);
        return {
          success: false,
          message: '获取证券列表失败：' + e.message,
          totalSynced: 0
        };
      }
      
      // 同步逐笔成交（限制数量，避免 API 频率限制）
      const maxSymbols = securities.length; // 同步所有证券
      const symbolsToSync = securities.slice(0, maxSymbols);
      
      console.log(`📊 开始同步 ${symbolsToSync.length} 只证券的逐笔成交...`);
      
      for (const sec of symbolsToSync) {
        try {
          // MyData 逐笔成交 API（包年版）
          // 格式：https://api.mairuiapi.com/hsrl/zbjy/{code}/{LICENCE}
          const tickUrl = `${TICK_API_BASE}/${sec.code}/${MYDATA_API_KEY}`;
          const tickResp = await axios.get(tickUrl, { timeout: 30000 });
          
          if (Array.isArray(tickResp.data)) {
            for (const tick of tickResp.data) {
              // MyData API 返回格式：{"d":"2026-04-03","t":"09:15:00","v":8100,"p":11.27,"ts":0}
              const trade_date_api = tick.d || tick.trade_date || trade_date;
              const trade_time = tick.t || tick.time || '';
              const price = tick.p || tick.price || 0;
              const volume = tick.v || tick.volume || tick.vol || 0;
              const amount = tick.a || tick.amount || (price * volume);
              // ts 字段：0=中性，1=主动买，2=主动卖（MyData API 定义）
              const ts = tick.ts || tick.direction || 0;
              let direction = 'N';
              if (ts === 1) direction = 'B';  // 主动买
              else if (ts === 2) direction = 'S';  // 主动卖
              else direction = 'N';  // 中性
              
              // 插入数据库
              try {
                db.run(`
                  INSERT INTO tick_trade (trade_date, symbol, market, trade_time, price, volume, amount, direction)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [trade_date_api, sec.code, sec.market, trade_time, price, volume, amount, direction]);
                totalSynced++;
                totalInserted++;
              } catch (e) {
                // 忽略重复数据
              }
            }
            
            if (sec.market === 'SH') stats.sh++;
            else if (sec.market === 'SZ') stats.sz++;
            
            console.log(`✓ ${sec.code} ${sec.name}: ${tickResp.data.length} 条`);
          }
          
        } catch (e) {
          console.error(`✗ ${sec.code} 同步失败:`, e.message);
        }
      }
      
      // 保存数据库
      saveDatabase();
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const message = `共同步 ${totalSynced} 条逐笔成交（新增${totalInserted}，更新${totalUpdated}），耗时${duration}秒`;
      console.log(`✅ ${message}`);
      console.log(`📊 市场分布：沪市${stats.sh} 深市${stats.sz}`);
      
      return {
        success: true,
        totalSynced,
        totalInserted,
        totalUpdated,
        stats,
        duration,
        message
      };
    } catch (error) {
      console.error('❌ 逐笔成交同步失败:', error.message);
      return {
        success: false,
        message: error.message,
        totalSynced: 0
      };
    }
  };
};
