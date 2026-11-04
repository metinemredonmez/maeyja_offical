import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Locale } from '../../common/utils/i18n.util';
import type { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { fillMissingTranslations } from './translation-fill';
import { DraftInput, FieldMap, TARGET_LOCALES, Translator } from './translator';
import { Tracked } from '../cron/tracked.decorator';

const RETRY_AFTER_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly translator: Translator | null;
  private readonly auto: boolean;
  private running = false;
  /** Rows whose translation failed, so a persistent error doesn't cost a request every run. */
  private readonly failedAt = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    const key = config.get('ANTHROPIC_API_KEY', { infer: true });
    this.translator = key ? new Translator(key) : null;
    this.auto = Boolean(key) && config.get('AI_AUTO_TRANSLATE', { infer: true });
  }

  /** "Otomatik çevir" in the admin: returns translations for the editor to review; nothing is saved here. */
  async translate(fields: FieldMap, kind: string, targets?: Locale[]) {
    if (!this.translator) throw new ServiceUnavailableException('Otomatik çeviri için ANTHROPIC_API_KEY tanımlı değil');
    return this.translator.translate(fields, targets?.length ? targets : TARGET_LOCALES, kind);
  }

  /** "AI ile doldur": a Turkish draft of the empty fields (and, for a category, sub-category and product ideas). */
  async draft(input: DraftInput) {
    if (!this.translator) throw new ServiceUnavailableException('Yapay zekâ için ANTHROPIC_API_KEY tanımlı değil');
    return this.translator.draft(input);
  }

  /**
   * Content written or changed in Turkish gets its other languages within a minute or two, without anyone pressing a
   * button. A run that finds nothing to do only reads the tables.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  @Tracked('ai.translate', { label: 'Otomatik çeviri', everyMin: 1 })
  async autoFill() {
    if (!this.auto || !this.translator || this.running) return;
    this.running = true;
    try {
      const filled = await fillMissingTranslations(this.prisma, this.translator, {
        skip: (key) => Date.now() - (this.failedAt.get(key) ?? 0) < RETRY_AFTER_MS,
        onError: (key, e) => {
          this.failedAt.set(key, Date.now());
          this.logger.warn(`Çeviri başarısız (${key}): ${e instanceof Error ? e.message : String(e)}`);
        },
      });
      if (filled) this.logger.log(`Otomatik çeviri: ${filled} alan dolduruldu`);
      return { filled };
    } finally {
      this.running = false;
    }
  }
}
