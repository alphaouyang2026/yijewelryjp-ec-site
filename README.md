# yijewelryjp-ec-site

Y&I Jewelry 的线上销售网站。规格见 issue #1。

## 仓库结构

npm workspaces 的 monorepo：

| 包 | 目录 | 内容 |
| --- | --- | --- |
| `@yi/api` | `packages/api` | Hono JSON API。本地用 Node.js 运行，部署时作为 Lambda 处理 API Gateway HTTP API 的请求（`src/lambda.ts`）。 |
| `@yi/web` | `packages/web` | React 单页应用（Vite、React Router）。通过 Hono RPC 客户端调用 API，只从 `@yi/api` 导入类型。 |

设计 token（颜色、字体、间距）集中在 `packages/web/src/styles/tokens.css`，组件样式用 CSS Modules。

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

浏览器打开 http://localhost:5173 。按 Ctrl+C 停止全部进程（包括 DynamoDB Local 容器）。

## 运行测试

API 测试需要 DynamoDB Local 在运行（每个测试文件自动新建一张表，结束后删除）：

```sh
npm run db:start   # 在后台启动 DynamoDB Local
npm test           # API 测试 + 前端测试
npm run db:stop    # 停止并删除容器
```

也可以分开运行：`npm run test:api`、`npm run test:web`。前端测试不需要 DynamoDB Local。

### 两层测试

- **API（`packages/api/test`）：** 用测试适配器构建 API，在进程内通过 Hono 的 request 接口发请求。`useTestApi()` 提供会保存 cookie 的客户端（`api.client()`，类型来自 API 路由）和可以控制的时钟（`api.clock`）。
- **前端（`packages/web/src/**/*.test.tsx`）：** 用 React Testing Library 渲染真实的路由表（`renderRoute('/')`），用 MSW 在网络层拦截 `/api`。模拟响应用 `test/api-mocks.ts` 里按 API 类型编写的 handler。

## 其他命令

| 命令 | 作用 |
| --- | --- |
| `npm run typecheck` | 类型检查（`tsc --build`，前端使用 API 的类型声明） |
| `npm run lint` | ESLint |
| `npm run build` | 构建前端，产物在 `packages/web/dist` |

## 环境变量

| 变量 | 用途 | 默认值 |
| --- | --- | --- |
| `DYNAMODB_ENDPOINT` | 本地开发和测试连接的 DynamoDB Local | `http://localhost:8100` |
| `TABLE_NAME` | DynamoDB 表名（Lambda 必须设置） | 本地开发为 `yijewelry-local` |

## CI

`.github/workflows/ci.yml`：每个 pull request 运行类型检查、lint、API 测试（DynamoDB Local 作为 service container）、前端测试和前端构建。
