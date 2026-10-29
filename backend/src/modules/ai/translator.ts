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
export type TranslationMap = Partial<Record<Locale, FieldMap>>;

/** Above this much text × languages, each language gets its own request so outputs stay small. */
const SINGLE_REQUEST_BUDGET = 12_000;

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
    const groups = size * langs.length > SINGLE_REQUEST_BUDGET ? langs.map((l) => [l]) : [langs];

    const out: TranslationMap = {};
    const queue = [...groups];
    const worker = async () => {
      for (let group = queue.shift(); group; group = queue.shift()) Object.assign(out, await this.request(source, group, kind));
    };
    await Promise.all(Array.from({ length: Math.min(3, groups.length) }, worker));
    return out;
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
