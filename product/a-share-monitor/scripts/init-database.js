/**
 * A 股监控系统 - 数据库初始化脚本
 * 
 * 用途：创建所有必需的数据库表和初始数据
 * 使用：node scripts/init-database.js
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// 数据库文件路径
const DB_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'users.db');

// 确保 data 目录存在
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
  console.log('✅ 创建数据目录:', DB_DIR);
}

// 连接数据库
const db = new sqlite3.Database(DB_PATH);

console.log('🚀 开始初始化 A 股监控系统数据库...\n');

// 执行初始化
db.serialize(() => {
  // 1. 创建 users 表（用户管理）
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT '0',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )
  `, (err) => {
    if (err) {
      console.error('❌ 创建 users 表失败:', err.message);
    } else {
      console.log('✅ 创建 users 表（用户管理）');
    }
  });

  // 2. 创建 scheduled_tasks 表（定时任务）
  db.run(`
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      cron TEXT NOT NULL,
      status INTEGER DEFAULT 1,
      last_run DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('❌ 创建 scheduled_tasks 表失败:', err.message);
    } else {
      console.log('✅ 创建 scheduled_tasks 表（定时任务）');
    }
  });

  // 3. 创建 custom_stocks 表（自选股）
  db.run(`
    CREATE TABLE IF NOT EXISTS custom_stocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      stock_code TEXT NOT NULL,
      stock_market TEXT NOT NULL,
      type INTEGER DEFAULT 0,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, stock_code, stock_market, type)
    )
  `, (err) => {
    if (err) {
      console.error('❌ 创建 custom_stocks 表失败:', err.message);
    } else {
      console.log('✅ 创建 custom_stocks 表（自选股）');
    }
  });

  // 4. 创建 securities 表（证券信息）
  db.run(`
    CREATE TABLE IF NOT EXISTS securities (
      code TEXT PRIMARY KEY,
      name TEXT,
      market TEXT,
      category TEXT,
      list_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('❌ 创建 securities 表失败:', err.message);
    } else {
      console.log('✅ 创建 securities 表（证券信息）');
    }
  });

  // 5. 创建 tick_trade 表（逐笔成交）
  db.run(`
    CREATE TABLE IF NOT EXISTS tick_trade (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_code TEXT NOT NULL,
      trade_date TEXT NOT NULL,
      time TEXT NOT NULL,
      price REAL,
      volume INTEGER,
      amount REAL,
      direction TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('❌ 创建 tick_trade 表失败:', err.message);
    } else {
      console.log('✅ 创建 tick_trade 表（逐笔成交）');
      // 创建索引
      db.run('CREATE INDEX IF NOT EXISTS idx_tick_code_date ON tick_trade(stock_code, trade_date)');
      console.log('✅ 创建 tick_trade 索引');
    }
  });

  // 6. 创建 custom_groups 表（自选股分组）
  db.run(`
    CREATE TABLE IF NOT EXISTS custom_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '📁',
      color TEXT DEFAULT '#4a9eff',
      type INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('❌ 创建 custom_groups 表失败:', err.message);
    } else {
      console.log('✅ 创建 custom_groups 表（自选股分组）');
      // 创建索引
      db.run('CREATE INDEX IF NOT EXISTS idx_custom_groups_user_type ON custom_groups(user_id, type)');
      console.log('✅ 创建 custom_groups 索引');
    }
  });

  // 创建索引
  db.run('CREATE INDEX IF NOT EXISTS idx_custom_stocks_user_code ON custom_stocks(user_id, stock_code)', (err) => {
    if (err) {
      console.error('❌ 创建索引失败:', err.message);
    } else {
      console.log('✅ 创建 custom_stocks 索引');
    }
  });

  // 插入默认管理员账户
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO users (user_id, username, password, role, is_active)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run('admin', 'admin', 'admin123', '1', 1, function(err) {
    if (err) {
      console.error('❌ 插入管理员账户失败:', err.message);
    } else {
      if (this.changes > 0) {
        console.log('✅ 插入默认管理员账户：admin / admin123');
      } else {
        console.log('ℹ️  管理员账户已存在');
      }
    }
  });
  stmt.finalize();

  // 完成
  db.close((err) => {
    if (err) {
      console.error('❌ 关闭数据库失败:', err.message);
    } else {
      console.log('\n🎉 数据库初始化完成!');
      console.log(`📁 数据库文件：${DB_PATH}`);
      console.log('\n📋 数据库表说明:');
      console.log('   - users: 用户账户管理');
      console.log('   - scheduled_tasks: 定时任务调度');
      console.log('   - custom_stocks: 用户自选股');
      console.log('   - custom_groups: 自选股分组');
      console.log('   - securities: 证券基础信息');
      console.log('   - tick_trade: 逐笔成交数据');
      console.log('\n🔐 默认管理员账户:');
      console.log('   用户名：admin');
      console.log('   密码：admin123');
      console.log('\n⚠️  请首次登录后修改密码!');
    }
  });
});
