#!/usr/bin/env node
/**
 * 数据库升级脚本 v5
 * 添加定时任务表 (scheduled_tasks)
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
    // 创建定时任务表
    db.run(`
      CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL,
        cron VARCHAR(50) NOT NULL,
        status INTEGER DEFAULT 1,
        last_run DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ scheduled_tasks 表创建成功');
    
    // 插入默认任务
    const existingTasks = db.exec("SELECT COUNT(*) FROM scheduled_tasks WHERE id='sync-securities'");
    if (existingTasks.length === 0 || existingTasks[0].values[0][0] === 0) {
      db.run(`INSERT INTO scheduled_tasks (id, name, type, cron, status) VALUES ('sync-securities', '同步证券信息', 'sync-securities', '0 6 * * *', 1)`);
      console.log('✓ 插入默认任务：同步证券信息');
    }
    
    // 保存数据库
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
    console.log('✓ 数据库已保存');
    
    console.log('\n✅ 数据库升级完成！');
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