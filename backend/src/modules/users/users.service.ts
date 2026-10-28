import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { paginate, skipTake } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { publicUser } from '../auth/auth.service';
import { AddressDto, AdminUpdateUserDto, AdminUserQueryDto, CreateStaffDto, UpdateAddressDto, UpdateProfileDto } from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────── self-service ───────────

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: dto });
    if (dto.marketingOptIn !== undefined) {
      await this.prisma.newsletterSubscriber.upsert({
        where: { email: user.email },
        create: { email: user.email, locale: user.locale, source: 'account', unsubscribedAt: dto.marketingOptIn ? null : new Date() },
        update: { unsubscribedAt: dto.marketingOptIn ? null : new Date() },
      });
    }
    return publicUser(user);
  }

  /** KVKK/GDPR erasure: anonymise the account but keep orders (legal retention). */
  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await this.prisma.$transaction([
      this.prisma.address.deleteMany({ where: { userId } }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
      this.prisma.wishlistItem.deleteMany({ where: { userId } }),
      this.prisma.cart.deleteMany({ where: { userId } }),
      this.prisma.userDevice.updateMany({ where: { userId }, data: { userId: null, isActive: false } }),
      this.prisma.newsletterSubscriber.deleteMany({ where: { email: user.email } }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          email: `deleted-${userId}@deleted.maeyja`,
          passwordHash: null,
          firstName: null,
          lastName: null,
          phone: null,
          isActive: false,
          marketingOptIn: false,
          deletedAt: new Date(),
        },
      }),
    ]);
    return { ok: true };
  }

  listAddresses(userId: string) {
    return this.prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
  }

  async createAddress(userId: string, dto: AddressDto) {
    const count = await this.prisma.address.count({ where: { userId } });
    if (count >= 20) throw new BadRequestException('En fazla 20 adres kaydedebilirsiniz');
    const isDefault = dto.isDefault ?? count === 0;
    return this.prisma.$transaction(async (tx) => {
      if (isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.create({ data: { ...dto, userId, isDefault } });
    });
  }

  async updateAddress(userId: string, id: string, dto: UpdateAddressDto) {
    await this.ownAddress(userId, id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.update({ where: { id }, data: dto });
    });
  }

  async deleteAddress(userId: string, id: string) {
    await this.ownAddress(userId, id);
    await this.prisma.address.delete({ where: { id } });
    return { ok: true };
  }

  private async ownAddress(userId: string, id: string) {
    const address = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!address) throw new NotFoundException('Adres bulunamadı');
    return address;
  }

  // ─────────── admin ───────────

  async adminList(q: AdminUserQueryDto) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(q.role ? { role: q.role } : {}),
      ...(q.q
        ? {
            OR: [
              { email: { contains: q.q, mode: 'insensitive' } },
              { firstName: { contains: q.q, mode: 'insensitive' } },
              { lastName: { contains: q.q, mode: 'insensitive' } },
              { phone: { contains: q.q } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...skipTake(q),
        include: { _count: { select: { orders: true } } },
      }),
      this.prisma.user.count({ where }),
    ]);
    const items = rows.map((u) => ({ ...publicUser(u), isActive: u.isActive, lastLoginAt: u.lastLoginAt, orderCount: u._count.orders }));
    return paginate(items, total, q.page, q.limit);
  }

  async adminGet(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        addresses: true,
        orders: { orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, orderNumber: true, status: true, total: true, createdAt: true } },
      },
    });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
    const spent = await this.prisma.order.aggregate({
      where: { userId: id, status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } },
      _sum: { total: true },
    });
    return {
      ...publicUser(user),
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      addresses: user.addresses,
      orders: user.orders,
      totalSpent: spent._sum.total ?? 0,
    };
  }

  async adminUpdate(actor: AuthUser, id: string, dto: AdminUpdateUserDto) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('Kullanıcı bulunamadı');
    const touchesStaff = (dto.role && dto.role !== UserRole.CUSTOMER) || target.role !== UserRole.CUSTOMER;
    if ((dto.role !== undefined || dto.isActive !== undefined) && touchesStaff && actor.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Yönetici hesaplarını yalnızca süper admin değiştirebilir');
    }
    if (id === actor.id && (dto.role !== undefined || dto.isActive === false)) {
      throw new BadRequestException('Kendi rolünüzü veya durumunuzu değiştiremezsiniz');
    }
    const user = await this.prisma.user.update({ where: { id }, data: dto });
    if (dto.isActive === false || dto.role !== undefined) {
      // Force re-login so new permissions apply immediately after the access token expires.
      await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    return { ...publicUser(user), isActive: user.isActive };
  }

  async createStaff(dto: CreateStaffDto) {
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await bcrypt.hash(dto.password, 12),
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        emailVerifiedAt: new Date(),
      },
    });
    return publicUser(user);
  }
}
