import { Controller, Sse, MessageEvent, Req } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { map, delay } from 'rxjs/operators';

@Controller('sse-test')
export class SseTestController {
  @Sse('stream')
  stream(@Req() req: any): Observable<MessageEvent> {
    // Simulate production SSE: emit a single event quickly, then complete.
    // Put something deterministic in the payload for assertions.
    const requestId = (req.headers['x-request-id'] as string) || 'req-test';
    return of({ ok: true, kind: 'smoke', requestId }).pipe(
      delay(10),
      map(data => ({ data }))
    );
  }
}
