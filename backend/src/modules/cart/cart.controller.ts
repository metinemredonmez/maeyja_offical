import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Res } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';
import { Response } from 'express';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Lang } from '../../common/decorators/lang.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Locale } from '../../common/utils/i18n.util';
import { CartOwner, CartService } from './cart.service';

class AddItemDto {
  @IsString() variantId: string;
  @IsInt() @Min(1) @Max(20) quantity: number;
}
class QuantityDto {
  @IsInt() @Min(0) @Max(20) quantity: number;
}
class CouponCodeDto {
  @IsString() @MaxLength(32) code: string;
}
class MergeDto {
  @IsString() @MaxLength(64) cartToken: string;
}

/**
 * Guests are identified by the `X-Cart-Token` header (returned as `cartToken` on first add);
 * logged-in users by their access token.
 */
@ApiTags('Cart')
@ApiHeader({ name: 'X-Cart-Token', required: false })
@Public()
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  get(@CurrentUser() user: AuthUser | undefined, @Headers('x-cart-token') token: string | undefined, @Lang() lang: Locale) {
    return this.cart.get(this.owner(user, token), lang, user?.email);
  }

  @Post('items')
  async add(
    @CurrentUser() user: AuthUser | undefined,
    @Headers('x-cart-token') token: string | undefined,
    @Body() dto: AddItemDto,
    @Lang() lang: Locale,
    @Res({ passthrough: true }) res: Response,
  ) {
    const view = await this.cart.addItem(this.owner(user, token), dto.variantId, dto.quantity, lang);
    if (view.cartToken) res.setHeader('X-Cart-Token', view.cartToken);
    return view;
  }

  @Patch('items/:variantId')
  setQuantity(
    @CurrentUser() user: AuthUser | undefined,
    @Headers('x-cart-token') token: string | undefined,
    @Param('variantId') variantId: string,
    @Body() dto: QuantityDto,
    @Lang() lang: Locale,
  ) {
    return this.cart.setQuantity(this.owner(user, token), variantId, dto.quantity, lang);
  }

  @Delete('items/:variantId')
  remove(
    @CurrentUser() user: AuthUser | undefined,
    @Headers('x-cart-token') token: string | undefined,
    @Param('variantId') variantId: string,
    @Lang() lang: Locale,
  ) {
    return this.cart.removeItem(this.owner(user, token), variantId, lang);
  }

  @Post('coupon')
  applyCoupon(
    @CurrentUser() user: AuthUser | undefined,
    @Headers('x-cart-token') token: string | undefined,
    @Body() dto: CouponCodeDto,
    @Lang() lang: Locale,
  ) {
    return this.cart.applyCoupon(this.owner(user, token), dto.code, lang, user?.email);
  }

  @Delete('coupon')
  removeCoupon(@CurrentUser() user: AuthUser | undefined, @Headers('x-cart-token') token: string | undefined, @Lang() lang: Locale) {
    return this.cart.removeCoupon(this.owner(user, token), lang);
  }

  @Delete()
  clear(@CurrentUser() user: AuthUser | undefined, @Headers('x-cart-token') token: string | undefined) {
    return this.cart.clear(this.owner(user, token));
  }

  /** Call right after login/register with the guest token the client was holding. */
  @Post('merge')
  merge(@CurrentUser() user: AuthUser | undefined, @Body() dto: MergeDto, @Lang() lang: Locale) {
    if (!user) return this.cart.get({ guestToken: dto.cartToken }, lang);
    return this.cart.merge(user.id, dto.cartToken, lang);
  }

  private owner(user: AuthUser | undefined, token: string | undefined): CartOwner {
    return user ? { userId: user.id } : { guestToken: token };
  }
}
