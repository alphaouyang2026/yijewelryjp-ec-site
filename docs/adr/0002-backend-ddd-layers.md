# 后端按 DDD 分层

API 按限界上下文组织：商品目录（`catalog`）、订单（`ordering`）、店铺（`store`）、店主身份（`identity`），共享内核（`shared-kernel`）放金额、语言、多语言文本和时钟。每个上下文分四层：领域层（实体、值对象、仓储接口）、应用层（每个用户操作一个用例）、基础设施层（DynamoDB 仓储、Stripe/SES/Cognito 适配器）、接口层（Hono 路由、Zod 校验）。依赖方向是接口层 → 应用层 → 领域层，基础设施层实现领域层定义的接口；上下文之间只通过对方应用层公开的用例或查询交互。业务规则（价格、运费、库存锁定、订单状态、权限）全在 API，这样分层能让它们不依赖 Hono、DynamoDB 和外部服务，换框架或服务时不碰业务规则，读代码时也能按术语（见 `CONTEXT.md`）找到它在哪一层。

这些规则用 ESLint 内置的 `no-restricted-imports` 检查：`eslint.config.js` 按"上下文 × 层"生成规则，不另装插件。

## Consequences

- 入口（`src/local.ts`、`src/lambda.ts`）负责组装：选择适配器（DynamoDB 仓储、时钟，以后还有 Stripe、SES、Cognito），通过 `createApp` 注入应用层。API 测试用同样的方式注入，只是换成测试时钟和每个测试文件一张的 DynamoDB Local 表。
- 仓储只有 DynamoDB 一种实现，测试也用它跑在 DynamoDB Local 上，不写内存版仓储。只有我们无法控制的外部服务（Payments、Mailer、AdminIdentity、Clock）有测试替身。
- 领域层和应用层不单独设测试接缝，都通过 API 的 HTTP 接口测试。
- 健康检查不属于任何上下文，放在 `operations` 模块，按同样的分层：表探测在基础设施层，接口层不调用 AWS SDK。各上下文共用的技术部件（单表定义）放在 `platform`，只给基础设施层使用；各上下文的接口层共用的部件（`locale` 查询参数的 Zod 校验）放在 `interface`，它本身也属于接口层。
- 下单时既要创建订单（订单）又要锁定库存（商品目录），跨两个上下文；这由应用层的事务单元（Unit of Work）在一个 DynamoDB 事务里一起提交，而不是让一个上下文直接写另一个上下文的数据。
