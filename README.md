# netease-to-bilibili

将网易云音乐公开歌单同步到哔哩哔哩收藏夹的 Web 工具。

基于 Cloudflare Workers 构建，无需安装，浏览器直接使用。

## 功能特性

- 粘贴网易云公开歌单链接，自动解析全部曲目
- 哔哩哔哩扫码登录，会话保存在服务端（浏览器仅持有 HttpOnly Cookie）
- 智能匹配：根据歌名、艺人、时长、官方认证等多维度评分，自动选择最佳结果
- 自动创建收藏夹并逐首搜索、加入收藏
- 支持大歌单（自动分批获取全量曲目）
- 匹配结果分三档：自动采纳 / 需人工确认 / 跳过，降低误收藏风险

## 技术栈

- **运行时**：Cloudflare Workers
- **框架**：Hono
- **语言**：TypeScript
- **存储**：Cloudflare KV（会话持久化）
- **加密**：Web Crypto API（网易云 weapi 加密）

## 快速开始

### 前置条件

- Node.js 18+
- Cloudflare 账号（免费版即可）

### 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 创建 KV namespace
npx wrangler kv_namespace create SESSIONS
npx wrangler kv_namespace create SESSIONS --preview

# 3. 将返回的 id / preview_id 填入 wrangler.toml
#    或直接复制 wrangler.toml.example 并填写

# 4. 启动本地开发服务器
npm run dev
```

浏览器打开 `http://localhost:8787` 即可使用。

### 部署到 Cloudflare

```bash
# 部署
npm run deploy
```

## 项目结构

```
src/
├── worker.ts       # Worker 入口，Hono 路由
├── bilibili.ts     # B 站 API（WBI 签名、搜索、收藏）
├── netease.ts      # 网易云 API（weapi 加密、歌单解析）
├── session.ts      # KV 会话管理
├── frontend.ts     # 前端 HTML（内嵌单页应用）
└── types.ts        # TypeScript 类型定义
```

## 安全模型

- 所有写操作要求同源 `Origin` + 会话绑定的 CSRF Token
- 二维码登录状态绑定到当前浏览器会话，防止跨会话复用
- 会话数据保存在 Worker KV，前端不接触 B 站 Cookie
- 安全头：CSP、X-Frame-Options、Referrer-Policy 等

详见 [SECURITY.md](./SECURITY.md)。

## 匹配策略

搜索 B 站视频时，按以下维度综合评分：

| 维度 | 说明 |
|------|------|
| 歌名匹配 | 完整包含 > 去空格匹配 > 关键词命中 |
| 艺人匹配 | 艺人名在标题/作者中出现 |
| 时长接近度 | 差异 ≤5s 高分，≥90s 扣分 |
| 官方认证 | B 站认证账号加分 |
| 播放/收藏量 | 高互动视频加分 |
| 噪声过滤 | 翻唱、剪辑、教程等降分 |

匹配结果分三档：
- **自动采纳**（≥62 分）：高置信度，直接收藏
- **需人工确认**（≥36 分）：可能匹配，需用户确认
- **跳过**（<36 分）：低置信度，避免误收藏

## 已知限制

- B 站搜索结果质量不稳定，部分冷门歌曲可能无法匹配
- 网易云接口偶尔返回部分曲目，已做自动补全但极端情况仍可能受影响
- 网易云和 B 站的 API 可能随时变更，导致功能异常

## 许可证

[MIT License](./LICENSE)
