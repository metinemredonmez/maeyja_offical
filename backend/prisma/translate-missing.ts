/**
 * Fills every empty translation (10 languages) from the Turkish text with Claude, once, for all content:
 *   npm run translate:missing
 * Safe to re-run — slots that already hold text are never changed. Needs ANTHROPIC_API_KEY in .env.
 * The API does the same every 10 minutes on its own (AI_AUTO_TRANSLATE); this is for "right now".
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { fillMissingTranslations } from '../src/modules/ai/translation-fill';
import { Translator } from '../src/modules/ai/translator';

const prisma = new PrismaClient();

async function main() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY tanımlı değil (backend/.env)');
  const filled = await fillMissingTranslations(prisma, new Translator(key), {
    log: (line) => console.log(`✓ ${line}`),
    onError: (row, e) => console.error(`✗ ${row}: ${e instanceof Error ? e.message : String(e)}`),
  });
  console.log(`✓ çeviri tamam — ${filled} alan dolduruldu`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
