/* eslint-disable @typescript-eslint/no-explicit-any */
import { Controller, Get, Query, Req, Sse, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable, interval } from 'rxjs';
import { map, switchMap, startWith } from 'rxjs/operators';
import { KpisService } from './kpis.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SseRateLimiterGuard } from '../common/sse-rate-limiter.guard';

@Controller('stream/kpis')
@UseGuards(AuthGuard('jwt'), RolesGuard, SseRateLimiterGuard)
export class KpisController {
  constructor(private kpisService: KpisService) {}

  /**
   * SSE endpoint for live KPI streaming
   * 
   * Security:
   * - Requires JWT authentication (401 if missing/invalid)
   * - Requires L4 (Manager) or L5 (Owner) role (403 if unauthorized)
   * - Org-scoped: only streams data for authenticated user's org
   * - Rate limited: 60 req/min per user/IP, max 2 concurrent connections per user
   * 
   * Headers set:
   * - Content-Type: text/event-stream
   * - Cache-Control: no-cache  
   * - Connection: keep-alive
   * 
   * @param req - Request with authenticated user
   * @param scope - 'org' (default) or 'branch'
   * @param branchId - Optional branch filter
   * @returns Observable stream of KPI MessageEvents
   */
  @Get()
  @Roles('L4', 'L5')
  @Sse()
  streamKpis(
    @Req() req: any,
    @Query('scope') scope: string = 'org',
    @Query('branchId') branchId?: string,
  ): Observable<MessageEvent> {
    const orgId = req.user.orgId;
    const targetBranchId = branchId || req.user.branchId;

    // Send immediately, then every 15s for keepalive
    return interval(15000).pipe(
      startWith(0),
      switchMap(async () => {
        if (scope === 'branch' && targetBranchId) {
          return this.kpisService.getBranchKpis(orgId, targetBranchId);
        }
        return this.kpisService.getOrgKpis(orgId);
      }),
      map(
        (kpis) =>
          ({
            data: kpis,
          }) as MessageEvent,
      ),
    );
  }
}
