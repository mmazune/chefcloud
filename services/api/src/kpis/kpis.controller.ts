/* eslint-disable @typescript-eslint/no-explicit-any */
import { Controller, Get, Query, Req, Sse, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable, interval } from 'rxjs';
import { map, switchMap, startWith } from 'rxjs/operators';
import { KpisService } from './kpis.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('stream/kpis')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class KpisController {
  constructor(private kpisService: KpisService) {}

  @Get()
  @Roles('L4')
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
