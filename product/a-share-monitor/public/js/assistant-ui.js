/**
 * A 股监控系统 - 智能助手前端模块
 * 
 * 功能：聊天界面、消息发送、回复显示
 */

const AssistantUI = {
  // 配置
  config: {
    apiEndpoint: '/api/assistant/chat',
    statusEndpoint: '/api/assistant/status'
  },

  // 状态
  state: {
    isOpen: false,
    isTyping: false,
    messages: []
  },

  // DOM 元素
  elements: {},

  /**
   * 初始化
   */
  init() {
    this.createUI();
    this.bindEvents();
    this.checkStatus();
    console.log('🤖 智能助手已初始化');
  },

  /**
   * 创建 UI
   */
  createUI() {
    const html = `
      <!-- 智能助手入口按钮 -->
      <div id="assistant-toggle" class="assistant-toggle" title="智能助手">
        <span class="icon">🤖</span>
        <span class="badge" id="assistant-badge" style="display: none;">0</span>
      </div>

      <!-- 智能助手聊天窗口 -->
      <div id="assistant-panel" class="assistant-panel" style="display: none;">
        <div class="assistant-header">
          <div class="assistant-title">
            <span class="icon">🤖</span>
            <span>智能助手</span>
          </div>
          <div class="assistant-actions">
            <button class="btn-minimize" id="assistant-minimize" title="最小化">−</button>
            <button class="btn-close" id="assistant-close" title="关闭">×</button>
          </div>
        </div>

        <div class="assistant-messages" id="assistant-messages">
          <!-- 欢迎消息 -->
          <div class="message assistant-message">
            <div class="message-content">
              您好！我是 A 股监控系统的智能助手 🤖
              <br><br>
              我可以帮您：
              <br>• 查询股票数据（涨停、跌停、强势股）
              <br>• 分析市场走势
              <br>• 解答投资问题
              <br><br>
              请问有什么可以帮您？
            </div>
            <div class="message-time">${this.formatTime(new Date())}</div>
          </div>
        </div>

        <div class="assistant-input">
          <input 
            type="text" 
            id="assistant-input-field" 
            placeholder="输入您的问题..." 
            class="input-field"
          />
          <button id="assistant-send" class="send-btn">
            <span>发送</span>
          </button>
        </div>

        <div class="assistant-status" id="assistant-status">
          <span class="status-dot"></span>
          <span>在线</span>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    this.cacheElements();
  },

  /**
   * 缓存 DOM 元素
   */
  cacheElements() {
    this.elements = {
      toggle: document.getElementById('assistant-toggle'),
      panel: document.getElementById('assistant-panel'),
      messages: document.getElementById('assistant-messages'),
      input: document.getElementById('assistant-input-field'),
      send: document.getElementById('assistant-send'),
      close: document.getElementById('assistant-close'),
      minimize: document.getElementById('assistant-minimize'),
      status: document.getElementById('assistant-status'),
      badge: document.getElementById('assistant-badge')
    };
  },

  /**
   * 绑定事件
   */
  bindEvents() {
    // 打开/关闭
    this.elements.toggle.addEventListener('click', () => this.toggle());
    this.elements.close.addEventListener('click', () => this.close());
    this.elements.minimize.addEventListener('click', () => this.minimize());

    // 发送消息
    this.elements.send.addEventListener('click', () => this.sendMessage());
    this.elements.input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });
  },

  /**
   * 检查助手状态
   */
  async checkStatus() {
    try {
      const response = await fetch(this.config.statusEndpoint);
      const data = await response.json();
      
      if (data.success) {
        this.elements.status.innerHTML = '<span class="status-dot"></span><span>在线</span>';
      } else {
        this.elements.status.innerHTML = '<span class="status-dot offline"></span><span>离线</span>';
      }
    } catch (error) {
      this.elements.status.innerHTML = '<span class="status-dot offline"></span><span>连接失败</span>';
    }
  },

  /**
   * 切换显示
   */
  toggle() {
    this.state.isOpen = !this.state.isOpen;
    this.elements.panel.style.display = this.state.isOpen ? 'flex' : 'none';
    this.elements.toggle.style.display = this.state.isOpen ? 'none' : 'flex';
  },

  /**
   * 关闭
   */
  close() {
    this.state.isOpen = false;
    this.elements.panel.style.display = 'none';
    this.elements.toggle.style.display = 'flex';
  },

  /**
   * 最小化
   */
  minimize() {
    this.state.isOpen = false;
    this.elements.panel.style.display = 'none';
    this.elements.toggle.style.display = 'flex';
  },

  /**
   * 发送消息
   */
  async sendMessage() {
    const message = this.elements.input.value.trim();
    if (!message) return;

    // 添加用户消息
    this.addMessage(message, 'user');
    this.elements.input.value = '';

    // 显示正在输入
    this.showTyping();

    try {
      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: message,
          userId: this.getCurrentUserId()
        })
      });

      const data = await response.json();

      this.hideTyping();

      if (data.success) {
        this.addMessage(data.reply, 'assistant');
      } else {
        this.addMessage('抱歉，处理您的请求时出错了：' + (data.message || '未知错误'), 'assistant');
      }
    } catch (error) {
      this.hideTyping();
      this.addMessage('抱歉，网络错误：' + error.message, 'assistant');
    }
  },

  /**
   * 添加消息
   */
  addMessage(content, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    
    messageDiv.innerHTML = `
      <div class="message-content">${content}</div>
      <div class="message-time">${this.formatTime(new Date())}</div>
    `;

    this.elements.messages.appendChild(messageDiv);
    this.scrollToBottom();
  },

  /**
   * 显示正在输入
   */
  showTyping() {
    this.state.isTyping = true;
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message assistant-message typing';
    typingDiv.id = 'typing-indicator';
    typingDiv.innerHTML = `
      <div class="message-content">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    `;
    this.elements.messages.appendChild(typingDiv);
    this.scrollToBottom();
  },

  /**
   * 隐藏正在输入
   */
  hideTyping() {
    this.state.isTyping = false;
    const typingDiv = document.getElementById('typing-indicator');
    if (typingDiv) typingDiv.remove();
  },

  /**
   * 滚动到底部
   */
  scrollToBottom() {
    this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
  },

  /**
   * 格式化时间
   */
  formatTime(date) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  },

  /**
   * 获取当前用户 ID
   */
  getCurrentUserId() {
    // 从 cookie 或 localStorage 获取
    const user = localStorage.getItem('user');
    if (user) {
      try {
        return JSON.parse(user).username || 'user';
      } catch {
        return 'user';
      }
    }
    return 'user';
  }
};

// 自动初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => AssistantUI.init());
} else {
  AssistantUI.init();
}
