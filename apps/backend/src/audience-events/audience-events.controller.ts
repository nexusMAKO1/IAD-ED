import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AudienceEventsService } from './audience-events.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Audience Events')
@Controller('sites/:siteId')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AudienceEventsController {
  constructor(private readonly audienceEventsService: AudienceEventsService) {}

  @Get('statistics')
  @ApiOperation({ summary: 'Get aggregated statistics for a site' })
  getStatistics(@Param('siteId', ParseUUIDPipe) siteId: string) {
    return this.audienceEventsService.getLatestStats(siteId);
  }

  @Get('audience-events')
  @ApiOperation({ summary: 'Get recent audience events for a site' })
  getEvents(@Param('siteId', ParseUUIDPipe) siteId: string) {
    return this.audienceEventsService.getEvents(siteId);
  }
  @Get('demographics')
  @ApiOperation({ summary: 'Get demographic analytics for a site' })
  getDemographics(@Param('siteId', ParseUUIDPipe) siteId: string) {
    return this.audienceEventsService.getDemographics(siteId);
  }

  @Get('timeseries')
  @ApiOperation({ summary: 'Get visitor timeseries data for a site' })
  getTimeseries(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Query('granularity') granularity?: 'minute' | 'hour' | 'day',
  ) {
    return this.audienceEventsService.getTimeseries(
      siteId,
      granularity || 'hour',
    );
  }
}
