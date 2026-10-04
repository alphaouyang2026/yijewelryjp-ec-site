# yijewelryjp-ec-site

Y&I Jewelry 的线上销售网站。规格见 issue #1，统一语言见 [`CONTEXT.md`](CONTEXT.md)，架构决策见 [`docs/adr/`](docs/adr/)。

## 仓库结构

npm workspaces 的 monorepo：

| 包 | 目录 | 内容 |
| --- | --- | --- |
| `@yi/api` | `packages/api` | Hono JSON API。本地用 Node.js 运行，部署时作为 Lambda 处理 API Gateway HTTP API 的请求（`src/lambda.ts`）。 |
| `@yi/web` | `packages/web` | React 单页应用（Vite、React Router）。通过 Hono RPC 客户端调用 API，只从 `@yi/api` 导入类型。 |

### API：DDD 分层（[ADR 0002](docs/adr/0002-backend-ddd-layers.md)）

```
packages/api/src/
├── shared-kernel/    共享内核：金额（Money）、语言（Locale）、多语言文本（LocalizedText）、时钟（Clock）
├── catalog/          商品目录 ┐
├── ordering/         订单     │ 限界上下文，各有四层：
├── store/            店铺     │   domain/ application/ infrastructure/ interface/
├── identity/         店主身份 ┘
├── operations/       健康检查（不是上下文，按同样的方式分层）
├── platform/         技术部件：DynamoDB 单表、locale 查询参数的校验；dynamodb-local.ts 只供本地开发和测试使用
├── app.ts            createApp：把注入的适配器交给各用例，挂上各模块的路由
├── dynamodb-adapters.ts  DynamoDB 上的仓储和表探测
├── local.ts          本地入口（Node.js + DynamoDB Local）
├── lambda.ts         Lambda 入口
└── index.ts          前端唯一能导入的模块，只导出类型
```

分层规则（`npm run lint` 检查）：

- 依赖方向：接口层 → 应用层 → 领域层；基础设施层实现领域层定义的接口。
- 领域层和应用层不使用 Hono、Zod、AWS SDK 和 `platform`；接口层不调用 AWS SDK。
- 上下文之间只通过对方的应用层交互；共享内核和 `platform` 不引用任何上下文。
- 入口负责组装：选择适配器（DynamoDB 仓储、时钟），通过 `createApp` 注入应用层。测试用同样的方式注入。

### 前端：Atomic Design（[ADR 0003](docs/adr/0003-frontend-atomic-design.md)）

```
packages/web/src/
├── components/
│   ├── atoms/        Logo、Icon、Label、LocalizedLink
│   ├── molecules/    NavLinkList、SectionHeading、LocaleSwitcher
│   ├── organisms/    AnnouncementBar、SiteHeader、SiteFooter
│   ├── templates/    StoreLayout
│   └── pages/        路由对应的页面，及其 loader 和测试
├── app/              路由表（每种语言一棵）和每种语言的根路由
├── i18n/             语言、语言前缀的路径、三种语言的翻译资源、按语言加载的字体
├── api.ts            Hono RPC 客户端和由 API 推出的响应类型
├── paths.ts          页面路径（`PagePath` 类型，不带语言前缀）
├── brand.ts          logo 和品牌名
├── styles/           tokens.css（设计 token）和 global.css
└── test/             测试工具和 MSW handler
```

分层规则（`npm run lint` 检查）：

- 依赖只能向下：atoms ← molecules ← organisms ← templates ← pages。
- 只有 pages 调用 API，而且通过 `api.ts` 建立的客户端；其他代码只通过 props 拿数据（可以使用 API 的类型），不导入 `hono/client`，也不手写 `/api` 的 URL。
- 原子不包含固定文字，也不用 `useMessages()`，文字从 props 传入；分子和有机体用 `useMessages()` 取界面文字。
- 站内链接一律用 `LocalizedLink`，不直接用 React Router 的 `Link`。
- 非界面代码（路径、API 客户端、品牌常量、多语言）放在 `components` 之外。

设计 token（颜色、字体、间距）集中在 `packages/web/src/styles/tokens.css`，组件样式用 CSS Modules，只使用 token。

### 多语言（[ADR 0004](docs/adr/0004-locale-in-url-path.md)）

- `/` 是日语（默认），`/zh/` 是简体中文，`/en/` 是英语，其他页面同样加前缀。语言只由 URL 决定。
- 界面文字在 `packages/web/src/i18n/messages/{ja,zh,en}.ts`。中文和英语资源的类型来自日语资源，键缺少或多出时类型检查失败。
- `<html lang>` 跟着语言变（`ja`、`zh-Hans`、`en`），字体按它切换；中文字体只在中文页面加载。
- API 返回多语言内容的接口要求 `locale` 查询参数（如 `/api/home?locale=zh`），缺少或不支持时返回 400。

## 准备

- Node.js 24（见 `.nvmrc`）和 npm 11
- Docker（用来运行 DynamoDB Local）

```sh
npm install
```

## 本地启动

```sh
npm run dev
```

这一条命令会同时启动：

- DynamoDB Local（Docker，`localhost:8100`，数据只在内存里，停止后清空）
- API（`http://127.0.0.1:8787`，修改代码后自动重启，启动时自动建表）
- 前端 Vite 开发服务器（`http://localhost:5173`），把 `/api` 的请求代理给 API

浏览器打开 http://localhost:5173/ （日语）、http://localhost:5173/zh/ 或 http://localhost:5173/en/ 。按 Ctrl+C 停止全部进程（包括 DynamoDB Local 容器）。

## 运行测试

API 测试需要 DynamoDB Local 在运行（每个测试文件自动新建一张表，结束后删除）：

```sh
npm run db:start   # 在后台启动 DynamoDB Local
npm test           # API 测试 + 前端测试
npm run db:stop    # 停止并删除容器
```

也可以分开运行：`npm run test:api`、`npm run test:web`。前端测试不需要 DynamoDB Local。

### 两层测试

- **API（`packages/api/test`）：** 像入口一样组装 API，只是换成测试适配器，在进程内通过 Hono 的 request 接口发请求。`useTestApi()` 提供会保存 cookie 的客户端（`api.client()`，类型来自 API 路由）和可以控制的时钟（`api.clock`）。
- **前端（`packages/web/src/**/*.test.tsx`）：** 用 React Testing Library 渲染真实的路由表（`renderRoute('/zh/')`），用 user-event 像用户那样操作，用 MSW 在网络层拦截 `/api`。模拟响应用 `test/api-mocks.ts` 里按 API 类型编写的 handler。

不给单个组件、领域对象或用例写单元测试：业务规则通过 API 的 HTTP 接口测试，界面行为通过页面测试。

## 其他命令

| 命令 | 作用 |
| --- | --- |
| `npm run typecheck` | 类型检查（`tsc --build`，前端使用 API 的类型声明） |
| `npm run lint` | ESLint，包括上面的分层规则 |
| `npm run build` | 构建前端，产物在 `packages/web/dist` |

## 环境变量

| 变量 | 用途 | 默认值 |
| --- | --- | --- |
| `DYNAMODB_ENDPOINT` | 本地开发和测试连接的 DynamoDB Local | `http://localhost:8100` |
| `TABLE_NAME` | DynamoDB 表名（Lambda 必须设置） | 本地开发为 `yijewelry-local` |

## CI

`.github/workflows/ci.yml`：每个 pull request 运行类型检查、lint、API 测试（DynamoDB Local 作为 service container）、前端测试和前端构建。
