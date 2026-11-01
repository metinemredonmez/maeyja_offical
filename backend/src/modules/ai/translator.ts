import Anthropic from '@anthropic-ai/sdk';
import { LOCALES, type Locale } from '../../common/utils/i18n.util';

/** Content is written in Turkish; these are the languages it is translated into. */
export const TARGET_LOCALES = LOCALES.filter((l) => l !== 'tr');

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English (British spelling)',
  ru: 'Russian',
  nl: 'Dutch',
  de: 'German',
  fr: 'French',
  it: 'Italian',
  es: 'Spanish (Spain)',
  ko: 'Korean',
  ja: 'Japanese',
  zh: 'Simplified Chinese',
};

const MODEL = 'claude-opus-5-5';

const SYSTEM = `You translate the online store of MAEYJA, a small label of handcrafted leather bags (designed in France, cut and stitched by hand in an Istanbul atelier). The source text is Turkish, written by the brand in the admin panel.

Voice: calm, precise, quietly luxurious — like Polène or The Row. Short sentences, no exclamation marks, no marketing clichés, no emoji. Translate meaning and tone, not word by word; it must read as if written natively in the target language.

Keep exactly as they are:
- the brand name MAEYJA and every bag/model name (Origami, Valise, Duo, Tulip, Drape, Frame, Cube, Lune, and any other capitalised product name);
- model numbers such as N°01, prices, currency codes, measurements and units, URLs, e-mail addresses, phone numbers, order numbers;
- placeholders in braces such as {count} or {days};
- HTML: every tag, attribute and entity stays identical and in the same place — translate only the human-readable text between tags; never add or remove tags.

Legal and policy texts are translated faithfully and completely, without adding or omitting obligations. SEO titles stay under ~60 characters and SEO descriptions under ~155 where the source allows.

Answer only with the JSON object requested: one entry per target language code, each holding every field key of the input with its translation.`;

export type FieldMap = Record<string, string>;
export type DraftInput = { kind: string; given: FieldMap; want: string[]; rich: string[]; extras: boolean };
export type Draft = { fields: FieldMap; children?: { name: string; description: string }[]; products?: { name: string; subtitle: string; description: string }[]; tip?: string };
export type TranslationMap = Partial<Record<Locale, FieldMap>>;

/** Above this much text × languages, each language gets its own request so outputs stay small. */
const SINGLE_REQUEST_BUDGET = 12_000;
/** The JSON schema grows with fields × languages; past this, structured output rejects it, so split by language. */
const SINGLE_REQUEST_SLOTS = 30;

