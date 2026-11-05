import { Module } from '@nestjs/common';
import { SitesRepository } from './repositories/sites.repository';
import { SitesController } from './sites.controller';
import { SitesService } from './sites.service';

@Module({
  controllers: [SitesController],
  providers: [SitesService, SitesRepository],
  exports: [SitesService],
})
export class SitesModule {}
