import { Module } from '@nestjs/common';
import { EdgeDevicesService } from './edge-devices.service';
import { EdgeDevicesController } from './edge-devices.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { MqttModule } from '../../mqtt/mqtt.module';

@Module({
  imports: [PrismaModule, MqttModule],
  controllers: [EdgeDevicesController],
  providers: [EdgeDevicesService],
  exports: [EdgeDevicesService],
})
export class EdgeDevicesModule {}
