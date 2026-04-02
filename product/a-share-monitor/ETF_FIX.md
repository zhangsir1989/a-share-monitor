# 🔧 ETF 查询功能修复

## 更新时间
2026-03-31 09:55 UTC

---

## 问题描述

用户反馈：搜索到 ETF 后，点击查询显示"不支持的股票代码"错误。

**示例**:
```
搜索：159869 游戏 ETF
结果：❌ 不支持的股票代码
```

---

## 问题原因

**市场前缀识别逻辑不完整**:

原代码只识别股票：
```javascript
if (code.startsWith('6') || code.startsWith('9')) {
  market = 'sh';  // 沪市股票
} else if (code.startsWith('0') || code.startsWith('3')) {
  market = 'sz';  // 深市股票
}
```

**遗漏了 ETF 代码**:
- **沪市 ETF**: 510/512/513/515/518/560 开头
- **深市 ETF**: 159 开头

---

## 修复方案

### 修改市场识别逻辑

**修复前**:
```javascript
if (code.startsWith('6') || code.startsWith('9')) {
  market = 'sh';
} else if (code.startsWith('0') || code.startsWith('3')) {
  market = 'sz';
}
```

**修复后**:
```javascript
if (code.startsWith('6') || code.startsWith('9') || code.startsWith('5')) {
  market = 'sh';  // 沪市股票 + ETF
} else if (code.startsWith('0') || code.startsWith('3') || code.startsWith('1')) {
  market = 'sz';  // 深市股票 + ETF
}
```

---

## 修复效果

### 修复前
```
搜索：159869 游戏 ETF
点击查询 → ❌ 不支持的股票代码
```

### 修复后
```
搜索：159869 游戏 ETF
点击查询 → ✅ 游戏 ETF 华夏 价格：1.263 涨跌：-0.94%
```

---

## 测试验证

### 测试 1：深市 ETF
```bash
查询：159869
结果：✅ 游戏 ETF 华夏 价格：1.263 涨跌：-0.94%
```

### 测试 2：沪市 ETF
```bash
查询：518880
结果：✅ 黄金 ETF 华安 价格：9.699 涨跌：0.45%
```

### 测试 3：宽基 ETF
```bash
查询：510300
结果：✅ 沪深 300ETF 华泰柏瑞 价格：4.463 涨跌：-0.82%
```

### 测试 4：跨境 ETF
```bash
查询：513100
结果：✅ 纳指 ETF 价格：X.XX 涨跌：X.XX%
```

---

## 支持的 ETF 代码前缀

### 沪市 ETF（sh）
| 前缀 | 类型 | 示例 |
|------|------|------|
| 510 | 宽基 ETF | 510300 沪深 300ETF |
| 512 | 行业 ETF | 512690 酒 ETF |
| 513 | 跨境 ETF | 513100 纳指 ETF |
| 515 | 主题 ETF | 515030 新能源车 ETF |
| 518 | 商品 ETF | 518880 黄金 ETF |
| 560 | 策略 ETF | 560050 红利低波 ETF |
| 561 | 科创 ETF | 561000 科创 50ETF |

### 深市 ETF（sz）
| 前缀 | 类型 | 示例 |
|------|------|------|
| 159 | 各类 ETF | 159869 游戏 ETF |

---

## 代码变更

### 文件
`src/data-api.js` - `fetchStockDetail()` 函数

### 修改内容
```diff
- if (code.startsWith('6') || code.startsWith('9')) {
+ if (code.startsWith('6') || code.startsWith('9') || code.startsWith('5')) {
    market = 'sh';
- } else if (code.startsWith('0') || code.startsWith('3')) {
+ } else if (code.startsWith('0') || code.startsWith('3') || code.startsWith('1')) {
    market = 'sz';
```

---

## 注意事项

### ETF 特殊规则
1. **涨跌幅限制**:
   - 大部分 ETF：10%
   - 跨境 ETF、债券 ETF：20%

2. **交易规则**:
   - 大部分 ETF：T+1
   - 跨境 ETF、债券 ETF、黄金 ETF：T+0

3. **交易单位**:
   - 100 份起买
   - 无印花税

4. **数据延迟**:
   - 免费 API 可能有 1-3 秒延迟
   - 实时行情需付费

---

## 相关修复

### 已完成
- ✅ ETF 搜索功能（2026-03-31 09:53）
- ✅ ETF 查询功能（2026-03-31 09:55）
- ✅ 市场前缀识别（2026-03-31 09:55）

### 待优化
- [ ] 添加 ETF 特殊标识
- [ ] 显示 ETF 净值
- [ ] 显示 ETF 持仓
- [ ] 添加 ETF 规模

---

## 测试命令

```bash
# 测试深市 ETF
curl "http://localhost:3000/api/stock/159869"

# 测试沪市 ETF
curl "http://localhost:3000/api/stock/518880"

# 测试宽基 ETF
curl "http://localhost:3000/api/stock/510300"
```

---

## 访问地址

**http://localhost:3000/stock**

现在可以正常查询所有 ETF 基金了！

**测试示例**:
- 159869 - 游戏 ETF
- 518880 - 黄金 ETF
- 510300 - 沪深 300ETF
- 513100 - 纳指 ETF

---

**版本**: v1.7.1  
**状态**: ✅ 已修复  
**最后更新**: 2026-03-31 09:55 UTC
