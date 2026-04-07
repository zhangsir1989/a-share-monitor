#!/usr/bin/env node
/**
 * 数据库升级脚本 v2
 * 修改 role 字段为 CHAR(1) 类型
 * 1=管理员，0=普通用户
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
    // SQLite 不支持直接修改列类型，需要重建表
    
    // 1. 备份旧数据
    const oldData = db.exec('SELECT user_id, username, password, role, is_active, created_at, last_login FROM users');
    
    // 2. 删除旧表
    db.run('DROP TABLE users');
    
    // 3. 创建新表（role 改为 CHAR(1)）
    db.run(`
      CREATE TABLE users (
        user_id VARCHAR(12) PRIMARY KEY NOT NULL,
        password VARCHAR(12) NOT NULL,
        username VARCHAR(50) NOT NULL,
        role CHAR(1) DEFAULT '0',
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )
    `);
    
    // 4. 恢复数据并转换 role 字段
    if (oldData.length > 0) {
      const insert = db.prepare(`
        INSERT INTO users (user_id, username, password, role, is_active, created_at, last_login)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      oldData[0].values.forEach(row => {
        const [user_id, username, password, oldRole, is_active, created_at, last_login] = row;
        // 转换 role：'admin' -> '1', 其他 -> '0'
        const newRole = (oldRole === 'admin') ? '1' : '0';
        insert.run([user_id, username, password, newRole, is_active, created_at, last_login]);
      });
      
      insert.free();
    }
    
    // 创建索引
    db.run('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)');
    db.run('CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active)');
    
    // 保存数据库
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
    
    console.log('✅ 数据库升级成功！');
    console.log('  - role 字段改为 CHAR(1) 类型');
    console.log('  - 1 = 管理员，0 = 普通用户');
    
    // 显示升级后的用户列表
    const users = db.exec('SELECT user_id, username, role FROM users');
    console.log('\n👥 当前用户角色:');
    if (users.length > 0) {
      users[0].values.forEach(row => {
        const roleText = row[2] === '1' ? '管理员' : '普通用户';
        console.log(`  - ${row[0]} (${row[1]}): ${roleText} (${row[2]})`);
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
