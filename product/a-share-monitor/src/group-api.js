// ==================== 分组管理 API（type 字段关联）====================
// 导出初始化函数，接收 app 和 db 依赖
const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, '../data/users.db');

function saveDatabase(db) {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
    console.log(`💾 分组 API：数据库已保存 (${buffer.length} bytes)`);
  }
}

module.exports = function(app, db) {

// 获取分组列表
app.get('/api/custom-groups/list', (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    
    // 确保默认分组存在（type=1）
    const defaultGroupCheck = db.exec(`SELECT id FROM custom_groups WHERE user_id = '${userId}' AND type = 1`);
    if (defaultGroupCheck.length === 0) {
      db.run(`INSERT INTO custom_groups (user_id, name, type, icon, color) VALUES (?, '我的自选股', 1, '📁', '#4a9eff')`, [userId]);
      saveDatabase(db);
      console.log(`✅ 为用户 ${userId} 创建默认分组（type=1）`);
    }
    
    // 获取所有分组（包含股票数量统计）
    const groupsResult = db.exec(`
      SELECT g.id, g.name, g.type, g.icon, g.color, g.created_at, COUNT(s.id) as stockCount
      FROM custom_groups g
      LEFT JOIN custom_stocks s ON g.type = s.type AND g.user_id = s.user_id
      WHERE g.user_id = '${userId}'
      GROUP BY g.id
      ORDER BY g.type ASC
    `);
    
    const groups = groupsResult.length > 0 ? groupsResult[0].values.map(row => ({
      id: row[0], name: row[1], type: row[2], icon: row[3], color: row[4], createdAt: row[5], stockCount: row[6]
    })) : [];
    
    // 获取股票 - 分组映射（通过 type）
    const stocksResult = db.exec(`SELECT stock_code, type FROM custom_stocks WHERE user_id = '${userId}'`);
    const stockGroups = {};
    if (stocksResult.length > 0) {
      stocksResult[0].values.forEach(row => { stockGroups[row[0]] = row[1]; });
    }
    
    res.json({ success: true, data: { groups, stockGroups } });
  } catch (error) {
    console.error('获取分组列表失败:', error.message);
    res.status(500).json({ success: false, message: '获取分组列表失败' });
  }
});

// 创建分组（自动分配 type）
app.post('/api/custom-groups/create', (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ success: false, message: '未登录' });
    
    const { name, icon, color } = req.body;
    if (!name) return res.status(400).json({ success: false, message: '分组名称不能为空' });
    
    // 获取最大 type 值 +1
    const maxTypeResult = db.exec(`SELECT MAX(type) as maxType FROM custom_groups WHERE user_id = '${userId}'`);
    const maxType = maxTypeResult.length > 0 ? (maxTypeResult[0].values[0][0] || 1) : 1;
    const newType = maxType + 1;
    
    db.run(`INSERT INTO custom_groups (user_id, name, type, icon, color) VALUES (?, ?, ?, ?, ?)`,
      [userId, name, newType, icon || '📁', color || '#4a9eff']);
    saveDatabase(db);
    
    const result = db.exec(`SELECT last_insert_rowid()`);
    console.log(`✅ 用户 ${userId} 创建分组：${name} (type=${newType})`);
    res.json({ success: true, message: '分组创建成功', data: { id: result[0].values[0][0], name, type: newType, icon, color } });
  } catch (error) {
    console.error('创建分组失败:', error.message);
    res.status(500).json({ success: false, message: '创建分组失败' });
  }
});

// 更新分组
app.post('/api/custom-groups/update', (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ success: false, message: '未登录' });
    
    const { id, name, icon, color } = req.body;
    if (!id || !name) return res.status(400).json({ success: false, message: '参数错误' });
    
    const check = db.exec(`SELECT COUNT(*) FROM custom_groups WHERE id = ${id} AND user_id = '${userId}'`);
    if (check[0].values[0][0] === 0) return res.status(404).json({ success: false, message: '分组不存在' });
    
    db.run(`UPDATE custom_groups SET name = ?, icon = ?, color = ? WHERE id = ? AND user_id = ?`,
      [name, icon || '📁', color || '#4a9eff', id, userId]);
    saveDatabase(db);
    
    console.log(`✅ 用户 ${userId} 更新分组：${name}`);
    res.json({ success: true, message: '分组更新成功' });
  } catch (error) {
    console.error('更新分组失败:', error.message);
    res.status(500).json({ success: false, message: '更新分组失败' });
  }
});

