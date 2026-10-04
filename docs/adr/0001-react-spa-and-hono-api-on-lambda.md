# React 单页应用加 Lambda 上的 Hono API

前端是 Vite 构建的 React 单页应用，作为静态文件放在 S3；后端是 Lambda 上的 Hono JSON API，前面是 API Gateway HTTP API。两者在同一个 CloudFront 域名下，`/api/*` 转给 API，cookie 都是第一方的。这样流量小的时候费用接近零，店主要维护的服务器为零；前后端都是 TypeScript，前端通过 Hono RPC 直接使用 API 路由的类型（`@yi/api` 只导出类型，前端只做 `import type`），不手写重复的类型，也不做代码生成。

单页应用的 HTML 没有页面内容，而聊天软件和社交网站抓取链接预览时不执行 JavaScript，所以首页、类别页、商品页的 HTML 请求由 API 的 Lambda 处理：读取构建出的 HTML 外壳，写入该页的 title、description、canonical、OG 标签和结构化数据再返回，页面内容仍由 React 在浏览器里渲染。

## Considered Options

- **SSR 框架（Next.js、React Router 框架模式等）**：能直接输出带 meta 的 HTML，但在 Lambda 上运行和部署更复杂，冷启动和费用更高。本站只有三类页面需要 meta，由 API 注入就够了。
- **Lambda 函数 URL 加 CloudFront Origin Access Control，代替 API Gateway**：OAC 要求客户端为 POST 请求体计算签名头，Stripe 的 webhook 做不到。
