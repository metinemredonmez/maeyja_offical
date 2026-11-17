import { Module } from '@nestjs/common';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { MailAutomationsController } from './automations.controller';
import { MailAutomationsService } from './automations.service';

@Module({
  controllers: [CampaignsController, MailAutomationsController],
  providers: [CampaignsService, MailAutomationsService],
})
export class CampaignsModule {}
