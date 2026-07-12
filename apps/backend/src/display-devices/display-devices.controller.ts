import { Controller, Get, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { DisplayDevicesService } from './display-devices.service';
import { DisplayStatus } from '@prisma/client';

@Controller('display-devices')
export class DisplayDevicesController {
  constructor(private readonly displayService: DisplayDevicesService) {}

  @Get()
  async findAll(
    @Query('status') status?: DisplayStatus,
    @Query('siteId') siteId?: string,
  ) {
    return this.displayService.findAll({ status, siteId });
  }

  @Get('unpaired')
  async getUnpaired() {
    return this.displayService.getUnpaired();
  }

  @Patch(':id/pair')
  async pair(
    @Param('id') id: string,
    @Body('siteId') siteId: string,
    @Body('screenId') screenId?: string,
  ) {
    return this.displayService.pair(id, siteId, screenId);
  }

  @Patch(':id/unpair')
  async unpair(@Param('id') id: string) {
    return this.displayService.unpair(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.displayService.remove(id);
  }
}
