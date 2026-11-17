import { Module } from '@nestjs/common';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';
import { MetaAdsClient } from './meta-ads.client';

/** Admin → Reklamlar: the shop's Meta ad account, read-only for now (phase 1: connect and watch). */
@Module({
  controllers: [AdsController],
  providers: [AdsService, MetaAdsClient],
})
export class AdsModule {}
