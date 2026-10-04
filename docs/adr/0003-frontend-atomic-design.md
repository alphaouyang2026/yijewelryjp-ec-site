# 前端按 Atomic Design 组织组件

`packages/web/src/components` 分五层：atoms（Logo、Icon、Label、LocalizedLink 等最小元素）、molecules（NavLinkList、SectionHeading、LanguageSwitcher 等小单元）、organisms（AnnouncementBar、SiteHeader、SiteFooter 等完整区块）、templates（StoreLayout 等只管布局的骨架）、pages（路由对应的页面）。同一套组件要在前台、后台和不同页面之间复用，分层让"在哪里取数据、在哪里放文字、在哪里定外观"都有固定答案：

- 依赖只能向下：低层不能引用高层。
- 只有 pages 调用 API（React Router 的 loader 加 Hono RPC），其他层只通过 props 拿数据，可以使用 API 的类型。
- 原子不包含固定文字，文字从 props 传入；分子和有机体里的固定界面文字在组件内从翻译资源取。按钮、价格、标签的外观在原子层定死，上层只负责排版和间距（原子接受的 `className` 只用于这个）。
- 站内链接一律用 `LocalizedLink` 原子，保证链接带着当前语言。
- 路径、API 客户端、品牌常量、多语言资源等非界面代码放在 `components` 之外。

这些规则用 ESLint 检查：每层的导入限制、原子里的固定 JSX 文字，以及组件直接使用 React Router 的 `Link`。测试仍只在页面层（React Testing Library 加 MSW），不给单个组件写测试或快照，组件可以随意重组。

## Considered Options

- **按功能分目录（feature folders）**：起步更简单，但前台和后台共用的按钮、价格、库存标签会散落或重复，取数据的位置也没有约束。
