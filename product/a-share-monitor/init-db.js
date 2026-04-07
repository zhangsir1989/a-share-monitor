#!/usr/bin/env node
/**
 * 初始化 SQLite 数据库
 * 创建用户表并添加默认管理员账户
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'users.db');

// 确保数据目录存在
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('✓ 创建数据目录:', dataDir);
}

async function initDatabase() {
  // 初始化 SQL.js
  const SQL = await initSqlJs();
  
  // 检查数据库文件是否存在
  let db;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('✓ 数据库加载成功:', DB_PATH);
  } else {
    db = new SQL.Database();
    console.log('✓ 创建新数据库:', DB_PATH);
  }
  
  try {
    // 创建用户表
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        user_id VARCHAR(12) PRIMARY KEY NOT NULL,
        password VARCHAR(12) NOT NULL,
        username VARCHAR(50) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        is_active INTEGER DEFAULT 1
      )
    `);
    console.log('✓ 用户表创建成功');
    
    // 检查是否已有管理员账户
    const adminCheck = db.exec("SELECT COUNT(*) as count FROM users WHERE user_id = 'zhangsir'");
    const count = adminCheck[0]?.values[0]?.[0] || 0;
    
    if (count === 0) {
      // 添加默认管理员账户
      db.run(`
        INSERT INTO users (user_id, password, username, is_active)
        VALUES ('zhangsir', '111111', '管理员', 1)
      `);
      console.log('✓ 默认管理员账户已创建:');
      console.log('  用户编号：zhangsir');
      console.log('  密码：111111');
      console.log('  用户名：管理员');
    } else {
      console.log('ℹ️  管理员账户已存在');
    }
    
    // 创建索引
    db.run('CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active)');
    console.log('✓ 索引创建成功');
    
    // 保存数据库到文件
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
    console.log('✓ 数据库已保存到文件');
    
    // 验证表结构
    const tableInfo = db.exec("PRAGMA table_info(users)");
    console.log('\n📋 用户表结构:');
    if (tableInfo.length > 0) {
      tableInfo[0].values.forEach(row => {
        const [cid, name, type, notnull, dflt_value, pk] = row;
        console.log(`  - ${name}: ${type} ${notnull ? 'NOT NULL' : ''} ${pk ? 'PRIMARY KEY' : ''}`);
      });
    }
    
    // 查询所有用户
    const users = db.exec('SELECT user_id, username, created_at, is_active FROM users');
    console.log('\n👥 当前用户列表:');
    if (users.length > 0) {
      users[0].values.forEach(row => {
        const [user_id, username, created_at, is_active] = row;
        console.log(`  - ${user_id} (${username}) - ${is_active ? '激活' : '停用'} - 创建于：${created_at}`);
      });
    }
    
    console.log('\n✅ 数据库初始化完成！');
    
  } finally {
    db.close();
  }
}

initDatabase().catch(err => {
  console.error('❌ 数据库初始化失败:', err);
  process.exit(1);
});
