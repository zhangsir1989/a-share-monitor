#!/usr/bin/env node
/**
 * 数据库升级脚本 v4
 * 添加证券表 (securities)
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
    const tableCheck = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='securities'");
    
    if (tableCheck.length > 0 && tableCheck[0].values.length > 0) {
      console.log('ℹ️  securities 表已存在，无需升级');
      db.close();
      return;
    }
    
    // 创建证券表
    db.run(`
      CREATE TABLE securities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_code VARCHAR(10) NOT NULL,
        stock_name VARCHAR(50) NOT NULL,
        market VARCHAR(10) NOT NULL,
        status INTEGER DEFAULT 1,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(stock_code, market)
      )
    `);
    console.log('✓ securities 表创建成功');
    
    // 创建索引
    db.run('CREATE INDEX idx_securities_code ON securities(stock_code)');
    db.run('CREATE INDEX idx_securities_market ON securities(market)');
    db.run('CREATE INDEX idx_securities_status ON securities(status)');
    console.log('✓ 索引创建成功');
    
    // 保存数据库到文件
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
    console.log('✓ 数据库已保存到文件');
    
    // 验证表结构
    const tableInfo = db.exec("PRAGMA table_info(securities)");
    console.log('\n📋 securities 表结构:');
    if (tableInfo.length > 0) {
      tableInfo[0].values.forEach(row => {
        const [cid, name, type, notnull, dflt_value, pk] = row;
        console.log(`  - ${name}: ${type} ${notnull ? 'NOT NULL' : ''} ${pk ? 'PRIMARY KEY' : ''}`);
      });
    }
    
    console.log('\n✅ 数据库升级完成！');
    console.log('\n📝 使用说明:');
    console.log('  - 证券代码 (stock_code): 6 位数字代码（如：600519）');
    console.log('  - 证券名称 (stock_name): 股票名称');
    console.log('  - 市场 (market): sh/sz/bj/gz（港股通）');
    console.log('  - 状态 (status): 1=正常，0=停牌/退市');
    console.log('  - 唯一约束：同一市场不能有重复代码');
    
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