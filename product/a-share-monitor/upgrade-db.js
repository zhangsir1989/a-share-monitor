#!/usr/bin/env node
/**
 * 数据库升级脚本
 * 添加用户角色字段
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
    // 检查是否已有 role 字段
    const tableInfo = db.exec("PRAGMA table_info(users)");
    const hasRole = tableInfo[0].values.some(row => row[1] === 'role');
    
    if (hasRole) {
      console.log('ℹ️  role 字段已存在，无需升级');
      db.close();
      return;
    }
    
    // 添加 role 字段（默认是 user）
    db.run("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user'");
    
    // 将 zhangsir 设置为 admin
    db.run("UPDATE users SET role = 'admin' WHERE user_id = 'zhangsir'");
    
    // 保存数据库
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
    
    console.log('✅ 数据库升级成功！');
    console.log('  - 添加 role 字段');
    console.log('  - zhangsir 设置为 admin 角色');
    console.log('  - 其他用户默认为 user 角色');
    
    // 显示升级后的用户列表
    const users = db.exec('SELECT user_id, username, role FROM users');
    console.log('\n👥 当前用户角色:');
    if (users.length > 0) {
      users[0].values.forEach(row => {
        console.log(`  - ${row[0]} (${row[1]}): ${row[2]}`);
      });
    }
    
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
