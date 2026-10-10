// Fills the local DynamoDB table with sample categories and products, for
// local development only (`npm run db:seed`, with DynamoDB Local running).
// Every sample is written with the same layout the API reads; running it again
// overwrites them. The admin (a later ticket) will replace this for real data.
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { CategoryItem } from '../src/catalog/infrastructure/dynamodb-category-repository';
import type { ProductItem, VariantItem } from '../src/catalog/infrastructure/dynamodb-product-repository';
import { createTable, localDynamoClient, waitForDynamoDbLocal } from '../src/platform/dynamodb-local';

// The table `npm run dev` uses (src/local.ts).
const tableName = process.env.TABLE_NAME ?? 'yijewelry-local';

const categories: CategoryItem[] = [
  { pk: 'CATEGORY', sk: 'rings', position: 1, name: { ja: 'リング', zh: '戒指', en: 'Rings' } },
  { pk: 'CATEGORY', sk: 'necklaces', position: 2, name: { ja: 'ネックレス', zh: '项链', en: 'Necklaces' } },
  { pk: 'CATEGORY', sk: 'earrings', position: 3, name: { ja: 'ピアス・イヤリング', zh: '耳饰', en: 'Earrings' } },
  { pk: 'CATEGORY', sk: 'bracelets', position: 4, name: { ja: 'ブレスレット', zh: '手链', en: 'Bracelets' } },
];

const ringSizes = (priceYen: number, stock: number[]): VariantItem[] =>
  [7, 9, 11, 13].map((size, index) => ({
    sku: `${size}`,
    label: { ja: `${size}号`, zh: `${size}号`, en: `Size ${size}` },
    priceYen: size >= 11 ? priceYen + 1_000 : priceYen,
    onHandStock: stock[index] ?? 0,
    reservedStock: 0,
  }));

const oneSize = (priceYen: number, onHandStock: number, label = { ja: 'フリー', zh: '均码', en: 'One size' }): VariantItem[] => [
  { sku: 'one', label, priceYen, onHandStock, reservedStock: 0 },
];

const sample = (text: { ja: string; zh: string; en: string }) => ({
  ja: `【サンプル】${text.ja}`,
  zh: `【示例】${text.zh}`,
  en: `[Sample] ${text.en}`,
});

const product = (
  slug: string,
  listedAt: string | undefined,
  fields: Omit<ProductItem, 'pk' | 'sk' | 'listedAt'>,
): ProductItem => ({ pk: 'PRODUCT', sk: slug, listedAt, ...fields });

