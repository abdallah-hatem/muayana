import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardRepository } from './repositories/dashboard.repository';

/** The dashboard's counts (business §5.9). */
@Module({
  controllers: [DashboardController],
  providers: [DashboardService, DashboardRepository],
})
export class DashboardModule {}
