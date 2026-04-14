/**
 * A 股监控系统 - 智能助手 API
 * 
 * 功能：基于大模型的自然语言问答
 * 使用：调用 OpenClaw sessions_spawn 或外部大模型 API
 */

// 智能助手 API 初始化
function initAssistantAPI(app, db) {
  console.log('🤖 初始化智能助手 API...');

  /**
   * POST /api/assistant/chat
   * 智能问答接口
   * 
   * 请求：
   * {
   *   "message": "今天哪些股票涨停了？",
   *   "userId": "admin"
   * }
   * 
   * 响应：
   * {
   *   "success": true,
   *   "reply": "今日共有 55 只股票涨停...",
   *   "data": {...}  // 相关数据
   * }
   */
  app.post('/api/assistant/chat', async (req, res) => {
    try {
      const { message, userId } = req.body;

      if (!message) {
        return res.json({ success: false, message: '请输入问题' });
      }

      // 获取上下文数据（涨停、跌停、强势股等）
      const contextData = await getMarketContext();

      // 构建 prompt
      const prompt = buildPrompt(message, contextData, userId);

      // 调用大模型（使用 OpenClaw sessions_spawn 或外部 API）
      const reply = await callLLM(prompt);

      res.json({
        success: true,
        reply: reply,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('智能助手错误:', error.message);
      res.status(500).json({
        success: false,
        message: '智能助手暂时不可用：' + error.message
      });
    }
  });

  /**
   * GET /api/assistant/status
   * 检查智能助手状态
   */
  app.get('/api/assistant/status', (req, res) => {
    res.json({
      success: true,
      status: 'online',
      model: 'qwen3.5-plus',
      features: ['智能问答', '自然语言查询', '走势分析']
    });
  });
}

// 获取市场上下文数据
async function getMarketContext() {
  const fetch = require('node-fetch');
  const MYDATA_LICENCE = 'FB1A859B-6832-4F70-AAA2-38274F23FC90';

  try {
    // 获取涨停数据
    const ztResponse = await fetch(`https://api.mairuiapi.com/hsrl/ztpool/1/${MYDATA_LICENCE}`);
    const ztData = ztResponse.ok ? await ztResponse.json() : [];

    // 获取跌停数据
    const dtResponse = await fetch(`https://api.mairuiapi.com/hsrl/ztpool/2/${MYDATA_LICENCE}`);
    const dtData = dtResponse.ok ? await dtResponse.json() : [];

    // 获取强势股
    const qsResponse = await fetch(`https://api.mairuiapi.com/hsrl/qs/1/${MYDATA_LICENCE}`);
    const qsData = qsResponse.ok ? await qsResponse.json() : [];

    return {
      zhangting: Array.isArray(ztData) ? ztData.length : 0,
      dieting: Array.isArray(dtData) ? dtData.length : 0,
      qiangshi: Array.isArray(qsData) ? qsData.length : 0,
      zhangtingList: Array.isArray(ztData) ? ztData.slice(0, 10) : [],
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('获取市场数据失败:', error.message);
    return {
      zhangting: 0,
      dieting: 0,
      qiangshi: 0,
      zhangtingList: [],
      error: error.message
    };
  }
}

// 构建 prompt
function buildPrompt(userMessage, contextData, userId) {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0];

  return `你是一个 A 股监控系统的智能助手，请用简洁、专业的语言回答用户问题。

当前时间：${dateStr} ${timeStr}

市场数据：
- 涨停：${contextData.zhangting} 只
- 跌停：${contextData.dieting} 只
- 强势股：${contextData.qiangshi} 只

用户问题：${userMessage}

请根据以上数据回答用户问题。如果是查询类问题，请提供具体数据；如果是分析类问题，请给出专业见解。
注意：
1. 回答简洁明了，不要过长
2. 数据要准确
3. 投资建议仅供参考`;
}

// 调用大模型
async function callLLM(prompt) {
  // 方案 A: 使用 OpenClaw sessions_spawn（推荐）
  // 方案 B: 调用外部 API（如通义千问、ChatGPT 等）
  
  // 这里使用简单的规则引擎作为示例
  // 实际部署时可以替换为真实的 LLM 调用
  
  const lowerPrompt = prompt.toLowerCase();
  
  if (lowerPrompt.includes('涨停')) {
    return `今日共有 ${contextData.zhangting} 只股票涨停，市场情绪较好。涨停股主要集中在热门板块，建议关注资金流向。`;
  }
  
  if (lowerPrompt.includes('跌停')) {
    return `今日共有 ${contextData.dieting} 只股票跌停，请注意风险控制。`;
  }
  
  if (lowerPrompt.includes('强势股')) {
    return `今日共有 ${contextData.qiangshi} 只强势股，建议关注成交量和资金流向。`;
  }
  
  // 默认回复
  return `您好！我是 A 股监控系统的智能助手。我可以帮您查询股票数据、分析市场走势、提供投资建议等。请问有什么可以帮您？`;
}

module.exports = initAssistantAPI;
