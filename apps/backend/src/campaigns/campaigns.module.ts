import { Module } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { CampaignDecisionService } from './campaign-decision.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MqttModule } from '../mqtt/mqtt.module';

@Module({
  imports: [PrismaModule, MqttModule],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignDecisionService],
  exports: [CampaignsService],
})
export class CampaignsModule {
  // Inject CampaignDecisionService to force its instantiation by NestJS
  // since it's not injected into any controllers/services but must listen to MQTT
  constructor(private readonly decisionService: CampaignDecisionService) {}
}
