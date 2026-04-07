# MyData 数据 API 配置说明

## 当前配置

**Licence 证书**: `DAE75AE0-149C-4B1E-8D70-AA2D30F49280`

已配置到 `.env` 文件中。

## 注意事项

⚠️ **重要**：该 licence 证书可能需要登录认证或特定的 API 接口格式。

当前系统已实现：
- ✅ MyData API 对接逻辑（支持多种接口格式尝试）
- ✅ API 失败时自动降级使用本地股票列表
- ✅ 本地股票列表包含 470 只证券

## 当前状态

- 证券同步功能正常（使用本地列表）
- 定时任务可正常执行
- 证券信息页面可正常查询（470 条数据）

## 如需使用 MyData API

请联系 MyData 技术支持确认：
1. 正确的 API 接口地址
2. API 参数格式
3. 是否需要额外的认证步骤

## 测试同步

```bash
# 手动执行同步
curl -X POST http://localhost:3000/api/securities/sync -b cookies.txt

# 查看日志
tail -f server_output.log | grep -E "同步|✓|✗|✅|MyData"
```

## 日志示例

```
🔄 开始同步证券信息...
📍 请求 MyData API 获取证券列表...
⚠️ MyData API 请求失败，降级使用本地股票列表
📊 使用本地股票列表：835 条
✅ 共同步 470 只证券（新增 0，更新 0），耗时 0.21 秒
```
