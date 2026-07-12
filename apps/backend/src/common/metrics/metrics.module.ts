import { Global, Module, forwardRef } from '@nestjs/common';
import { IadMetricsService } from './iad-metrics.service';
import { MqttModule } from '../../mqtt/mqtt.module';

@Global()
@Module({
  imports: [forwardRef(() => MqttModule)],
  providers: [IadMetricsService],
  exports: [IadMetricsService],
})
export class MetricsModule {}
