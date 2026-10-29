import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
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
  { model: 'pressItem', kind: 'press quote (the publication name is not part of it)', fields: ['title', 'quote'] },
  { model: 'stockist', kind: 'stockist location: write city and district names the way readers of the language know them; keep shop, mall and street names as they are', fields: ['city', 'address'] },
];

/** Seeded "… metni buraya gelecek." stand-ins are not worth translating. */
const PLACEHOLDER = /metni buraya gelecek/;

const hash = (text: string) => createHash('sha1').update(text).digest('hex').slice(0, 16);

type Translations = Record<string, Record<string, string> | undefined>;
type Meta = { srcHash: string; outHash: string };

/**
 * Keeps every language in step with the Turkish text:
 * - an empty translation slot is filled;
 * - a slot the translator filled earlier is redone when its Turkish source has changed since — unless someone
 *   edited that translation by hand (its text no longer matches what the translator wrote), which is kept.
 * The row is re-read just before writing, so an edit made meanwhile wins. `skip` backs off recently failed rows.
 */
export async function fillMissingTranslations(
  prisma: PrismaClient,
  translator: Translator,
  opts: { log?: (line: string) => void; skip?: (key: string) => boolean; onError?: (key: string, e: unknown) => void } = {},
) {
  let filled = 0;
  for (const spec of TRANSLATABLE) {
    const table = (prisma as unknown as Record<string, Delegate>)[spec.model];
    const [rows, metaRows] = await Promise.all([
      table.findMany({ select: { id: true, translations: true, ...Object.fromEntries(spec.fields.map((f) => [f, true])) } }),
      prisma.translationMeta.findMany({ where: { model: spec.model } }),
    ]);
    const metas = new Map<string, Meta>(metaRows.map((m) => [`${m.rowId}|${m.lang}|${m.field}`, m]));

    for (const row of rows) {
      const id = row.id as string;
      const key = `${spec.model}:${id}`;
      if (opts.skip?.(key)) continue;
      const current = (row.translations ?? {}) as Translations;
      const isMachineStale = (lang: string, field: string, base: string, value: string) => {
        const meta = metas.get(`${id}|${lang}|${field}`);
        return Boolean(meta && meta.outHash === hash(value) && meta.srcHash !== hash(base));
      };

      const todo = new Map<string, string[]>();
      for (const lang of TARGET_LOCALES) {
        const fields = spec.fields.filter((f) => {
          const base = row[f];
          if (typeof base !== 'string' || !base.trim() || PLACEHOLDER.test(base)) return false;
          const value = current[lang]?.[f]?.trim();
          return !value || isMachineStale(lang, f, base, current[lang]![f]);
        });
        if (fields.length) todo.set(lang, fields);
      }
      if (!todo.size) continue;

      const needed = [...new Set([...todo.values()].flat())];
      try {
        const result = await translator.translate(Object.fromEntries(needed.map((f) => [f, row[f] as string])), [...todo.keys()] as typeof TARGET_LOCALES, spec.kind);
        const fresh = await table.findUnique({ where: { id }, select: { translations: true } });
        const merged = JSON.parse(JSON.stringify(fresh?.translations ?? {})) as Translations;
        const written: { lang: string; field: string; srcHash: string; outHash: string }[] = [];
        for (const [lang, fields] of todo) {
          for (const f of fields) {
            const value = result[lang as keyof typeof result]?.[f];
            const now = merged[lang]?.[f];
            const base = row[f] as string;
            // Still empty, or still exactly the stale machine text (not touched by hand in the meantime).
            if (value && (!now?.trim() || isMachineStale(lang, f, base, now))) {
              (merged[lang] ??= {})[f] = value;
              written.push({ lang, field: f, srcHash: hash(base), outHash: hash(value) });
            }
          }
        }
        if (written.length) {
          await table.update({ where: { id }, data: { translations: merged } });
          await prisma.$transaction(
            written.map((w) =>
              prisma.translationMeta.upsert({
                where: { model_rowId_lang_field: { model: spec.model, rowId: id, lang: w.lang, field: w.field } },
                create: { model: spec.model, rowId: id, ...w },
                update: { srcHash: w.srcHash, outHash: w.outHash },
              }),
            ),
          );
          filled += written.length;
          opts.log?.(`${key}: ${written.length} alan`);
        }
      } catch (e) {
        opts.onError?.(key, e);
      }
    }
  }
  return filled;
}
