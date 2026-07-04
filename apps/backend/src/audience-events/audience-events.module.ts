import { Module } from '@nestjs/common';
import { AudienceEventsService } from './audience-events.service';
import { AudienceEventsController } from './audience-events.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MqttModule } from '../mqtt/mqtt.module';

@Module({
  imports: [PrismaModule, MqttModule],
  controllers: [AudienceEventsController],
  providers: [AudienceEventsService],
  exports: [AudienceEventsService],
})
export class AudienceEventsModule {}
