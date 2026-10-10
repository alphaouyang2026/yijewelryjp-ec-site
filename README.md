# yijewelryjp-ec-site

Y&I Jewelry 的线上销售网站。规格见 issue #1，统一语言见 [`CONTEXT.md`](CONTEXT.md)，架构决策见 [`docs/adr/`](docs/adr/)。

## 仓库结构

npm workspaces 的 monorepo：

| 包 | 目录 | 内容 |
| --- | --- | --- |
| `@yi/api` | `packages/api` | Hono JSON API。本地用 Node.js 运行，部署时作为 Lambda 处理 API Gateway HTTP API 的请求（`src/lambda.ts`）。 |
| `@yi/web` | `packages/web` | React 单页应用（Vite、React Router）。通过 Hono RPC 客户端调用 API，只从 `@yi/api` 导入类型。 |
| `@yi/infra` | `packages/infra` | AWS CDK（TypeScript）：DynamoDB、S3、Lambda、API Gateway HTTP API、CloudFront、店主登录用的 Cognito 用户池和 Secrets Manager，以及部署用的 GitHub OIDC 角色。见下面的"部署（AWS）"。 |

### API：DDD 分层（[ADR 0002](docs/adr/0002-backend-ddd-layers.md)）

```
packages/api/src/
├── shared-kernel/    共享内核：金额（Money）、语言（Locale）、多语言文本（LocalizedText）、时钟（Clock）
├── interface/        各上下文接口层共用的部件：locale 查询参数的 Zod 校验
├── catalog/          商品目录 ┐
├── ordering/         订单     │ 限界上下文，各有四层：
├── store/            店铺     │   domain/ application/ infrastructure/ interface/
├── identity/         店主身份 ┘
├── operations/       健康检查（不是上下文，按同样的方式分层）
├── platform/         基础设施层用的技术部件：DynamoDB 单表、读取 Secrets Manager；dynamodb-local.ts 只供本地开发和测试使用
├── app.ts            createApp：把注入的适配器交给各用例，挂上各模块的路由
├── dynamodb-adapters.ts  DynamoDB 上的仓储和表探测
├── local.ts          本地入口（Node.js + DynamoDB Local，店主登录用开发用身份，见"后台登录"）
├── lambda.ts         Lambda 入口（启动时从 Secrets Manager 读取机密，店主登录用 Cognito）
└── index.ts          前端唯一能导入的模块，只导出类型
```

分层规则（`npm run lint` 检查）：

- 依赖方向：接口层 → 应用层 → 领域层；基础设施层实现领域层定义的接口。
- 领域层和应用层不使用 Hono、Zod、AWS SDK 和 `platform`；Hono 路由和 Zod 校验只在接口层（包括共用的 `interface`），AWS SDK 调用和 `platform` 只在基础设施层。
- 上下文之间只通过对方的应用层交互；共享内核、`interface` 和 `platform` 不引用任何上下文。
- 入口负责组装：选择适配器（DynamoDB 仓储、时钟、AdminIdentity），通过 `createApp` 注入应用层。测试用同样的方式注入。
- 开发用的模块（`platform/dynamodb-local.ts`、`identity/infrastructure/dev-admin-identity.ts`）只有 `local.ts` 能导入（测试也可以用 DynamoDB Local），生产代码不会加载。
- 所有后台 API 都挂在 `app.ts` 里的同一个路由组下，由店主会话守卫（`identity/interface/owner-only.ts`）统一检查，见"后台登录"。

### 前端：Atomic Design（[ADR 0003](docs/adr/0003-frontend-atomic-design.md)）

