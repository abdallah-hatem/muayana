import { Module } from '@nestjs/common';
import { WorkersRepository } from './repositories/workers.repository';
import { WorkersController } from './workers.controller';
import { WorkersService } from './workers.service';

@Module({
  controllers: [WorkersController],
  providers: [WorkersService, WorkersRepository],
  exports: [WorkersService],
})
export class WorkersModule {}
