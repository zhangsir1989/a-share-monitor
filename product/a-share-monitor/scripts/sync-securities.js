/**
 * A 股监控系统 - 证券信息同步脚本
 * 
 * 用途：从 MyData API 同步全市场证券信息到数据库
 * 使用：node scripts/sync-securities.js
 * 
 * 数据范围：
 * - A 股（沪深京）
 * - ETF
 * - 可转债
 */

const fetch = require('node-fetch');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'users.db');
const MYDATA_LICENCE = 'FB1A859B-6832-4F70-AAA2-38274F23FC90';

const db = new sqlite3.Database(DB_PATH);

console.log('🚀 开始同步证券信息...\n');

// MyData API 端点
const API_BASE = 'https://api.mairuiapi.com';

// 证券类别映射
const CATEGORY_MAP = {
  '1': '沪深 A 股',
  '2': '沪深 B 股',
  '3': '港股',
  '4': '国内期货',
  '5': '国际期货',
  '6': '美股',
  '7': '基金',  // ETF
  '8': '债券',
  '9': '外汇',
  '10': '可转债',
  '11': '沪深指数',
  '12': '行业板块',
  '13': '风格板块',
  '14': '地域板块',
  '15': '深证 ETF',
  '16': '上证 ETF',
  '17': '深证成指',
  '18': '上证指数',
  '19': '创业板',
  '20': '科创板'
};

async function syncSecurities() {
  const categories = [
    { id: '1', name: '沪深 A 股' },
    { id: '7', name: '基金 (ETF)' },
    { id: '10', name: '可转债' },
    { id: '11', name: '沪深指数' }
  ];

  let totalCount = 0;

  for (const category of categories) {
    console.log(`📊 同步 ${category.name}...`);

    try {
      const url = `${API_BASE}/gp/${category.id}/${MYDATA_LICENCE}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.log(`  ⚠️  API 返回失败：${response.status}`);
        continue;
      }

      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        console.log(`  ℹ️  无数据`);
        continue;
      }

      // 插入数据库
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO securities (code, name, market, category, list_date, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      let inserted = 0;
      for (const item of data) {
        // 解析市场
        let market = 'unknown';
        if (item.code && item.code.startsWith('6')) market = 'sh';
        else if (item.code && (item.code.startsWith('0') || item.code.startsWith('3'))) market = 'sz';
        else if (item.code && item.code.startsWith('4') || item.code.startsWith('8')) market = 'bj';

        stmt.run(
          item.code,
          item.name || '',
          market,
          category.name,
          item.list_date || null
        );
        inserted++;
      }

      stmt.finalize();
      totalCount += inserted;
      console.log(`  ✅ 同步 ${inserted} 条`);

    } catch (error) {
      console.log(`  ❌ 同步失败：${error.message}`);
    }

    // 避免 API 限流
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n🎉 证券信息同步完成!`);
  console.log(`📊 总计同步：${totalCount} 条证券信息`);

  db.close();
}

// 执行同步
syncSecurities().catch(console.error);
