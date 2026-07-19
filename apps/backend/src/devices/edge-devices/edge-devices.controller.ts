import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { EdgeDevicesService } from './edge-devices.service';

@Controller('edge-devices')
export class EdgeDevicesController {
  constructor(private readonly edgeDevicesService: EdgeDevicesService) { }

  @Get()
  findAll() {
    return this.edgeDevicesService.findAll();
  }

  @Get('unpaired')
  findUnpaired() {
    return this.edgeDevicesService.findUnpaired();
  }

  @Patch(':id/pair')
  pair(@Param('id') id: string, @Body() body: { siteId: string; zoneId: string }) {
    return this.edgeDevicesService.pair(id, body.siteId, body.zoneId);
  }

  @Patch(':id/unpair')
  unpair(@Param('id') id: string) {
    return this.edgeDevicesService.unpair(id);
  }

  @Get('discovered')
  findDiscovered() {
    return this.edgeDevicesService.findUnpaired();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.edgeDevicesService.findOne(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.edgeDevicesService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.edgeDevicesService.update(id, body);
  }

  @Post(':id/assign-site')
  assignSite(@Param('id') id: string, @Body() body: { siteId: string; zoneId?: string }) {
    return this.edgeDevicesService.pair(id, body.siteId, body.zoneId ?? '');
  }

  @Post(':id/settings')
  updateSettings(@Param('id') id: string, @Body() settings: any) {
    return this.edgeDevicesService.updateSettings(id, settings);
  }

  @Post(':id/restart')
  restart(@Param('id') id: string) {
    return this.edgeDevicesService.restart(id);
  }

  @Get(':id/metrics')
  getMetrics(@Param('id') id: string) {
    return this.edgeDevicesService.getMetrics(id);
  }

  @Get(':id/heartbeat')
  getHeartbeat(@Param('id') id: string) {
    return this.edgeDevicesService.getHeartbeat(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.edgeDevicesService.remove(id);
  }
}
