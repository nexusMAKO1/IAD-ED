import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AlertsService } from './alerts.service';

@ApiTags('Alerts')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @ApiOperation({ summary: 'List system and device alerts' })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({ name: 'severity', required: false })
  @ApiQuery({ name: 'acknowledged', required: false, type: Boolean })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('siteId') siteId?: string,
    @Query('severity') severity?: string,
    @Query('acknowledged') acknowledged?: string,
    @Query('limit') limit?: string,
  ) {
    return this.alertsService.findAll({
      siteId,
      severity,
      acknowledged: acknowledged !== undefined ? acknowledged === 'true' : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific alert' })
  findOne(@Param('id') id: string) {
    return this.alertsService.findOne(id);
  }

  @Patch(':id/acknowledge')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Acknowledge an alert with authenticated operator identity (fixes X-Operator-Id spoofing)',
  })
  acknowledge(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.alertsService.acknowledge(id, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an alert' })
  async delete(@Param('id') id: string) {
    await this.alertsService.delete(id);
  }
}
