import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { CheckoutService } from './checkout.service';
import { IyzicoClient } from './iyzico.client';
import { OrderLifecycleService } from './order-lifecycle.service';
import { AdminOrdersController, AdminPaymentsController, OrdersController } from './orders.controller';
import { PurchaseTrackingService } from './purchase-tracking.service';
import { OrdersJobs } from './orders.jobs';
import { OrdersService } from './orders.service';
import { StripeClient } from './stripe.client';

@Module({
  imports: [CartModule],
  controllers: [OrdersController, AdminOrdersController, AdminPaymentsController],
  providers: [CheckoutService, OrdersService, OrderLifecycleService, PurchaseTrackingService, IyzicoClient, StripeClient, OrdersJobs],
  exports: [OrderLifecycleService],
})
export class OrdersModule {}