export class Translator {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey, maxRetries: 3, timeout: 180_000 });
  }

  /** Translates Turkish `fields` into `targets`. Empty fields are skipped; failed languages are left out. */
  async translate(fields: FieldMap, targets: readonly Locale[], kind: string): Promise<TranslationMap> {
    const source = Object.fromEntries(Object.entries(fields).filter(([, v]) => typeof v === 'string' && v.trim()));
    const langs = targets.filter((l) => l !== 'tr');
    if (!Object.keys(source).length || !langs.length) return {};
    const size = Object.values(source).reduce((n, v) => n + v.length, 0);
    const split = size * langs.length > SINGLE_REQUEST_BUDGET || Object.keys(source).length * langs.length > SINGLE_REQUEST_SLOTS;
    const groups = split ? langs.map((l) => [l]) : [langs];

    const out: TranslationMap = {};
    const queue = [...groups];
    const worker = async () => {
      for (let group = queue.shift(); group; group = queue.shift()) Object.assign(out, await this.request(source, group, kind));
    };
    await Promise.all(Array.from({ length: Math.min(3, groups.length) }, worker));
    return out;
  }

  /** "AI ile doldur": a Turkish first draft of a record's empty fields from what is already written (nothing is saved). */
  async draft(input: DraftInput): Promise<Draft> {
    const str = { type: 'string' };
    const item = (keys: string[]) => ({ type: 'object', properties: Object.fromEntries(keys.map((k) => [k, str])), required: keys, additionalProperties: false });
    const properties: Record<string, unknown> = { fields: item(input.want) };
    if (input.extras) {
      properties.children = { type: 'array', items: item(['name', 'description']) };
      properties.products = { type: 'array', items: item(['name', 'subtitle', 'description']) };
      properties.tip = str;
    }
    const schema = { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
    const response = await this.client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: DRAFT_SYSTEM,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content: JSON.stringify({ record_type: input.kind, already_written: input.given, draft_these_fields: input.want, rich_fields: input.rich, extras: input.extras }) }],
    });
    if (response.stop_reason === 'refusal') throw new Error(`İstek reddedildi (${response.stop_details?.category ?? 'bilinmiyor'})`);
    if (response.stop_reason === 'max_tokens') throw new Error('Yanıt çok uzun, yarıda kesildi');
    const parsed = JSON.parse(response.content.map((b) => (b.type === 'text' ? b.text : '')).join('')) as Draft;
    const fields = Object.fromEntries(input.want.flatMap((k) => (typeof parsed.fields?.[k] === 'string' && parsed.fields[k].trim() ? [[k, parsed.fields[k].trim()]] : [])));
    return { fields, children: parsed.children?.slice(0, 6), products: parsed.products?.slice(0, 6), tip: parsed.tip };
  }

  private async request(source: FieldMap, targets: Locale[], kind: string): Promise<TranslationMap> {
    const keys = Object.keys(source);
    const fieldsSchema = { type: 'object', properties: Object.fromEntries(keys.map((k) => [k, { type: 'string' }])), required: keys, additionalProperties: false };
    const schema = { type: 'object', properties: Object.fromEntries(targets.map((l) => [l, fieldsSchema])), required: targets, additionalProperties: false };

    const response = await this.client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // A declined request is re-run on Anthropic's recommended fallback model instead of failing.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
      messages: [
        {
          role: 'user',
          content: JSON.stringify({ content_type: kind, target_languages: targets.map((code) => ({ code, language: LANGUAGE_NAMES[code] })), fields: source }),
        },
      ],
    });

    if (response.stop_reason === 'refusal') throw new Error(`Çeviri reddedildi (${response.stop_details?.category ?? 'bilinmiyor'})`);
    if (response.stop_reason === 'max_tokens') throw new Error('Çeviri çok uzun, yarıda kesildi');
    const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    const parsed = JSON.parse(text) as Record<string, Record<string, unknown> | undefined>;

    const out: TranslationMap = {};
    for (const l of targets) {
      const row = parsed[l];
      if (!row) continue;
      out[l] = Object.fromEntries(keys.flatMap((k) => (typeof row[k] === 'string' && row[k].trim() ? [[k, row[k].trim()]] : [])));
    }
    return out;
  }
}

const DRAFT_SYSTEM = `You write the Turkish copy of the online store of MAEYJA, a small label of handcrafted leather goods (designed in France, cut and stitched by hand in an Istanbul atelier; it may grow into new lines such as jewellery or clothing). The admin has started a record — at least its name — and asks you for a first draft of the empty fields, which they will review before saving.

Voice: calm, precise, quietly luxurious — like Polène or The Row. Natural Turkish, short sentences, no exclamation marks, no marketing clichés, no emoji.

Facts: use only what the admin gave and the brand facts above. Never invent measurements, prices, materials, stones or metals, stock, awards, press or stockists; where a fact is unknown, write around it.

Fields:
- fields listed as rich are HTML: one to three short <p> paragraphs (a page or journal body may use a few <h2> headings and more paragraphs); every other field is plain text;
- subtitle: a few words; seoTitle: under 60 characters, may end with " | MAEYJA"; seoDescription: under 155 characters; aiSummary: two to four plain, factual sentences for AI assistants (what it is, for whom, how it is made, where to buy: maeyja.com);
- a category or collection description: one or two sentences;
- an e-mail campaign: subject under 50 characters, preheader under 90, a short title, a body of two to four short <p> paragraphs, ctaLabel of two to four words.

Write in Turkish unless already_written.language names another language.

For a category you may also be asked for:
- children: up to six natural sub-categories (Turkish names, one-sentence descriptions), most common first;
- products: up to six product ideas the brand could add to this category, in its own style (a short name, a few-word subtitle, a two-sentence description; no prices or measurements);
- tip: two or three sentences of practical advice for the shop owner about this category (what customers look for, how to photograph or present it).

Answer only with the JSON object requested.`;
