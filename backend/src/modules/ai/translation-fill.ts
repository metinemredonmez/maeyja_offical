import { PrismaClient } from '@prisma/client';
import { TARGET_LOCALES, Translator } from './translator';

type Delegate = {
  findMany(args: object): Promise<Record<string, unknown>[]>;
  findUnique(args: object): Promise<{ translations: unknown } | null>;
  update(args: object): Promise<unknown>;
};

/** What gets translated per table. Product names are model names and stay as they are. */
export const TRANSLATABLE: { model: string; kind: string; fields: string[] }[] = [
  { model: 'product', kind: 'product page', fields: ['subtitle', 'description', 'story', 'material', 'care', 'dimensions', 'madeIn', 'sizeGuide', 'seoTitle', 'seoDescription'] },
  { model: 'category', kind: 'product category', fields: ['name', 'description', 'seoTitle', 'seoDescription'] },
  { model: 'collection', kind: 'collection', fields: ['name', 'description', 'seoTitle', 'seoDescription'] },
  { model: 'color', kind: 'leather colour name', fields: ['name'] },
  { model: 'homeSection', kind: 'homepage section', fields: ['title', 'subtitle', 'body', 'ctaLabel'] },
  { model: 'page', kind: 'store page', fields: ['title', 'body', 'seoTitle', 'seoDescription'] },
  { model: 'journalPost', kind: 'journal article', fields: ['title', 'excerpt', 'body', 'seoTitle', 'seoDescription'] },
  { model: 'faq', kind: 'FAQ entry', fields: ['group', 'question', 'answer'] },
];

/** Seeded "… metni buraya gelecek." stand-ins are not worth translating. */
const PLACEHOLDER = /metni buraya gelecek/;

type Translations = Record<string, Record<string, string> | undefined>;

/**
 * Fills every empty translation slot from the Turkish text. Slots that already hold text — written in the
 * admin or translated earlier — are never touched, and the row is re-read just before writing so an edit
 * made meanwhile wins. `skip` lets the caller back off rows that failed recently.
 */
export async function fillMissingTranslations(
  prisma: PrismaClient,
  translator: Translator,
  opts: { log?: (line: string) => void; skip?: (key: string) => boolean; onError?: (key: string, e: unknown) => void } = {},
) {
  let filled = 0;
  for (const spec of TRANSLATABLE) {
    const table = (prisma as unknown as Record<string, Delegate>)[spec.model];
    const rows = await table.findMany({ select: { id: true, translations: true, ...Object.fromEntries(spec.fields.map((f) => [f, true])) } });
    for (const row of rows) {
      const key = `${spec.model}:${row.id as string}`;
      if (opts.skip?.(key)) continue;
      const current = (row.translations ?? {}) as Translations;
      const missing = new Map<string, string[]>();
      for (const lang of TARGET_LOCALES) {
        const empty = spec.fields.filter((f) => {
          const base = row[f];
          return typeof base === 'string' && base.trim() && !PLACEHOLDER.test(base) && !current[lang]?.[f]?.trim();
        });
        if (empty.length) missing.set(lang, empty);
      }
      if (!missing.size) continue;

      const needed = [...new Set([...missing.values()].flat())];
      try {
        const result = await translator.translate(Object.fromEntries(needed.map((f) => [f, row[f] as string])), [...missing.keys()] as typeof TARGET_LOCALES, spec.kind);
        const fresh = await table.findUnique({ where: { id: row.id }, select: { translations: true } });
        const merged = JSON.parse(JSON.stringify(fresh?.translations ?? {})) as Translations;
        let changed = 0;
        for (const [lang, fields] of missing) {
          for (const f of fields) {
            const value = result[lang as keyof typeof result]?.[f];
            if (value && !merged[lang]?.[f]?.trim()) {
              (merged[lang] ??= {})[f] = value;
              changed++;
            }
          }
        }
        if (changed) {
          await table.update({ where: { id: row.id }, data: { translations: merged } });
          filled += changed;
          opts.log?.(`${key}: ${changed} alan`);
        }
      } catch (e) {
        opts.onError?.(key, e);
      }
    }
  }
  return filled;
}
