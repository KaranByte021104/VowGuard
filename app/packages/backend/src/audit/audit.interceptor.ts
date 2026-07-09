import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService, private alertsService: AlertsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url, user, ip } = req;

    return next.handle().pipe(
      tap(async (data) => {
        // Only log mutating requests (POST, PUT, PATCH, DELETE)
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
          try {
            let action = `${method} ${url.split('?')[0]}`;
            let organizationId = user?.organizationId;
            let userId = user?.id;
            let resourceId = null;

            // Simple heuristic to extract resource ID from URL if present
            const parts = url.split('/');
            if (parts.length > 2 && parts[parts.length - 1].length > 10) {
               resourceId = parts[parts.length - 1]; // likely a UUID
            }

            // Fallback for organizationId if user is not attached (e.g. login, signup)
            if (!organizationId && data && data.user) {
               organizationId = data.user.organizationId;
               userId = data.user.id;
            } else if (!organizationId && req.body?.organizationId) {
               organizationId = req.body.organizationId;
            }

            if (organizationId) {
              const logEntry = await this.prisma.auditLog.create({
                data: {
                  action,
                  userId,
                  organizationId,
                  ipAddress: ip,
                  details: JSON.stringify({ body: req.body, query: req.query }),
                  resourceId
                }
              });
              
              // Trigger alerts based on this audit log
              await this.alertsService.processAuditLog(logEntry);
            }
          } catch (error) {
            console.error('Failed to write audit log:', error);
          }
        }
      }),
    );
  }
}
