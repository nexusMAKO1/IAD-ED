/**
 * devices.controller.ts — Unified Devices REST API
 *
 * GET    /devices                     List all (with optional filters)
 * GET    /devices/:id                 Get one device (with metadata)
 * PATCH  /devices/:id                 Update name / siteId / status
 * POST   /devices/:id/assign-site     Assign to a site
 * POST   /devices/:id/unpair          Unassign from site
 * POST   /devices/:id/restart         Send restart command (cameras / displays)
 * POST   /devices/:id/settings        Update camera detection settings
 * DELETE /devices/:id                 Delete a device
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { DeviceType, DeviceStatus, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { DevicesService } from './devices.service';

@ApiTags('Devices')
@Controller('devices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  // ─── List ─────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all devices (supports type/siteId/status filters)' })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({ name: 'type', required: false, enum: DeviceType })
  @ApiQuery({ name: 'status', required: false, enum: DeviceStatus })
  @ApiQuery({ name: 'unassigned', required: false, type: Boolean })
  findAll(
    @Query('siteId') siteId?: string,
    @Query('type') type?: DeviceType,
    @Query('status') status?: DeviceStatus,
    @Query('unassigned') unassigned?: string,
  ) {
    return this.devicesService.findAll({
      siteId,
      type,
      status,
      unassigned: unassigned === 'true',
    });
  }

  // ─── Get one ──────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get a single device with full metadata' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.devicesService.findOne(id);
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update device name / siteId / status' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, any>,
  ) {
    return this.devicesService.update(id, body);
  }

  // ─── Assign site ──────────────────────────────────────────────────────────

  @Post(':id/assign-site')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Assign device to a site' })
  @HttpCode(HttpStatus.OK)
  assignSite(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { siteId: string; zoneId?: string; screenId?: string },
  ) {
    return this.devicesService.assignSite(id, body.siteId, body);
  }

  // ─── Unpair ───────────────────────────────────────────────────────────────

  @Post(':id/unpair')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Unassign device from its site' })
  @HttpCode(HttpStatus.OK)
  unpair(@Param('id', ParseUUIDPipe) id: string) {
    return this.devicesService.unpair(id);
  }

  // ─── Restart ──────────────────────────────────────────────────────────────

  @Post(':id/restart')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Send restart command to device' })
  @HttpCode(HttpStatus.OK)
  restart(@Param('id', ParseUUIDPipe) id: string) {
    return this.devicesService.restartDevice(id);
  }

  // ─── Camera settings ──────────────────────────────────────────────────────

  @Post(':id/settings')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update camera detection settings' })
  @HttpCode(HttpStatus.OK)
  updateSettings(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, any>,
  ) {
    return this.devicesService.updateCameraSettings(id, body);
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete a device' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.devicesService.remove(id);
  }
}