```
packages/web/src/
├── components/
│   ├── atoms/        Logo、Icon、Label、LocalizedLink、Button
│   ├── molecules/    NavLinkList、SectionHeading、LocaleSwitcher
│   ├── organisms/    AnnouncementBar、SiteHeader、SiteFooter、AdminHeader、AdminNav
│   ├── templates/    StoreLayout、AdminLayout
│   └── pages/        路由对应的页面，及其 loader 和测试
├── app/              路由表（每种语言一棵）和每种语言的根路由
├── i18n/             语言、语言前缀的路径、三种语言的翻译资源、按语言加载的字体
├── api.ts            Hono RPC 客户端和由 API 推出的响应类型
├── paths.ts          页面路径（`PagePath` 类型，不带语言前缀）
├── brand.ts          logo 和品牌名
├── browser.ts        离开 React 应用、转到它不处理的页面（如 API 的登录入口）
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

浏览器打开 http://localhost:5173/ （日语）、http://localhost:5173/zh/ 或 http://localhost:5173/en/ 。后台在 http://localhost:5173/admin （本地登录见"后台登录"）。按 Ctrl+C 停止全部进程（包括 DynamoDB Local 容器）。

需要示例商品时，在 `npm run dev` 运行期间另开一个终端执行 `npm run db:seed`：写入 4 个类别和 8 件示例商品（含主推、多尺寸不同价格、库存紧张、售罄、草稿、归档）。DynamoDB Local 的数据只保存在内存里，容器停止后要重新执行。

## 运行测试

API 测试需要 DynamoDB Local 在运行（每个测试文件自动新建一张表，结束后删除）：

```sh
npm run db:start   # 在后台启动 DynamoDB Local
npm test           # API 测试 + 前端测试
npm run db:stop    # 停止并删除容器
```

也可以分开运行：`npm run test:api`、`npm run test:web`。前端测试不需要 DynamoDB Local。

### 两层测试

- **API（`packages/api/test`）：** 像入口一样组装 API，只是换成测试适配器，在进程内通过 Hono 的 request 接口发请求。`useTestApi()` 提供会保存 cookie 的客户端（`api.client()`，类型来自 API 路由）、可以控制的时钟（`api.clock`）、内存版的身份提供方（`api.identity`）和让客户端以店主身份登录的 `api.signIn(client)`、列出全部路由的 `api.routes`（逐一检查后台路由的测试用它），以及在 API 还不能创建数据时直接写入种子数据的 `api.seed`（结果仍然只通过 API 检查）。
- **前端（`packages/web/src/**/*.test.tsx`）：** 用 React Testing Library 渲染真实的路由表（`renderRoute('/zh/')`），用 user-event 像用户那样操作，用 MSW 在网络层拦截 `/api`。模拟响应用 `test/api-mocks.ts` 里按 API 类型编写的 handler。页面让浏览器离开 React 应用时（如去登录），测试监视 `browser.leaveFor` 看它去哪里（jsdom 不能真的跳转）。

不给单个组件、领域对象或用例写单元测试：业务规则通过 API 的 HTTP 接口测试，界面行为通过页面测试。

## 后台登录

店主在后台（`/admin`、`/zh/admin`、`/en/admin`）用 Cognito 托管登录页登录：邮箱、密码，加上验证器应用（Google Authenticator、1Password 等）里的 TOTP 一次性验证码。

### 流程

1. 进入后台页面时，前端向 `GET /api/admin/session` 查询会话。未登录（401）时，浏览器转到 API 的 `GET /api/admin/auth/sign-in?locale=…&returnTo=…`。
2. API 生成随机的 `state`，和要返回的后台页面一起存进一个签名 cookie（10 分钟有效），再把浏览器转到 Cognito 托管登录页（授权码流程，页面语言跟后台一致）。
3. 登录后 Cognito 把浏览器带回 `GET /api/admin/auth/callback?code=…&state=…`。API 核对 `state`，用授权码和应用客户端密钥向 Cognito 换取令牌，按用户池的 JWKS 验证 ID 令牌，然后发放会话 cookie 并跳回原来的后台页面。令牌只在 API 里用这一次，不保存，也不交给浏览器。
4. 会话 cookie（`__Host-yi_admin_session`）是 HTTP-only、Secure、SameSite=Lax 的签名 cookie。API 的签名 cookie 都由 `packages/api/src/interface/signed-cookies.ts` 读写：每个 cookie 用自己的密钥签名（由 Secrets Manager 里的签名密钥和 cookie 名派生），所以一个 cookie 的值不能冒充另一个 cookie；读取时还用 Zod 检查内容，不符合的当作没有 cookie。每次后台请求都把闲置时间重新算起，闲置 2 小时后过期；无论是否一直在用，登录 12 小时后也会过期，需要重新登录。API 只在登录时向 Cognito 确认店主身份，这个上限保证停用的店主不会一直保持登录。
5. 登出（`POST /api/admin/sign-out`）清除会话 cookie，再把浏览器转到 Cognito 的登出页，结束 Cognito 自己的登录状态（否则一小时内再登录不用输密码），最后回到当前语言的网站首页。

### 权限检查

- 所有后台 API 都在同一个路由组里，由一个中间件（`packages/api/src/identity/interface/owner-only.ts`）检查：没有有效会话时返回 401。只有登录本身的 `/api/admin/auth/*` 在这个组外面。
- 修改数据的后台 API（GET、HEAD、OPTIONS 以外的方法）还要求 `X-CSRF-Token` 请求头等于会话的 CSRF 令牌，否则返回 403。前端从 `GET /api/admin/session` 拿到令牌。
- `packages/api/test/admin-routes.test.ts` 遍历路由表中的所有后台路由来验证这两条规则，以后新增的后台路由会被自动检查。

### 本地登录后台

本地开发不连接 Cognito：`npm run dev` 的 API（`src/local.ts`）使用开发用身份（`dev-admin-identity.ts`），打开 http://localhost:5173/admin 时会立即以 `owner@localhost`（可用 `DEV_OWNER_EMAIL` 修改）登录，不需要密码。除了"向 Cognito 换取身份"这一步，`state` 校验、会话 cookie、闲置过期、CSRF 都是生产代码。登出后回到首页。开发用身份只能由 `local.ts` 加载（ESLint 检查），Lambda 不会用到它。

会话 cookie 是 Secure 的；Chrome 和 Firefox 把 `http://localhost` 当作安全来源，会保存它。Safari 不会，所以本地请用 Chrome 或 Firefox 登录后台。

### 创建店主账号

用户池不开放自助注册，店主账号由有 AWS 管理员权限的人手动创建。每个阶段（staging、production）各有一个用户池，部署输出里的 `OwnerUserPoolId` 就是它的 ID：

```sh
aws cloudformation describe-stacks --stack-name YiJewelry-staging \
  --query "Stacks[0].Outputs[?OutputKey=='OwnerUserPoolId'].OutputValue" --output text
```

**AWS CLI：**

```sh
aws cognito-idp admin-create-user \
  --user-pool-id <OwnerUserPoolId> \
  --username owner@example.com \
  --user-attributes Name=email,Value=owner@example.com Name=email_verified,Value=true \
  --desired-delivery-mediums EMAIL
```

**控制台：** Amazon Cognito → 用户池（东京区域）→ 选择该用户池 → 用户 → 创建用户：选择"发送电子邮件邀请"，填写邮箱，勾选"将电子邮件地址标记为已验证"，让 Cognito 生成临时密码。

Cognito 会给这个邮箱发送临时密码（3 天内有效）。第一次登录时（部署输出的 `AdminUrl`）：输入邮箱和临时密码 → 设置新密码（至少 12 位，含大小写字母、数字和符号）→ 用验证器应用扫描二维码，输入一次性验证码完成 TOTP 设置。以后每次登录都需要密码和验证码。

- **停用或删除店主：** `aws cognito-idp admin-disable-user`（或 `admin-delete-user`）`--user-pool-id <OwnerUserPoolId> --username <邮箱>`。已经登录的会话不会立即失效：最多再保持 12 小时（从登录算起），闲置 2 小时也会过期。
- **换了手机、无法提供验证码：** 删除该用户后重新创建，第一次登录时重新设置 TOTP。

## 其他命令

| 命令 | 作用 |
| --- | --- |
| `npm run typecheck` | 类型检查（`tsc --build`，前端使用 API 的类型声明） |
| `npm run lint` | ESLint，包括上面的分层规则 |
| `npm run build` | 构建前端，产物在 `packages/web/dist` |
| `npm run synth -w @yi/infra -- -c stage=staging` | 合成 CloudFormation 模板（需要先 `npm run build`；不需要 AWS 凭证） |

## 环境变量

| 变量 | 用途 | 默认值 |
| --- | --- | --- |
| `DYNAMODB_ENDPOINT` | 本地开发和测试连接的 DynamoDB Local | `http://localhost:8100` |
| `TABLE_NAME` | DynamoDB 表名（Lambda 必须设置） | 本地开发为 `yijewelry-local` |
| `SESSION_SECRET` | 本地开发时签名后台会话 cookie 的密钥 | 固定的开发用值 |
| `DEV_OWNER_EMAIL` | 本地开发时以哪个邮箱登录后台 | `owner@localhost` |

Lambda 另外需要 `SITE_URL`、`COGNITO_DOMAIN_URL`、`COGNITO_USER_POOL_ID`、`COGNITO_CLIENT_ID`、`COGNITO_CLIENT_SECRET_ARN`、`SESSION_SECRET_ARN`，都由 CDK 设置（`packages/infra/lib/shop-stack.ts`）。

## CI

`.github/workflows/ci.yml`：每个 pull request 运行类型检查、lint、API 测试（DynamoDB Local 作为 service container）、前端测试、前端构建，以及 `cdk synth`（staging、production、带自定义域名的 production、部署权限栈）。

## 部署（AWS）

### 架构

每个阶段（`staging`、`production`）是一个 CloudFormation 栈 `YiJewelry-<stage>`，部署在东京（ap-northeast-1）：

```text
CloudFront（一个域名）
├── /api/*      → API Gateway HTTP API → Lambda（packages/api，Node.js 24，arm64）→ DynamoDB 单表（按需、PITR）
│                                                  ├→ Secrets Manager（Cognito 应用客户端密钥、会话 cookie 签名密钥，启动时读取）
│                                                  └→ Cognito 用户池（店主登录：托管登录页、令牌端点）
├── /assets/*   → S3（Vite 带哈希的文件，缓存一年）
├── /images/*   → S3（商品图片）
└── 其他路径     → S3 的 index.html（React 的 HTML 外壳，no-cache；由前端路由处理）
```

- **API 的缓存：** CloudFront 只按 API 返回的 `Cache-Control` 缓存（`packages/api/src/interface/cache-control.ts`）：公开的目录数据约 60 秒，过期后先返回旧内容再刷新；其他所有响应都是 `no-store`。
- **前端上传：** 部署时先上传带哈希的文件，再上传 `index.html` 并使 CloudFront 上的旧版本失效，所以新版本立即生效。旧的哈希文件和商品图片不会被删除。
- **两个阶段的区别：** 同一套代码，资源名由 CDK 自动生成，互不冲突。production 的表和存储桶在删除栈时保留，表开启删除保护；staging 的会一起删除。
- **店主登录（Cognito）：** 每个阶段一个用户池：不开放自助注册，用邮箱登录，强制 TOTP MFA，Essentials 功能计划（托管登录页和多语言页面需要它；每月 10,000 名活跃用户以内免费）。托管登录域名是 `yijewelry-<阶段>-<账号ID>.auth.ap-northeast-1.amazoncognito.com`。API 是使用授权码流程的机密应用客户端，回调 URL 是网站域名下的 `/api/admin/auth/callback`，登出后回到网站的 `/`、`/zh/`、`/en/`。应用客户端密钥由 CDK 复制到 Secrets Manager，会话签名密钥由 CDK 生成；Lambda 只能读取这两个机密，不需要任何 Cognito 权限。production 的用户池在删除栈时保留并开启删除保护。没有自定义域名时，这些 URL 使用 CloudFront 的默认域名，CloudFormation 在创建分配后再创建应用客户端。
- **自定义域名（可选）：** 设置了 `DOMAIN_NAME`、`HOSTED_ZONE_ID`、`HOSTED_ZONE_NAME` 时，会在 us-east-1 多部署一个证书栈 `YiJewelryCertificate-<stage>`，并在 Route 53 加上 A / AAAA 别名记录。不设置时使用 CloudFront 的默认域名（`*.cloudfront.net`）。

### 一次性准备（店主）

以下步骤需要 AWS 账号的管理员凭证，在本地执行一次（对应 #3）。

1. **CDK bootstrap**（两个区域都要）：

   ```sh
   npx -w @yi/infra cdk bootstrap aws://<账号ID>/ap-northeast-1 aws://<账号ID>/us-east-1
   ```

2. **部署权限栈**（GitHub OIDC 提供方和部署角色）：

   ```sh
   npm run build
   npx -w @yi/infra cdk deploy YiJewelryDeployAccess -c deployAccess=true
   ```

   如果账号里已经有 GitHub 的 OIDC 提供方，加上 `-c githubOidcProviderArn=<它的 ARN>`。部署完成后，输出里的 `DeployRoleArn` 就是下面要用的角色 ARN。这个角色只能被本仓库的 `staging`、`production` 环境使用，并且只能转而使用 CDK bootstrap 创建的角色。

   角色按 OIDC 令牌的主体（`sub`）识别本仓库。本仓库使用 GitHub 的不可变主体格式，带用户和仓库的数字 ID（`repo:alphaouyang2026@315845291/yijewelryjp-ec-site@1403220842`），这样仓库被删除后即使有人用同名重建，也无法冒用。这个前缀写在 `packages/infra/bin/app.ts`，可以用 `gh api repos/<owner>/<repo>/actions/oidc/customization/sub` 的 `sub_claim_prefix` 确认，也可以用 `-c githubSubjectPrefix=<前缀>` 覆盖。

3. **GitHub 设置**（仓库的 Settings）：
   - **Environments：** 创建 `staging` 和 `production`。给 `production` 设置 Required reviewers，部署前需要人工批准。
   - **每个环境的 Variables：**

     | 变量 | 内容 |
     | --- | --- |
     | `AWS_DEPLOY_ROLE_ARN` | 第 2 步输出的 `DeployRoleArn` |
     | `DOMAIN_NAME` | 可选。网站的域名，如 `staging.example.com`、`example.com` |
     | `HOSTED_ZONE_ID` | 可选。该域名所在的 Route 53 托管区 ID |
     | `HOSTED_ZONE_NAME` | 可选。托管区的名称，如 `example.com` |
     | `REDIRECT_DOMAIN_NAMES` | 可选。永久跳转（301）到 `DOMAIN_NAME` 的其他域名，多个用逗号分隔，如 `www.example.com`。必须在同一个托管区里；证书和 Route 53 记录会自动加上，路径和查询字符串保持不变 |

     前三个域名变量要么都设置，要么都不设置；`REDIRECT_DOMAIN_NAMES` 需要它们都已设置。
   - **仓库级别的 Variable：** `DEPLOY_ENABLED` = `true`。在设置之前，部署 workflow 会直接跳过。

### 自动部署

`.github/workflows/deploy.yml`：合并到 `main` 后部署 staging；staging 成功后，production 的部署会等待 `production` 环境的审批。也可以在 Actions 页面手动运行（workflow_dispatch）。部署只通过 OIDC 换取的临时凭证访问 AWS，GitHub 里不保存长期密钥。

### 手动部署

本地有 AWS 凭证时：

```sh
npm run build
npm run diff -w @yi/infra -- -c stage=staging     # 查看变更
npm run deploy -w @yi/infra -- -c stage=staging   # 部署（证书栈也一起部署）
```

使用自定义域名时，先设置 `DOMAIN_NAME`、`HOSTED_ZONE_ID`、`HOSTED_ZONE_NAME` 这三个环境变量。部署完成后，输出里的 `SiteUrl` 就是网站地址，`AdminUrl` 是后台地址。第一次部署某个阶段后，按"后台登录 → 创建店主账号"创建店主账号。
