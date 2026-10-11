# 商品照片：浏览器用预签名 POST 直传 S3，key 不变

店主的浏览器把照片直接上传到网站的存储桶，不经过 API：API 只为每张照片签发一个 S3 预签名 POST，策略限定 key、内容类型（JPEG、PNG、WebP）、大小（1 字节到 5 MB）和 `Cache-Control`（一年，immutable）。Lambda 的请求体有大小上限，照片也不该占用 API 的时间；而签名是 Lambda 用自己的凭证在本地计算的，不请求 S3，所以没有放在测试替身后面：测试用生产适配器（随便的凭证、不存在的存储桶），检查签出的策略。API 先按浏览器报告的类型和大小拒绝不合格的照片，让店主马上看到原因；真正的限制由 S3 按策略执行。

每张照片的 key 是 `images/products/<随机 UUID>.<扩展名>`，从不重复使用，所以照片可以被 CloudFront 和浏览器缓存一年，换照片就是换 key。商品 item 保存有序的 key 和替代文字（见 ADR 0005）。保存商品时 API 只检查 key 是这种格式，不去 S3 确认文件存在：前端只在上传成功后才把照片放进表单，而多一次 `HeadObject` 会让保存依赖 S3。从商品中移除的照片和上传后没有保存的照片不删除，和旧的哈希资源一样留在存储桶里；数量很少，费用可以忽略。

## Consequences

- 存储桶允许来自网站的跨域 POST。没有自定义域名时，网站的来源是 CloudFront 分配的默认域名，而分配依赖存储桶，存储桶的 CORS 不能引用它，所以允许任何 `https://*.cloudfront.net`。CORS 不是这里的安全边界：没有 API 签发的策略，S3 不接受上传。
- Lambda 只有 `images/products/*` 的写权限。
- 本地开发没有 S3。MinIO 的官方镜像已经无法拉取，所以 API 的本地服务器自己代替照片存储桶（`src/local-photo-bucket.ts`，只有 `local.ts` 加载）：接受同样的预签名 POST，像 S3 一样检查签名、有效期和策略条件，照片保存在内存里并在 `/images/*` 下提供。上传表单仍由生产适配器签发，只是端点指向这个替身。

## Considered Options

- **照片经 API 上传（multipart 发给 Lambda）**：API Gateway 和 Lambda 的请求体上限（6 MB 以内，还要 base64）离 5 MB 太近，且每次上传都占用 Lambda。
- **预签名 PUT**：PUT 的签名不能限制文件大小，5 MB 的上限只能靠前端，不可靠。
- **上传后由 Lambda 缩放或转换格式**：规格把图片自动缩放和格式转换排除在范围外。
