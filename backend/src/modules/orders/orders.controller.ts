import { Body, Controller, Delete, Get, Header, Headers, HttpCode, Param, Patch, Post, Put, Query, RawBodyRequest, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ClientIp } from '../../common/decorators/client-ip.decorator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Lang } from '../../common/decorators/lang.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ADMIN_ROLES, Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { Locale } from '../../common/utils/i18n.util';
import { CheckoutService } from './checkout.service';
import {
  AdminOrderQueryDto,
  AdminReturnQueryDto,
  CheckoutDto,
  OrderLookupDto,
  OrderNoteDto,
  RetryPaymentDto,
  ReturnRequestDto,
  ShipOrderDto,
  UpdateOrderStatusDto,
  StripeKeyDto,
  UpdateReturnDto,
} from './dto/orders.dto';
import { StripeClient } from './stripe.client';
import { OrdersService } from './orders.service';

@ApiTags('Checkout & Orders')
@Controller()
export class OrdersController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly orders: OrdersService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('checkout')
  placeOrder(
    @CurrentUser() user: AuthUser | undefined,
    @Headers('x-cart-token') cartToken: string | undefined,
    @Body() dto: CheckoutDto,
    @ClientIp() ip: string,
    @Lang() lang: Locale,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.checkout.checkout(user ? { userId: user.id } : { guestToken: cartToken }, user, dto, ip, lang, idempotencyKey);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('orders/:orderNumber/pay')
  retryPayment(@Param('orderNumber') orderNumber: string, @CurrentUser() user: AuthUser | undefined, @Body() dto: RetryPaymentDto, @ClientIp() ip: string) {
    return this.checkout.retryPayment(orderNumber, user, dto.email, ip);
  }

  /** iyzico redirects the shopper's browser here (form POST with `token`). */
  @Public()
  @SkipThrottle()
  @ApiExcludeEndpoint()
  @HttpCode(302)
  @Post('payments/iyzico/callback')
  async iyzicoCallback(@Body('token') token: string | undefined, @Res() res: Response) {
    res.redirect(302, await this.checkout.handleIyzicoCallback(token));
  }

  /** Stripe's success_url: the shopper's browser comes back here with the session id. */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiExcludeEndpoint()
  @Get('payments/stripe/return')
  async stripeReturn(@Query('session_id') sessionId: string | undefined, @Res() res: Response) {
    res.redirect(302, await this.checkout.handleStripeReturn(typeof sessionId === 'string' ? sessionId : undefined));
  }

  /** Stripe → us, signed (Stripe-Signature over the raw body). Events: checkout.session.*. */
  @Public()
  @SkipThrottle()
  @ApiExcludeEndpoint()
  @HttpCode(200)
  @Post('payments/stripe/webhook')
  async stripeWebhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature: string | undefined) {
    await this.checkout.handleStripeWebhook(req.rawBody, signature);
    return { received: true };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('orders/lookup')
  lookup(@Body() dto: OrderLookupDto) {
    return this.orders.lookup(dto.orderNumber, dto.email);
  }

  @ApiBearerAuth()
  @Get('me/orders')
  myOrders(@CurrentUser() user: AuthUser, @Query() q: PaginationQueryDto) {
    return this.orders.myOrders(user.id, q);
  }

  @ApiBearerAuth()
  @Get('me/orders/:orderNumber')
  myOrder(@CurrentUser() user: AuthUser, @Param('orderNumber') orderNumber: string) {
    return this.orders.myOrder(user.id, orderNumber);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('orders/:orderNumber/returns')
  requestReturn(@Param('orderNumber') orderNumber: string, @CurrentUser() user: AuthUser | undefined, @Body() dto: ReturnRequestDto) {
    return this.orders.requestReturn(orderNumber, user, dto);
  }
}

@ApiTags('Admin · Orders')
@ApiBearerAuth()
@Roles(...ADMIN_ROLES)
@Controller('admin')
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get('orders')
  list(@Query() q: AdminOrderQueryDto) {
    return this.orders.adminList(q);
  }

  @Get('orders/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="maeyja-siparisler.csv"')
  async export(@Query() q: AdminOrderQueryDto, @Res() res: Response) {
    res.send(await this.orders.exportCsv(q));
  }

  @Get('orders/:id')
  get(@Param('id') id: string) {
    return this.orders.adminGet(id);
  }

  @Patch('orders/:id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto, @CurrentUser() actor: AuthUser, @ClientIp() ip: string) {
    return this.orders.updateStatus(id, dto, actor, ip);
  }

  @Post('orders/:id/ship')
  ship(@Param('id') id: string, @Body() dto: ShipOrderDto, @CurrentUser() actor: AuthUser) {
    return this.orders.ship(id, dto, actor);
  }

  @Patch('orders/:id/note')
  note(@Param('id') id: string, @Body() dto: OrderNoteDto) {
    return this.orders.setNote(id, dto.adminNote);
  }

  @Get('returns')
  returns(@Query() q: AdminReturnQueryDto) {
    return this.orders.adminReturns(q);
  }

  @Patch('returns/:id')
  updateReturn(@Param('id') id: string, @Body() dto: UpdateReturnDto) {
    return this.orders.updateReturn(id, dto);
  }
}

/** Admin → Ayarlar → Kartla ödeme: the Stripe key is pasted here; the webhook is set up with it. */
@ApiTags('Admin · Payments')
@ApiBearerAuth()
@Roles(...ADMIN_ROLES)
@Controller('admin/payments/stripe')
export class AdminPaymentsController {
  constructor(private readonly stripe: StripeClient) {}

  @Get()
  status() {
    return this.stripe.status();
  }

  // Audit log keeps the change; `secretKey` is redacted there like every *secret* field.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Put()
  connect(@Body() dto: StripeKeyDto, @CurrentUser() user: AuthUser) {
    return this.stripe.connect(dto.secretKey, user.id);
  }

  @Delete()
  disconnect() {
    return this.stripe.disconnect();
  }
}
