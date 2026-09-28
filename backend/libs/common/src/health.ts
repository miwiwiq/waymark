import { Controller, Get, type Type } from '@nestjs/common';

/** GET /api/<prefix>/health, used by the Compose healthchecks and smoke tests. */
export function healthController(prefix: string): Type {
  @Controller(prefix)
  class HealthController {
    @Get('health')
    health() {
      return { status: 'ok' };
    }
  }
  return HealthController;
}
