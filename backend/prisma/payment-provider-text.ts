/**
 * Card payments moved from iyzico to Stripe: replaces the name in the live content (pages incl. the legal texts,
 * FAQ, journal, home sections) in every language. Turkish suffixes follow the new name (iyzico'ya → Stripe'a), and
 * the KVKK transfer line says Stripe is a provider based abroad.
 *   npm run text:stripe              show what would change (nothing is written)
 *   npm run text:stripe -- --apply   write it
 * The KVKK wording on transfers abroad still has to be approved by the shop owner / a lawyer.
 */
import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

/** Turkish forms first (apostrophe straight or curly), then the bare name in any language. */
const RULES: [RegExp, string][] = [
  [/ödeme kuruluşu iyzico(['’])ya \(ödeme\)/g, 'ödeme kuruluşu Stripe$1a (ödeme; yurt dışında yerleşik hizmet sağlayıcı)'],
  [/iyzico(['’])ya/g, 'Stripe$1a'],
  [/iyzico(['’])yu/g, 'Stripe$1ı'],
  [/iyzico(['’])nun/g, 'Stripe$1ın'],
  [/iyzico(['’])dan/g, 'Stripe$1tan'],
  [/iyzico(['’])da/g, 'Stripe$1ta'],
  [/iyzico/gi, 'Stripe'],
];

const fix = (text: string) => RULES.reduce((t, [re, to]) => t.replace(re, to), text);
/** Walks strings inside translation JSON ({ en: { title, body }, … }). */
const fixDeep = (v: unknown): unknown =>
  typeof v === 'string' ? fix(v) : Array.isArray(v) ? v.map(fixDeep) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fixDeep(x)])) : v;

let changes = 0;
async function each<T extends { id: string }>(label: (r: T) => string, rows: T[], fields: (keyof T)[], save: (id: string, data: Record<string, unknown>) => Promise<unknown>) {
  for (const row of rows) {
    const data: Record<string, unknown> = {};
    for (const f of fields) {
      const before = row[f];
      if (before === null || before === undefined) continue;
      const after = typeof before === 'string' ? fix(before) : fixDeep(before);
      if (JSON.stringify(after) !== JSON.stringify(before)) data[f as string] = after;
    }
    if (!Object.keys(data).length) continue;
    changes++;
    console.log(`${apply ? '✓' : '•'} ${label(row)}: ${Object.keys(data).join(', ')}`);
    if (apply) await save(row.id, data);
  }
}

async function main() {
  const json = (d: Record<string, unknown>) => d as Prisma.InputJsonValue as never;
  await each((p) => `sayfa ${p.slug}`, await prisma.page.findMany(), ['title', 'body', 'translations', 'seoTitle', 'seoDescription', 'aiSummary'], (id, d) =>
    prisma.page.update({ where: { id }, data: json(d) }),
  );
  await each((f) => `SSS ${f.question.slice(0, 40)}`, await prisma.faq.findMany(), ['question', 'answer', 'translations'], (id, d) => prisma.faq.update({ where: { id }, data: json(d) }));
  await each((j) => `journal ${j.slug}`, await prisma.journalPost.findMany(), ['title', 'excerpt', 'body', 'translations', 'seoTitle', 'seoDescription'], (id, d) =>
    prisma.journalPost.update({ where: { id }, data: json(d) }),
  );
  await each((h) => `ana sayfa ${h.title ?? h.id}`, await prisma.homeSection.findMany(), ['title', 'subtitle', 'body', 'translations'] as never, (id, d) =>
    prisma.homeSection.update({ where: { id }, data: json(d) }),
  );
  console.log(changes ? `${changes} kayıt ${apply ? 'güncellendi' : 'değişecek (yazmak için: npm run text:stripe -- --apply)'}` : 'iyzico geçen içerik yok');
}

main()
  .catch((e) => {
    console.error(`✗ ${(e as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
