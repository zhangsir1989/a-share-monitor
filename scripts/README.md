# HTML 规则校验工具

## 使用方法

### 校验指定目录
```bash
node scripts/validate-html.js <目录路径>
```

### 示例
```bash
# 校验整个项目
node scripts/validate-html.js product/a-share-monitor/public

# 校验当前目录
node scripts/validate-html.js .
```

## 校验规则

### 规则 1: Script 标签闭合 (script-closed)
- **要求**: 所有 `<script>` 标签必须正确闭合
- **错误示例**: `<script src="app.js">` ❌
- **正确示例**: `<script src="app.js"></script>` ✅

### 规则 2: Link 标签闭合 (link-closed)
- **要求**: `<link>` 标签应使用自闭合语法
- **正确示例**: `<link rel="stylesheet" href="style.css">` ✅

### 规则 3: Meta 标签闭合 (meta-closed)
- **要求**: `<meta>` 标签应使用自闭合语法
- **正确示例**: `<meta charset="UTF-8">` ✅

## 在 CI/CD 中使用

```bash
# 校验失败时返回非零退出码
node scripts/validate-html.js public || exit 1
```

## 扩展规则

在 `validate-html.js` 的 `rules` 数组中添加新规则：

```javascript
const rules = [
  {
    id: 'rule-id',
    name: '规则名称',
    description: '规则描述',
    check: function(content, filePath) {
      // 实现校验逻辑
      return { errors: [], warnings: [] };
    }
  }
];
```
