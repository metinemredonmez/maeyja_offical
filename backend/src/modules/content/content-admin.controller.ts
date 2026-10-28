import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Put, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { IsBoolean } from 'class-validator';
import { Response } from 'express';
import { ADMIN_ROLES, Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { paginate, PaginationQueryDto, skipTake } from '../../common/dto/pagination.dto';
import { ReorderDto } from '../../common/dto/reorder.dto';
import { cleanHtmlFields } from '../../common/utils/html.util';
import { PrismaService } from '../../prisma/prisma.service';
import { ContentService } from './content.service';
import {
  ContentListQueryDto,
  FaqDto,
  HomeSectionDto,
  JournalPostDto,
  PageDto,
  PressItemDto,
  StockistDto,
  UpdateFaqDto,
  UpdateHomeSectionDto,
  UpdateJournalPostDto,
  UpdatePageDto,
  UpdatePressItemDto,
  UpdateStockistDto,
} from './dto/content.dto';

class ReadDto {
  @IsBoolean() isRead: boolean;
}

const json = <T extends { translations?: unknown; payload?: unknown }>(dto: T) => ({
  ...(cleanHtmlFields(dto as Record<string, unknown>, ['body', 'answer']) as T),
  ...(dto.translations !== undefined ? { translations: dto.translations as Prisma.InputJsonValue } : {}),
  ...(dto.payload !== undefined ? { payload: dto.payload as Prisma.InputJsonValue } : {}),
});

/** Editors manage storytelling content; newsletter and inbox are admin-only (personal data). */
@ApiTags('Admin · Content')
@ApiBearerAuth()
@Roles(...STAFF_ROLES)
@Controller('admin')
export class ContentAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly content: ContentService,
  ) {}

  // home sections
  @Get('home-sections') listSections() { return this.prisma.homeSection.findMany({ orderBy: { sortOrder: 'asc' } }); }
  @Post('home-sections') createSection(@Body() dto: HomeSectionDto) { return this.prisma.homeSection.create({ data: json(dto) }); }
  @Patch('home-sections/:id') updateSection(@Param('id') id: string, @Body() dto: UpdateHomeSectionDto) { return this.prisma.homeSection.update({ where: { id }, data: json(dto) }); }
  @Delete('home-sections/:id') async deleteSection(@Param('id') id: string) { await this.prisma.homeSection.delete({ where: { id } }); return { ok: true }; }
  @Put('home-sections/order')
  async reorderSections(@Body() dto: ReorderDto) {
    await this.prisma.$transaction(dto.ids.map((id, sortOrder) => this.prisma.homeSection.update({ where: { id }, data: { sortOrder } })));
    return this.listSections();
  }

  // pages
  @Get('pages') listPages() { return this.prisma.page.findMany({ orderBy: { slug: 'asc' }, omit: { body: true } }); }
  @Get('pages/:id') getPage(@Param('id') id: string) { return this.prisma.page.findUniqueOrThrow({ where: { id } }); }
  @Post('pages') createPage(@Body() dto: PageDto) { return this.prisma.page.create({ data: json(dto) }); }
  @Patch('pages/:id') updatePage(@Param('id') id: string, @Body() dto: UpdatePageDto) { return this.prisma.page.update({ where: { id }, data: json(dto) }); }
  @Delete('pages/:id') async deletePage(@Param('id') id: string) { await this.prisma.page.delete({ where: { id } }); return { ok: true }; }

  // journal
  @Get('journal')
  async listJournal(@Query() q: ContentListQueryDto) {
    const where = { ...(q.status ? { status: q.status } : {}), ...(q.q ? { title: { contains: q.q, mode: 'insensitive' as const } } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.journalPost.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake(q), omit: { body: true } }),
      this.prisma.journalPost.count({ where }),
    ]);
    return paginate(items, total, q.page, q.limit);
  }
  @Get('journal/:id') getJournal(@Param('id') id: string) { return this.prisma.journalPost.findUniqueOrThrow({ where: { id } }); }
  @Post('journal') createJournal(@Body() dto: JournalPostDto) { return this.content.createJournalPost(dto); }
  @Patch('journal/:id') updateJournal(@Param('id') id: string, @Body() dto: UpdateJournalPostDto) { return this.content.updateJournalPost(id, dto); }
  @Delete('journal/:id') async deleteJournal(@Param('id') id: string) { await this.prisma.journalPost.delete({ where: { id } }); return { ok: true }; }

  // press
  @Get('press') listPress() { return this.prisma.pressItem.findMany({ orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }] }); }
  @Post('press') createPress(@Body() dto: PressItemDto) { return this.prisma.pressItem.create({ data: dto }); }
  @Patch('press/:id') updatePress(@Param('id') id: string, @Body() dto: UpdatePressItemDto) { return this.prisma.pressItem.update({ where: { id }, data: dto }); }
  @Delete('press/:id') async deletePress(@Param('id') id: string) { await this.prisma.pressItem.delete({ where: { id } }); return { ok: true }; }

  // stockists
  @Get('stockists') listStockists() { return this.prisma.stockist.findMany({ orderBy: [{ sortOrder: 'asc' }, { city: 'asc' }] }); }
  @Post('stockists') createStockist(@Body() dto: StockistDto) { return this.prisma.stockist.create({ data: dto }); }
  @Patch('stockists/:id') updateStockist(@Param('id') id: string, @Body() dto: UpdateStockistDto) { return this.prisma.stockist.update({ where: { id }, data: dto }); }
  @Delete('stockists/:id') async deleteStockist(@Param('id') id: string) { await this.prisma.stockist.delete({ where: { id } }); return { ok: true }; }

  // faq
  @Get('faq') listFaq() { return this.prisma.faq.findMany({ orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }] }); }
  @Post('faq') createFaq(@Body() dto: FaqDto) { return this.prisma.faq.create({ data: json(dto) }); }
  @Patch('faq/:id') updateFaq(@Param('id') id: string, @Body() dto: UpdateFaqDto) { return this.prisma.faq.update({ where: { id }, data: json(dto) }); }
  @Delete('faq/:id') async deleteFaq(@Param('id') id: string) { await this.prisma.faq.delete({ where: { id } }); return { ok: true }; }

  // newsletter (admin only)
  @Roles(...ADMIN_ROLES)
  @Get('newsletter')
  async listSubscribers(@Query() q: PaginationQueryDto) {
    const where = { unsubscribedAt: null, ...(q.q ? { email: { contains: q.q, mode: 'insensitive' as const } } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.newsletterSubscriber.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake(q) }),
      this.prisma.newsletterSubscriber.count({ where }),
    ]);
    return paginate(items, total, q.page, q.limit);
  }

  @Roles(...ADMIN_ROLES)
  @Get('newsletter/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="maeyja-bulten.csv"')
  async exportSubscribers(@Res() res: Response) {
    const rows = await this.prisma.newsletterSubscriber.findMany({ where: { unsubscribedAt: null }, orderBy: { createdAt: 'desc' } });
    res.send('﻿email;locale;source;created_at\n' + rows.map((r) => `${r.email};${r.locale};${r.source ?? ''};${r.createdAt.toISOString()}`).join('\n'));
  }

  @Roles(...ADMIN_ROLES)
  @Delete('newsletter/:id')
  async deleteSubscriber(@Param('id') id: string) {
    await this.prisma.newsletterSubscriber.delete({ where: { id } });
    return { ok: true };
  }

  // contact inbox (admin only)
  @Roles(...ADMIN_ROLES)
  @Get('messages')
  async listMessages(@Query() q: PaginationQueryDto) {
    const [items, total, unread] = await Promise.all([
      this.prisma.contactMessage.findMany({ orderBy: { createdAt: 'desc' }, ...skipTake(q) }),
      this.prisma.contactMessage.count(),
      this.prisma.contactMessage.count({ where: { isRead: false } }),
    ]);
    return { ...paginate(items, total, q.page, q.limit), unread };
  }

  @Roles(...ADMIN_ROLES)
  @Patch('messages/:id')
  markMessage(@Param('id') id: string, @Body() dto: ReadDto) {
    return this.prisma.contactMessage.update({ where: { id }, data: { isRead: dto.isRead } });
  }

  @Roles(...ADMIN_ROLES)
  @Delete('messages/:id')
  async deleteMessage(@Param('id') id: string) {
    await this.prisma.contactMessage.delete({ where: { id } });
    return { ok: true };
  }
}
