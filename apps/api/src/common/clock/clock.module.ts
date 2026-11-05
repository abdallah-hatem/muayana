import { Global, Module } from '@nestjs/common';
import { CLOCK, systemClock } from './clock';

/** Provides CLOCK app-wide (the system clock; e2e overrides it). */
@Global()
@Module({
  providers: [{ provide: CLOCK, useValue: systemClock }],
  exports: [CLOCK],
})
export class ClockModule {}
