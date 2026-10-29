import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus, Prisma } from '@prisma/client';
import { paginate, PaginationQueryDto, skipTake } from '../../common/dto/pagination.dto';
import { Locale, localize } from '../../common/utils/i18n.util';
import { cleanHtmlFields } from '../../common/utils/html.util';
import { slugify } from '../../common/utils/slug.util';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { ProductQueryDto } from '../catalog/dto/catalog.dto';
import { MailService } from '../notifications/mail.service';
import { templates } from '../notifications/mail.templates';
import { ContactDto, JournalPostDto, SubscribeDto, UpdateJournalPostDto } from './dto/content.dto';

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly mail: MailService,
  ) {}

  /** Everything the homepage needs in one request, with product/press/stockist blocks resolved. */
  async home(lang: Locale) {
    const sections = await this.prisma.homeSection.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
    return Promise.all(
      sections.map(async (s) => {
        const base = localize(s, lang);
        const payload = (s.payload ?? {}) as { productIds?: string[]; collectionSlug?: string; limit?: number };
        switch (s.type) {
          case 'HERO':
          case 'EDITORIAL': {
            // Optional product cards: one floats on the hero or a full-width band (Polène-style); the diptych captions two.
            if (!payload.productIds?.length) return base;
            const all = await this.catalog.products({ page: 1, limit: 100 } as ProductQueryDto, lang);
            const byId = new Map(all.items.map((p) => [p.id, p]));
            return { ...base, products: payload.productIds.map((id) => byId.get(id)).filter(Boolean) };
          }
          case 'FEATURED_PRODUCTS': {
            if (payload.productIds?.length) {
              const all = await this.catalog.products({ page: 1, limit: 100 } as ProductQueryDto, lang);
              const byId = new Map(all.items.map((p) => [p.id, p]));
              return { ...base, products: payload.productIds.map((id) => byId.get(id)).filter(Boolean) };
            }
            // The model strip shows every model unless products are picked; the grid shows featured ones.
            const strip = s.layout === 'strip';
            const list = await this.catalog.products({ page: 1, limit: payload.limit ?? (strip ? 24 : 8), ...(strip ? {} : { featured: true }) } as ProductQueryDto, lang);
            return { ...base, products: list.items };
          }
          case 'COLLECTION': {
            if (!payload.collectionSlug) return { ...base, products: [] };
            const list = await this.catalog.products({ page: 1, limit: payload.limit ?? 8, collection: payload.collectionSlug } as ProductQueryDto, lang);
            return { ...base, products: list.items };
          }
          case 'PRESS':
            return { ...base, press: await this.press(lang) };
          case 'STOCKISTS':
            return { ...base, stockists: await this.stockists(lang) };
          default:
            return base;
        }
      }),
    );
  }

  async page(slug: string, lang: Locale) {
    const page = await this.prisma.page.findFirst({ where: { slug, status: ContentStatus.PUBLISHED } });
    if (!page) throw new NotFoundException('Sayfa bulunamadı');
    return localize(page, lang);
  }

  async journal(q: PaginationQueryDto, lang: Locale) {
    const where: Prisma.JournalPostWhereInput = { status: ContentStatus.PUBLISHED, publishedAt: { lte: new Date() } };
    const [rows, total] = await Promise.all([
      this.prisma.journalPost.findMany({ where, orderBy: { publishedAt: 'desc' }, ...skipTake(q), omit: { body: true } }),
      this.prisma.journalPost.count({ where }),
    ]);
    return paginate(
      rows.map((r) => localize(r, lang)),
      total,
      q.page,
      q.limit,
    );
  }

  async journalPost(slug: string, lang: Locale) {
    const post = await this.prisma.journalPost.findFirst({ where: { slug, status: ContentStatus.PUBLISHED, publishedAt: { lte: new Date() } } });
    if (!post) throw new NotFoundException('Yazı bulunamadı');
    return localize(post, lang);
  }

  async press(lang: Locale) {
    const rows = await this.prisma.pressItem.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }] });
    return rows.map((r) => localize(r, lang));
  }

  async stockists(lang: Locale) {
    const rows = await this.prisma.stockist.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { city: 'asc' }] });
    return rows.map((r) => localize(r, lang));
  }

  async faq(lang: Locale) {
    const rows = await this.prisma.faq.findMany({ where: { isActive: true }, orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }] });
    return rows.map((r) => localize(r, lang));
  }

  async subscribe(dto: SubscribeDto) {
    await this.prisma.newsletterSubscriber.upsert({
      where: { email: dto.email },
      create: { email: dto.email, locale: dto.locale ?? 'tr', source: dto.source ?? 'footer' },
      update: { unsubscribedAt: null },
    });
    return { ok: true };
  }

  async contact(dto: ContactDto) {
    if (dto.website) return { ok: true }; // honeypot hit — pretend success
    const { website: _w, ...data } = dto;
    const msg = await this.prisma.contactMessage.create({ data });
    void this.mail.sendToAdmin(templates.adminNotice(`İletişim formu: ${dto.subject ?? dto.name}`, { Ad: dto.name, 'E-posta': dto.email, Telefon: dto.phone, Mesaj: dto.message }));
    return { ok: true, id: msg.id };
  }

  // ─────────────────────────── admin: journal (needs slug + publish handling) ───────────────────────────

  async createJournalPost(input: JournalPostDto) {
    const dto = cleanHtmlFields(input as unknown as Record<string, unknown>, ['body', 'excerpt']) as unknown as JournalPostDto;
    const slug = await this.uniqueJournalSlug(dto.slug ?? slugify(dto.title));
    return this.prisma.journalPost.create({
      data: {
        ...dto,
        slug,
        translations: dto.translations as Prisma.InputJsonValue,
        publishedAt: dto.publishedAt ?? (dto.status === ContentStatus.PUBLISHED ? new Date() : null),
      },
    });
  }

  async updateJournalPost(id: string, input: UpdateJournalPostDto) {
    const dto = cleanHtmlFields(input as unknown as Record<string, unknown>, ['body', 'excerpt']) as unknown as UpdateJournalPostDto;
    const existing = await this.prisma.journalPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Yazı bulunamadı');
    const slug = dto.slug && dto.slug !== existing.slug ? await this.uniqueJournalSlug(dto.slug, id) : undefined;
    const publishNow = dto.status === ContentStatus.PUBLISHED && !existing.publishedAt && !dto.publishedAt;
    return this.prisma.journalPost.update({
      where: { id },
      data: { ...dto, slug, translations: dto.translations as Prisma.InputJsonValue, ...(publishNow ? { publishedAt: new Date() } : {}) },
    });
  }

  private async uniqueJournalSlug(base: string, exceptId?: string) {
    const root = slugify(base) || 'yazi';
    for (let i = 0; i < 50; i++) {
      const slug = i === 0 ? root : `${root}-${i + 1}`;
      const hit = await this.prisma.journalPost.findFirst({ where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } });
      if (!hit) return slug;
    }
    throw new BadRequestException('Uygun bir slug üretilemedi');
  }
}
