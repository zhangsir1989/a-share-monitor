#!/usr/bin/env node
/**
 * 数据库升级脚本 v3
 * 添加自选股表 (custom_stocks)
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'users.db');

async function upgradeDatabase() {
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(fileBuffer);
  
  try {
    // 检查表是否已存在
    const tableCheck = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='custom_stocks'");
    
    if (tableCheck.length > 0 && tableCheck[0].values.length > 0) {
      console.log('ℹ️  custom_stocks 表已存在，无需升级');
      
      // 显示表结构
      const tableInfo = db.exec("PRAGMA table_info(custom_stocks)");
      console.log('\n📋 custom_stocks 表结构:');
      if (tableInfo.length > 0) {
        tableInfo[0].values.forEach(row => {
          const [cid, name, type, notnull, dflt_value, pk] = row;
          console.log(`  - ${name}: ${type} ${notnull ? 'NOT NULL' : ''} ${pk ? 'PRIMARY KEY' : ''}`);
        });
      }
      
      db.close();
      return;
    }
    
    // 创建自选股表
    db.run(`
      CREATE TABLE custom_stocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id VARCHAR(12) NOT NULL,
        stock_code VARCHAR(10) NOT NULL,
        stock_market VARCHAR(10) NOT NULL,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, stock_code, stock_market)
      )
    `);
    console.log('✓ custom_stocks 表创建成功');
    
    // 创建索引
    db.run('CREATE INDEX idx_custom_stocks_user ON custom_stocks(user_id)');
    db.run('CREATE INDEX idx_custom_stocks_code ON custom_stocks(stock_code, stock_market)');
    console.log('✓ 索引创建成功');
    
    // 保存数据库到文件
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
    console.log('✓ 数据库已保存到文件');
    
    // 验证表结构
    const tableInfo = db.exec("PRAGMA table_info(custom_stocks)");
    console.log('\n📋 custom_stocks 表结构:');
    if (tableInfo.length > 0) {
      tableInfo[0].values.forEach(row => {
        const [cid, name, type, notnull, dflt_value, pk] = row;
        console.log(`  - ${name}: ${type} ${notnull ? 'NOT NULL' : ''} ${pk ? 'PRIMARY KEY' : ''}`);
      });
    }
    
    console.log('\n✅ 数据库升级完成！');
    console.log('\n📝 使用说明:');
    console.log('  - 证券代码 (stock_code): 6 位数字代码（如：600519）');
    console.log('  - 证券市场 (stock_market): sh/sz/bj');
    console.log('  - 用户编号 (user_id): 关联 users 表的 user_id');
    console.log('  - 添加时间 (added_at): 自动记录');
    console.log('  - 唯一约束：同一用户不能重复添加同一只股票');
    
  } catch (error) {
    console.error('❌ 数据库升级失败:', error.message);
    throw error;
  } finally {
    db.close();
  }
}

upgradeDatabase().catch(err => {
  console.error('升级失败:', err);
  process.exit(1);
});