const products: ProductItem[] = [
  product('crescent-ring', '2026-09-20T10:00:00+09:00', {
    status: 'listed',
    featured: true,
    categorySlug: 'rings',
    name: { ja: '三日月のリング', zh: '新月戒指', en: 'Crescent Ring' },
    description: sample({
      ja: '細い三日月をかたどった、重ね付けしやすいリングです。',
      zh: '以纤细新月为造型，适合叠戴的戒指。',
      en: 'A slim crescent-moon ring made for stacking.',
    }),
    materials: { ja: 'K18イエローゴールド', zh: '18K黄金', en: '18K yellow gold' },
    dimensions: { ja: '幅 約2mm', zh: '宽 约2mm', en: 'About 2 mm wide' },
    weight: { ja: '約1.6g', zh: '约1.6g', en: 'About 1.6 g' },
    care: { ja: '着用後は柔らかい布で拭いてください。', zh: '佩戴后请用软布擦拭。', en: 'Wipe with a soft cloth after wearing.' },
    variants: ringSizes(24_000, [3, 2, 1, 0]),
  }),
  product('starlight-necklace', '2026-09-18T10:00:00+09:00', {
    status: 'listed',
    featured: false,
    categorySlug: 'necklaces',
    name: { ja: '星明かりのネックレス', zh: '星光项链', en: 'Starlight Necklace' },
    description: sample({ ja: '小さな星が胸元で光ります。', zh: '小星星在颈间闪耀。', en: 'A small star that catches the light.' }),
    materials: { ja: 'K10ホワイトゴールド、ダイヤモンド', zh: '10K白金、钻石', en: '10K white gold, diamond' },
    dimensions: { ja: 'チェーン 40cm（アジャスター付き）', zh: '链长 40cm（可调节）', en: '40 cm chain with adjuster' },
    variants: oneSize(32_000, 2),
  }),
  product('pearl-drop-earrings', '2026-09-15T10:00:00+09:00', {
    status: 'listed',
    featured: false,
    categorySlug: 'earrings',
    name: { ja: 'パールドロップピアス', zh: '珍珠垂坠耳钉', en: 'Pearl Drop Earrings' },
    description: sample({ ja: '揺れるパールが上品なピアス。', zh: '摇曳的珍珠，优雅大方。', en: 'Swaying pearls with a quiet elegance.' }),
    materials: { ja: 'あこや真珠、K18', zh: 'Akoya珍珠、18K金', en: 'Akoya pearl, 18K gold' },
    variants: oneSize(28_000, 0),
  }),
  product('twist-bangle', '2026-09-10T10:00:00+09:00', {
    status: 'listed',
    featured: false,
    categorySlug: 'bracelets',
    name: { ja: 'ツイストバングル', zh: '扭纹手镯', en: 'Twist Bangle' },
    description: sample({ ja: 'ねじりのラインが美しいバングル。', zh: '扭纹线条优美的手镯。', en: 'A bangle with a graceful twist.' }),
    materials: { ja: 'シルバー925', zh: '925银', en: 'Sterling silver' },
    variants: [
      { sku: 's', label: { ja: 'S', zh: 'S', en: 'S' }, priceYen: 15_000, onHandStock: 4, reservedStock: 0 },
      { sku: 'm', label: { ja: 'M', zh: 'M', en: 'M' }, priceYen: 16_000, onHandStock: 5, reservedStock: 0 },
    ],
  }),
  product('mini-hoop-earrings', '2026-09-05T10:00:00+09:00', {
    status: 'listed',
    featured: false,
    categorySlug: 'earrings',
    name: { ja: 'ミニフープピアス', zh: '迷你圈形耳环', en: 'Mini Hoop Earrings' },
    description: sample({ ja: '毎日つけたい小さなフープ。', zh: '适合日常佩戴的小圈耳环。', en: 'Small hoops for every day.' }),
    variants: oneSize(9_800, 12),
  }),
  product('signet-ring', '2026-08-28T10:00:00+09:00', {
    status: 'listed',
    featured: false,
    categorySlug: 'rings',
    name: { ja: 'シグネットリング', zh: '印章戒指', en: 'Signet Ring' },
    description: sample({ ja: '刻印もできる存在感のあるリング。', zh: '可刻字、存在感十足的戒指。', en: 'A bold ring with room for engraving.' }),
    variants: ringSizes(38_000, [1, 1, 0, 0]),
  }),
  product('draft-brooch', undefined, {
    status: 'draft',
    featured: false,
    name: { ja: '準備中のブローチ', zh: '筹备中的胸针', en: 'Brooch in preparation' },
    description: sample({ ja: '下書きの商品（表示されません）。', zh: '草稿商品（不显示）。', en: 'A draft (never shown).' }),
    variants: oneSize(20_000, 1),
  }),
  product('retired-chain', '2025-12-01T10:00:00+09:00', {
    status: 'archived',
    featured: false,
    categorySlug: 'necklaces',
    name: { ja: '販売終了のチェーン', zh: '已停售的链子', en: 'Retired Chain' },
    description: sample({ ja: 'アーカイブ済みの商品（表示されません）。', zh: '已归档商品（不显示）。', en: 'Archived (never shown).' }),
    variants: oneSize(12_000, 3),
  }),
];

const client = localDynamoClient();
try {
  await waitForDynamoDbLocal();
  const db = { client, tableName };
  await createTable(db);
  const documents = DynamoDBDocumentClient.from(client);
  for (const item of [...categories, ...products]) {
    await documents.send(new PutCommand({ TableName: tableName, Item: item }));
  }
  console.log(`Seeded ${categories.length} categories and ${products.length} products into ${tableName}.`);
} finally {
  client.destroy();
}
