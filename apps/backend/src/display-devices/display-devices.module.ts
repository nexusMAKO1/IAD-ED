import { Module } from '@nestjs/common';
import { DisplayDevicesController } from './display-devices.controller';
import { DisplayDevicesService } from './display-devices.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MqttModule } from '../mqtt/mqtt.module';

@Module({
  imports: [PrismaModule, MqttModule],
  controllers: [DisplayDevicesController],
  providers: [DisplayDevicesService],
  exports: [DisplayDevicesService],
})
export class DisplayDevicesModule {}
