import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Lang } from '../../common/decorators/lang.decorator';
import { Locale } from '../../common/utils/i18n.util';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogService, VISIBLE_PRODUCT, cardInclude } from '../catalog/catalog.service';

class WishlistDto {
  @IsString() productId: string;
}

@ApiTags('Account')
@ApiBearerAuth()
@Controller('me/wishlist')
export class WishlistController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Lang() lang: Locale) {
    const rows = await this.prisma.wishlistItem.findMany({
      where: { userId: user.id, product: VISIBLE_PRODUCT },
      orderBy: { createdAt: 'desc' },
      include: { product: { include: cardInclude } },
    });
    return rows.map((r) => ({ addedAt: r.createdAt, product: this.catalog.toCard(r.product, lang) }));
  }

  @Post()
  async add(@CurrentUser() user: AuthUser, @Body() dto: WishlistDto) {
    await this.prisma.product.findFirstOrThrow({ where: { id: dto.productId, ...VISIBLE_PRODUCT } });
    await this.prisma.wishlistItem.upsert({
      where: { userId_productId: { userId: user.id, productId: dto.productId } },
      create: { userId: user.id, productId: dto.productId },
      update: {},
    });
    return { ok: true };
  }

  @Delete(':productId')
  async remove(@CurrentUser() user: AuthUser, @Param('productId') productId: string) {
    await this.prisma.wishlistItem.deleteMany({ where: { userId: user.id, productId } });
    return { ok: true };
  }
}
