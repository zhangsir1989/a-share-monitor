#!/usr/bin/env node
/**
 * 用户管理脚本
 * 用法：
 *   node user-manager.js add <user_id> <password> <username>  - 添加用户
 *   node user-manager.js del <user_id>                       - 删除用户
 *   node user-manager.js reset <user_id> <password>          - 重置密码
 *   node user-manager.js list                                - 列出所有用户
 *   node user-manager.js disable <user_id>                   - 禁用用户
 *   node user-manager.js enable <user_id>                    - 启用用户
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'users.db');

async function loadDatabase() {
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(DB_PATH);
  return new SQL.Database(fileBuffer);
}

function saveDatabase(db) {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

async function addUser(userId, password, username) {
  if (userId.length > 12) {
    console.error('❌ 用户编号长度不能超过 12 位');
    return;
  }
  if (password.length > 12) {
    console.error('❌ 密码长度不能超过 12 位');
    return;
  }
  
  const db = await loadDatabase();
  
  // 检查用户是否已存在
  const check = db.exec(`SELECT COUNT(*) FROM users WHERE user_id = '${userId}'`);
  if (check[0].values[0][0] > 0) {
    console.error(`❌ 用户 ${userId} 已存在`);
    db.close();
    return;
  }
  
  // 添加用户
  db.run(`INSERT INTO users (user_id, password, username, is_active) VALUES ('${userId}', '${password}', '${username}', 1)`);
  saveDatabase(db);
  db.close();
  
  console.log(`✅ 用户 ${userId} (${username}) 添加成功`);
}

async function deleteUser(userId) {
  const db = await loadDatabase();
  
  db.run(`DELETE FROM users WHERE user_id = '${userId}'`);
  saveDatabase(db);
  db.close();
  
  console.log(`✅ 用户 ${userId} 已删除`);
}

async function resetPassword(userId, newPassword) {
  if (newPassword.length > 12) {
    console.error('❌ 密码长度不能超过 12 位');
    return;
  }
  
  const db = await loadDatabase();
  
  const check = db.exec(`SELECT COUNT(*) FROM users WHERE user_id = '${userId}'`);
  if (check[0].values[0][0] === 0) {
    console.error(`❌ 用户 ${userId} 不存在`);
    db.close();
    return;
  }
  
  db.run(`UPDATE users SET password = '${newPassword}' WHERE user_id = '${userId}'`);
  saveDatabase(db);
  db.close();
  
  console.log(`✅ 用户 ${userId} 密码已重置`);
}

async function listUsers() {
  const db = await loadDatabase();
  
  const results = db.exec('SELECT user_id, username, created_at, last_login, is_active FROM users ORDER BY created_at');
  
  if (results.length === 0 || results[0].values.length === 0) {
    console.log('📭 暂无用户');
    db.close();
    return;
  }
  
  console.log('\n👥 用户列表:\n');
  console.log('用户编号'.padEnd(15) + '用户名'.padEnd(15) + '状态'.padEnd(8) + '创建时间'.padEnd(22) + '最后登录');
  console.log('─'.repeat(80));
  
  results[0].values.forEach(row => {
    const [user_id, username, created_at, last_login, is_active] = row;
    const status = is_active ? '✓ 激活' : '✗ 停用';
    const login = last_login || '从未登录';
    console.log(user_id.padEnd(15) + username.padEnd(15) + status.padEnd(8) + created_at.padEnd(22) + login);
  });
  
  console.log('');
  db.close();
}

async function disableUser(userId) {
  const db = await loadDatabase();
  
  db.run(`UPDATE users SET is_active = 0 WHERE user_id = '${userId}'`);
  saveDatabase(db);
  db.close();
  
  console.log(`✅ 用户 ${userId} 已禁用`);
}

async function enableUser(userId) {
  const db = await loadDatabase();
  
  db.run(`UPDATE users SET is_active = 1 WHERE user_id = '${userId}'`);
  saveDatabase(db);
  db.close();
  
  console.log(`✅ 用户 ${userId} 已启用`);
}

// 主程序
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command) {
    console.log(`
📋 用户管理工具

用法:
  node user-manager.js add <user_id> <password> <username>   - 添加用户
  node user-manager.js del <user_id>                         - 删除用户
  node user-manager.js reset <user_id> <password>            - 重置密码
  node user-manager.js list                                  - 列出所有用户
  node user-manager.js disable <user_id>                     - 禁用用户
  node user-manager.js enable <user_id>                      - 启用用户

示例:
  node user-manager.js add admin 123456 管理员
  node user-manager.js reset admin 888888
  node user-manager.js disable test
  node user-manager.js list
`);
    return;
  }
  
  switch (command) {
    case 'add':
      if (args.length < 4) {
        console.error('❌ 用法：node user-manager.js add <user_id> <password> <username>');
        return;
      }
      await addUser(args[1], args[2], args[3]);
      break;
    
    case 'del':
      if (args.length < 2) {
        console.error('❌ 用法：node user-manager.js del <user_id>');
        return;
      }
      await deleteUser(args[1]);
      break;
    
    case 'reset':
      if (args.length < 3) {
        console.error('❌ 用法：node user-manager.js reset <user_id> <password>');
        return;
      }
      await resetPassword(args[1], args[2]);
      break;
    
    case 'list':
      await listUsers();
      break;
    
    case 'disable':
      if (args.length < 2) {
        console.error('❌ 用法：node user-manager.js disable <user_id>');
        return;
      }
      await disableUser(args[1]);
      break;
    
    case 'enable':
      if (args.length < 2) {
        console.error('❌ 用法：node user-manager.js enable <user_id>');
        return;
      }
      await enableUser(args[1]);
      break;
    
    default:
      console.error(`❌ 未知命令：${command}`);
      console.log('使用 node user-manager.js 查看帮助');
  }
}

main().catch(err => {
  console.error('❌ 错误:', err.message);
  process.exit(1);
});
