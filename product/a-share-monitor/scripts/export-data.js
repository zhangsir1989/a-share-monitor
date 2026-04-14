/**
 * A 股监控系统 - 数据导出脚本
 * 
 * 用途：导出数据库中的所有数据为 JSON 文件（用于备份或迁移）
 * 使用：node scripts/export-data.js
 * 
 * 输出文件：
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

console.log('🚀 开始导出数据...\n');

// 确保导出目录存在
if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
  console.log('✅ 创建导出目录:', EXPORT_DIR);
}

// 导出函数
function exportTable(tableName, filename, callback) {
  db.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
    if (err) {
      console.log(`  ❌ 导出 ${tableName} 失败：${err.message}`);
      callback && callback(err);
      return;
    }

    const filePath = path.join(EXPORT_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(rows, null, 2));
    console.log(`  ✅ 导出 ${tableName}: ${rows.length} 条 → ${filename}`);
    callback && callback(null, rows);
  });
}

// 导出所有表
const tables = [
  { name: 'users', file: 'users.json' },
  { name: 'custom_stocks', file: 'custom_stocks.json' },
  { name: 'custom_groups', file: 'custom_groups.json' },
  { name: 'securities', file: 'securities.json' },
  { name: 'scheduled_tasks', file: 'scheduled_tasks.json' }
];

let completed = 0;
const total = tables.length;

tables.forEach(table => {
  exportTable(table.name, table.file, () => {
    completed++;
    if (completed === total) {
      console.log('\n🎉 数据导出完成!');
      console.log(`📁 导出目录：${EXPORT_DIR}`);
      console.log('\n📋 导出文件:');
      tables.forEach(t => {
        const filePath = path.join(EXPORT_DIR, t.file);
        const size = fs.statSync(filePath).size;
        console.log(`   - ${t.file} (${(size / 1024).toFixed(2)} KB)`);
      });
      db.close();
    }
  });
});
