import { Module } from '@nestjs/common';
import { AdminSystemController, HealthController } from './health.controller';
import { InfraService } from './infra.service';

@Module({ controllers: [HealthController, AdminSystemController], providers: [InfraService] })
export class HealthModule {}
