import { Module } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { CampaignDecisionService } from './campaign-decision.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [PrismaModule, MqttModule, DevicesModule],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignDecisionService],
  exports: [CampaignsService],
})
export class CampaignsModule {
  constructor(private readonly decisionService: CampaignDecisionService) {}
}
