# 🔧 总市值/流通市值显示修复

## 更新时间
2026-03-31 10:20 UTC

---

## 问题描述

用户反馈：查询个股行情时，总市值和流通市值显示为 0.00 或 0.01，没有正确数值。

**示例**:
```
鹏辉能源 (300438)
总市值：0.00 亿元 ❌
流通市值：0.01 亿元 ❌
```

---

## 问题原因

**字段索引错误** + **单位理解错误**

### 错误 1：字段索引错误
原代码使用了错误的字段索引：
```javascript
const totalMarketCap = parseFloat(parts[40]) || 0;  // ❌ 错误字段
const floatMarketCap = parseFloat(parts[41]) || 0;  // ❌ 错误字段
```

### 错误 2：单位理解错误
以为字段单位是万元，实际是亿元：
```javascript
totalMarketCap: totalMarketCapWan / 10000,  // ❌ 重复转换
```

---

## 腾讯 API 字段说明

通过解析 `http://qt.gtimg.cn/q=sz300438` 返回数据：

| 索引 | 字段 | 说明 | 单位 |
|------|------|------|------|
| 3 | 现价 | 当前价格 | 元 |
| 4 | 昨收 | 昨日收盘价 | 元 |
| 5 | 今开 | 今日开盘价 | 元 |
| 6 | 成交量 | 成交手数 | 手 |
| 31 | 涨跌额 | 涨跌金额 | 元 |
| 32 | 涨跌幅 | 涨跌百分比 | % |
| 33 | 最高 | 最高价 | 元 |
| 34 | 最低 | 最低价 | 元 |
| 37 | 成交额 | 成交金额 | 万元 |
| 38 | 换手率 | 换手率 | % |
| 39 | 市盈率 | 市盈率 (TTM) | - |
| 43 | 量比 | 量比指标 | - |
| **44** | **总市值** | **总市值** | **亿元** ✅ |
| **45** | **流通市值** | **流通市值** | **亿元** ✅ |
| 47 | 市净率 | 市净率 | - |

---

## 修复方案

### 修复前
```javascript
// 错误的字段索引和单位
const totalMarketCap = parseFloat(parts[40]) || 0;
const floatMarketCap = parseFloat(parts[41]) || 0;

// 返回时重复转换
totalMarketCap: totalMarketCap / 10000,
```

### 修复后
```javascript
// 正确的字段索引（44 和 45）
const totalMarketCap = parseFloat(parts[44]) || 0;  // 亿元
const floatMarketCap = parseFloat(parts[45]) || 0;  // 亿元

// 直接返回，不需要转换
totalMarketCap: totalMarketCap,
floatMarketCap: floatMarketCap,
```

---

## 修复效果

### 修复前
```
鹏辉能源 (300438)
总市值：0.00 亿元 ❌
流通市值：0.01 亿元 ❌
```

### 修复后
```
鹏辉能源 (300438)
总市值：228.11 亿元 ✅
流通市值：284.09 亿元 ✅
```

---

## 测试验证

### 测试 1：创业板股票
```
300438 鹏辉能源
总市值：228.11 亿元 ✅
流通市值：284.09 亿元 ✅
```

### 测试 2：沪市股票
```
600519 贵州茅台
总市值：18157.92 亿元 ✅
流通市值：18157.92 亿元 ✅
```

### 测试 3：ETF 基金
```
510300 沪深 300ETF
总市值：2004.48 亿元 ✅
流通市值：2004.48 亿元 ✅
```

---

## 文件变更

### 修改的文件
- `src/data-api.js` - `fetchStockDetail()` 函数

### 修改内容
```diff
- const totalMarketCap = parseFloat(parts[40]) || 0;
- const floatMarketCap = parseFloat(parts[41]) || 0;
+ const totalMarketCap = parseFloat(parts[44]) || 0;
+ const floatMarketCap = parseFloat(parts[45]) || 0;

- totalMarketCap: totalMarketCap / 10000,
- floatMarketCap: floatMarketCap / 10000,
+ totalMarketCap: totalMarketCap,
+ floatMarketCap: floatMarketCap,
```

---

## 注意事项

### 腾讯 API 字段单位
- **成交额 (字段 37)**: 万元
- **总市值 (字段 44)**: 亿元
- **流通市值 (字段 45)**: 亿元

### 数据精度
- 市值数据保留 2 位小数
- 单位统一为亿元
- 前端自动适配显示（亿/万亿）

---

## 相关修复

### 已完成
- ✅ 修复字段索引（40/41 → 44/45）
- ✅ 修复单位转换（不需要转换）
- ✅ 测试多种类型股票

### 关联修复
- 2026-03-31 06:00 - 成交额计算修复
- 2026-03-31 09:55 - ETF 查询修复

---

## 测试命令

```bash
# 测试创业板
curl "http://localhost:3000/api/stock/300438"

# 测试沪市
curl "http://localhost:3000/api/stock/600519"

# 测试 ETF
curl "http://localhost:3000/api/stock/510300"
```

---

## 访问地址

**http://localhost:3000/stock**

现在总市值和流通市值显示正常了！

**测试示例**:
- 300438 - 鹏辉能源 - 总市值：228.11 亿
- 600519 - 贵州茅台 - 总市值：18157.92 亿
- 510300 - 沪深 300ETF - 总市值：2004.48 亿

---

**版本**: v1.7.2  
**状态**: ✅ 已修复  
**最后更新**: 2026-03-31 10:20 UTC
