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
  { model: 'product', kind: 'product page', fields: ['subtitle', 'description', 'story', 'material', 'care', 'dimensions', 'madeIn', 'sizeGuide', 'seoTitle', 'seoDescription', 'aiSummary'] },
  { model: 'category', kind: 'product category', fields: ['name', 'description', 'seoTitle', 'seoDescription', 'aiSummary'] },
  { model: 'collection', kind: 'collection', fields: ['name', 'description', 'seoTitle', 'seoDescription', 'aiSummary'] },
  { model: 'color', kind: 'leather colour name', fields: ['name'] },
  { model: 'homeSection', kind: 'homepage section', fields: ['title', 'subtitle', 'body', 'ctaLabel'] },
  { model: 'page', kind: 'store page', fields: ['title', 'body', 'seoTitle', 'seoDescription', 'aiSummary'] },
  { model: 'journalPost', kind: 'journal article', fields: ['title', 'excerpt', 'body', 'seoTitle', 'seoDescription', 'aiSummary'] },
  { model: 'faq', kind: 'FAQ entry', fields: ['group', 'question', 'answer'] },
  { model: 'pressItem', kind: 'press quote (the publication name is not part of it)', fields: ['title', 'quote'] },
  { model: 'stockist', kind: 'stockist location: write city and district names the way readers of the language know them; keep shop, mall and street names as they are', fields: ['city', 'address'] },
];

/** Records which Turkish text (srcHash) each translation (outHash) belongs to. */
function remember(prisma: PrismaClient, model: string, rowId: string, rows: { lang: string; field: string; srcHash: string; outHash: string }[]) {
  return prisma.$transaction(
    rows.map((w) =>
      prisma.translationMeta.upsert({
        where: { model_rowId_lang_field: { model, rowId, lang: w.lang, field: w.field } },
        create: { model, rowId, ...w },
        update: { srcHash: w.srcHash, outHash: w.outHash },
      }),
    ),
  );
}

/** Seeded "… metni buraya gelecek." stand-ins are not worth translating. */
const PLACEHOLDER = /metni buraya gelecek/;

export const hash = (text: string) => createHash('sha1').update(text).digest('hex').slice(0, 16);

type Translations = Record<string, Record<string, string> | undefined>;
type Meta = { srcHash: string; outHash: string };

/**
 * Keeps every language in step with the Turkish text. For each translated field it remembers which Turkish text
 * the translation belongs to (srcHash) and what the translation was (outHash):
 * - an empty translation slot is filled;
 * - a translation seen for the first time (seeded, or filled with the admin's "Otomatik çevir") is taken as
 *   matching the Turkish of that moment;
 * - a translation someone edited (it no longer matches outHash) is kept, and taken as matching the current Turkish;
 * - a translation nobody touched is redone as soon as its Turkish changes.
 * So writing the Turkish is enough: the other languages follow, and hand corrections survive until the Turkish of
 * that field changes again. The row is re-read just before writing, so an edit made meanwhile wins. `skip` backs off
 * recently failed rows.
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
      const inStep: { lang: string; field: string; srcHash: string; outHash: string }[] = [];
      for (const lang of TARGET_LOCALES) {
        const fields = spec.fields.filter((f) => {
          const base = row[f];
          if (typeof base !== 'string' || !base.trim() || PLACEHOLDER.test(base)) return false;
          const value = current[lang]?.[f];
          if (!value?.trim()) return true;
          const meta = metas.get(`${id}|${lang}|${f}`);
          if (!meta || meta.outHash !== hash(value)) {
            // First seen, or edited by hand since: it belongs to the Turkish as it is now.
            inStep.push({ lang, field: f, srcHash: hash(base), outHash: hash(value) });
            return false;
          }
          return isMachineStale(lang, f, base, value);
        });
        if (fields.length) todo.set(lang, fields);
      }
      if (inStep.length) await remember(prisma, spec.model, id, inStep);
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
          await remember(prisma, spec.model, id, written);
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
