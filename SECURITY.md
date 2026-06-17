# Security Notes

## Sensitive local files

这些路径不应该进入公开仓库：

- `.wrangler/`
- `.env`
- `.dev.vars`
- 任何导出的请求日志、调试快照、浏览器 Cookie 文件

`.wrangler/` 在本项目里可能包含本地 KV 持久化内容，而 KV 里会保存哔哩哔哩登录会话。

## Web security model

- 前端与 API 由同一个 Worker 提供
- 所有会修改状态的接口都要求：
  - 同源 `Origin`
  - `HttpOnly` 会话 Cookie
  - 会话绑定的 CSRF token
- 二维码登录状态保存在服务端 session 中，不通过查询参数暴露登录凭据

## Before publishing

1. 删除本地 `.wrangler/`
2. 确认没有把真实 Cookie、session、日志文件加入暂存区
3. 检查 `wrangler.toml` 是否需要替换成示例配置
4. 重新登录 B 站，避免使用旧的本地调试会话
