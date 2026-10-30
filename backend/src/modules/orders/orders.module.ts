import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { CheckoutService } from './checkout.service';
import { IyzicoClient } from './iyzico.client';
import { OrderLifecycleService } from './order-lifecycle.service';
import { AdminOrdersController, OrdersController } from './orders.controller';
import { PurchaseTrackingService } from './purchase-tracking.service';
import { OrdersJobs } from './orders.jobs';
import { OrdersService } from './orders.service';

@Module({
  imports: [CartModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [CheckoutService, OrdersService, OrderLifecycleService, PurchaseTrackingService, IyzicoClient, OrdersJobs],
  exports: [OrderLifecycleService],
})
export class OrdersModule {}