// 删除分组（股票回归默认分组 type=1）
app.post('/api/custom-groups/delete', (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ success: false, message: '未登录' });
    
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, message: '参数错误' });
    
    const groupCheck = db.exec(`SELECT type, name FROM custom_groups WHERE id = ${id} AND user_id = '${userId}'`);
    if (groupCheck.length === 0) return res.status(404).json({ success: false, message: '分组不存在' });
    
    const groupType = groupCheck[0].values[0][0];
    const groupName = groupCheck[0].values[0][1];
    if (groupType === 1) return res.status(400).json({ success: false, message: '不能删除默认自选股分组' });
    
    // 查询该分组下的股票数量
    const stockCount = db.exec(`SELECT COUNT(*) FROM custom_stocks WHERE user_id = '${userId}' AND type = ${groupType}`);
    const count = stockCount.length > 0 ? stockCount[0].values[0][0] : 0;
    
    if (count > 0) {
      // 删除该分组下的所有股票
      console.log(`🗑️ 删除分组下的股票：user_id='${userId}', type=${groupType}, 数量=${count}`);
      db.run(`DELETE FROM custom_stocks WHERE user_id = '${userId}' AND type = ${groupType}`);
      console.log(`✅ 已删除 ${count} 只股票`);
    }
    
    // 删除分组
    console.log(`🗑️ 删除分组：id=${id}, name=${groupName} (type=${groupType})`);
    db.run(`DELETE FROM custom_groups WHERE id = ${id} AND user_id = '${userId}'`);
    
    // 验证删除
    const verifyGroup = db.exec(`SELECT id FROM custom_groups WHERE id = ${id} AND user_id = '${userId}'`);
    const verifyStocks = db.exec(`SELECT stock_code FROM custom_stocks WHERE user_id = '${userId}' AND type = ${groupType}`);
    
    if (verifyGroup.length === 0 && (verifyStocks.length === 0 || verifyStocks[0].values.length === 0)) {
      console.log(`✅ 验证：分组和股票已全部删除`);
    } else {
      console.log(`⚠️ 警告：删除后仍有残留数据`);
    }
    
    saveDatabase(db);
    console.log(`💾 数据库已保存到 ${DB_PATH}`);
    
    console.log(`✅ 用户 ${userId} 删除分组：${groupName} (type=${groupType})，已删除 ${count} 只股票`);
    res.json({ success: true, message: `分组删除成功，已删除 ${count} 只股票` });
  } catch (error) {
    console.error('删除分组失败:', error.message);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({ success: false, message: '删除分组失败：' + error.message });
  }
});

// 将股票分配到分组（修改 type 字段）
app.post('/api/custom-groups/assign', (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ success: false, message: '未登录' });
    
    const { code, market, type } = req.body;
    if (!code || !type) return res.status(400).json({ success: false, message: '参数错误' });
    
    const stockMarket = market || (code.startsWith('6') ? 'sh' : code.startsWith('0') || code.startsWith('3') ? 'sz' : code.startsWith('8') || code.startsWith('4') ? 'bj' : 'hk');
    
    const checkResult = db.exec(`SELECT id FROM custom_stocks WHERE user_id = '${userId}' AND stock_code = '${code}'`);
    
    if (checkResult.length === 0) {
      db.run(`INSERT INTO custom_stocks (user_id, stock_code, stock_market, type) VALUES (?, ?, ?, ?)`,
        [userId, code, stockMarket, type]);
      console.log(`✅ 用户 ${userId} 自动添加股票 ${code} 到分组 (type=${type})`);
    } else {
      db.run(`UPDATE custom_stocks SET type = ? WHERE user_id = ? AND stock_code = ?`, [type, userId, code]);
      console.log(`✅ 用户 ${userId} 移动股票 ${code} 到分组 (type=${type})`);
    }
    
    saveDatabase(db);
    res.json({ success: true, message: '已分配到分组' });
  } catch (error) {
    console.error('分配分组失败:', error.message);
    res.status(500).json({ success: false, message: '分配分组失败' });
  }
});

// 从分组移除股票（回归默认分组 type=1）
app.post('/api/custom-groups/remove', (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ success: false, message: '未登录' });
    
    const { code, market } = req.body;
    if (!code) return res.status(400).json({ success: false, message: '参数错误' });
    
    const stockMarket = market || (code.startsWith('6') ? 'sh' : code.startsWith('0') || code.startsWith('3') ? 'sz' : code.startsWith('8') || code.startsWith('4') ? 'bj' : 'hk');
    
    db.run(`UPDATE custom_stocks SET type = 1 WHERE user_id = ? AND stock_code = ? AND stock_market = ?`,
      [userId, code, stockMarket]);
    saveDatabase(db);
    
    console.log(`✅ 用户 ${userId} 将股票 ${code} 移回默认分组`);
    res.json({ success: true, message: '已移回默认自选股' });
  } catch (error) {
    console.error('移除分组失败:', error.message);
    res.status(500).json({ success: false, message: '移除分组失败' });
  }
});

}; // 结束 module.exports
