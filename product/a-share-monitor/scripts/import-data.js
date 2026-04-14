/**
 * A 股监控系统 - 数据导入脚本
 * 
 * 用途：从 JSON 文件导入数据到数据库（用于恢复或迁移）
 * 使用：node scripts/import-data.js
 * 
 * 导入文件：
 * - data/export/users.json - 用户数据
 * - data/export/custom_stocks.json - 自选股数据
 * - data/export/custom_groups.json - 分组数据
 * - data/export/securities.json - 证券信息
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '..', 'data', 'users.db');
const EXPORT_DIR = path.join(__dirname, '..', 'data', 'export');

const db = new sqlite3.Database(DB_PATH);

console.log('🚀 开始导入数据...\n');

// 导入函数
function importTable(tableName, filename, callback) {
  const filePath = path.join(EXPORT_DIR, filename);

  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  文件不存在：${filename}，跳过`);
    callback && callback(null, 0);
    return;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  if (!Array.isArray(data) || data.length === 0) {
    console.log(`  ℹ️  ${filename} 无数据，跳过`);
    callback && callback(null, 0);
    return;
  }

  // 根据表名生成 INSERT 语句
  let stmt;
  let inserted = 0;
  let errors = 0;

  switch (tableName) {
    case 'users':
      stmt = db.prepare(`
        INSERT OR IGNORE INTO users (user_id, username, password, role, is_active, created_at, last_login)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      data.forEach(row => {
        stmt.run(row.user_id, row.username, row.password, row.role, row.is_active, row.created_at, row.last_login, (err) => {
          if (err) errors++;
          else inserted++;
        });
      });
      stmt.finalize();
      break;

    case 'custom_stocks':
      stmt = db.prepare(`
        INSERT OR IGNORE INTO custom_stocks (user_id, stock_code, stock_market, type, added_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      data.forEach(row => {
        stmt.run(row.user_id, row.stock_code, row.stock_market, row.type, row.added_at, (err) => {
          if (err) errors++;
          else inserted++;
        });
      });
      stmt.finalize();
      break;

    case 'custom_groups':
      stmt = db.prepare(`
        INSERT OR IGNORE INTO custom_groups (user_id, name, icon, color, type, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      data.forEach(row => {
        stmt.run(row.user_id, row.name, row.icon, row.color, row.type, row.created_at, (err) => {
          if (err) errors++;
          else inserted++;
        });
      });
      stmt.finalize();
      break;

    case 'securities':
      stmt = db.prepare(`
        INSERT OR REPLACE INTO securities (code, name, market, category, list_date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      data.forEach(row => {
        stmt.run(row.code, row.name, row.market, row.category, row.list_date, row.created_at, row.updated_at, (err) => {
          if (err) errors++;
          else inserted++;
        });
      });
      stmt.finalize();
      break;

    case 'scheduled_tasks':
      stmt = db.prepare(`
        INSERT OR IGNORE INTO scheduled_tasks (id, name, type, cron, status, last_run, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      data.forEach(row => {
        stmt.run(row.id, row.name, row.type, row.cron, row.status, row.last_run, row.created_at, (err) => {
          if (err) errors++;
          else inserted++;
        });
      });
      stmt.finalize();
      break;

    default:
      console.log(`  ⚠️  未知表：${tableName}，跳过`);
      callback && callback(null, 0);
      return;
  }

  // 等待所有插入完成
  setTimeout(() => {
    console.log(`  ✅ 导入 ${tableName}: ${inserted} 条成功，${errors} 条失败`);
    callback && callback(null, inserted);
  }, 500);
}

// 导入所有表
const tables = [
  { name: 'users', file: 'users.json' },
  { name: 'custom_groups', file: 'custom_groups.json' },
  { name: 'custom_stocks', file: 'custom_stocks.json' },
  { name: 'securities', file: 'securities.json' },
  { name: 'scheduled_tasks', file: 'scheduled_tasks.json' }
];

let completed = 0;
const total = tables.length;
let totalInserted = 0;

tables.forEach(table => {
  importTable(table.name, table.file, (err, count) => {
    completed++;
    if (count) totalInserted += count;

    if (completed === total) {
      console.log('\n🎉 数据导入完成!');
      console.log(`📊 总计导入：${totalInserted} 条记录`);
      db.close();
    }
  });
});
