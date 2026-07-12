import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Counter, Histogram } from 'prom-client';
import { IadMetricsService } from './iad-metrics.service';

const requestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

const requestCounter = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly iadMetrics: IadMetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest();
    const res = ctx.getResponse();

    const method = req.method;
    const route = req.route ? req.route.path : req.path;

    // Do not log metrics for the metrics endpoint itself or health
    if (route === '/metrics' || route === '/api/v1/health') {
      return next.handle();
    }

    const endTimer = requestDuration.startTimer();

    return next.handle().pipe(
      tap({
        next: () => {
          const statusCode = res.statusCode;
          requestCounter.labels(method, route, statusCode.toString()).inc();
          this.iadMetrics.backendRequestsTotal.inc({ method, path: route });
          endTimer({ method, route, status_code: statusCode.toString() });
        },
        error: (error) => {
          const statusCode = error.status || 500;
          requestCounter.labels(method, route, statusCode.toString()).inc();
          this.iadMetrics.backendRequestsTotal.inc({ method, path: route });
          endTimer({ method, route, status_code: statusCode.toString() });
        },
      }),
    );
  }
}
