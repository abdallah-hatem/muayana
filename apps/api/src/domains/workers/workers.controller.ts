import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CsvResponse } from '../../common/decorators/csv-response.decorator';
import { ResponseUtil } from '../../common/utils/response.util';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import {
  WorkerExportQueryDto,
  WorkerListQueryDto,
} from './dto/worker-list-query.dto';
import { WorkersService } from './workers.service';

/** Workers (contract "Workers"). `export.csv` is declared before `:id` so it is not read as one. */
@Controller('workers')
export class WorkersController {
  constructor(private readonly workers: WorkersService) {}

  @Get()
  async list(@Query() query: WorkerListQueryDto) {
    return ResponseUtil.paginated(await this.workers.list(query));
  }

  /** The only non-envelope answer: `text/csv` with a BOM (contract header). */
  @Get('export.csv')
  @CsvResponse('workers.csv')
  exportCsv(@Query() query: WorkerExportQueryDto) {
    return this.workers.exportCsv(query);
  }

  @Post()
  create(@Body() dto: CreateWorkerDto) {
    return this.workers.create(dto);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.workers.get(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWorkerDto) {
    return this.workers.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.workers.remove(id);
  }
}
