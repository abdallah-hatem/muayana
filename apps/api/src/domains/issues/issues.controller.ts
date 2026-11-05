import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PHOTO_MAX_BYTES } from '@muayana/shared';
import { CsvResponse } from '../../common/decorators/csv-response.decorator';
import { WithStatusInterceptor } from '../../common/interceptors/with-status.interceptor';
import { ResponseUtil } from '../../common/utils/response.util';
import {
  IssueExportQueryDto,
  IssueHistoryExportQueryDto,
} from './dto/issue-export.dto';
import { IssueListQueryDto } from './dto/issue-filter.dto';
import {
  AddPhotoDto,
  BulkIssuesDto,
  ChangeStatusDto,
  CreateIssueDto,
  MergeIssuesDto,
  UpdateIssueDto,
} from './dto/issue-requests.dto';
import { IssuesExportService } from './issues-export.service';
import { IssuesService, type UploadedPhoto } from './issues.service';

/** One `photo` file per request, in memory, refused with 413 above 4 MB (contract). */
const photoUpload = () =>
  FileInterceptor('photo', {
    limits: { fileSize: PHOTO_MAX_BYTES, files: 1, fields: 10 },
  });

const uuid = new ParseUUIDPipe();

/**
 * Issues (contract "Issues"). Every route needs the engineer's token (global guard). The CSV
 * routes are declared before `:id` so they are not read as one.
 */
@Controller('issues')
export class IssuesController {
  constructor(
    private readonly issues: IssuesService,
    private readonly exports: IssuesExportService,
  ) {}

  @Post()
  @UseInterceptors(photoUpload(), WithStatusInterceptor)
  create(
    @Body() dto: CreateIssueDto,
    @UploadedFile() photo: UploadedPhoto | undefined,
  ) {
    return this.issues.create(dto, photo);
  }

  @Get()
  async list(@Query() query: IssueListQueryDto) {
    return ResponseUtil.paginated(await this.issues.list(query));
  }

  /** Every issue matching the list filter, chosen columns, header language (business §7). */
  @Get('export.csv')
  @CsvResponse('issues.csv')
  exportCsv(@Query() query: IssueExportQueryDto) {
    return this.exports.issuesCsv(query);
  }

  /** Every status change of the issues matching the list filter (business §7). */
  @Get('history.csv')
  @CsvResponse('status-history.csv')
  historyCsv(@Query() query: IssueHistoryExportQueryDto) {
    return this.exports.historyCsv(query);
  }

  @Post('bulk')
  @HttpCode(200)
  bulk(@Body() dto: BulkIssuesDto) {
    return this.issues.bulk(dto);
  }

  @Get(':id')
  findOne(@Param('id', uuid) id: string) {
    return this.issues.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', uuid) id: string, @Body() dto: UpdateIssueDto) {
    return this.issues.update(id, dto);
  }

  @Post(':id/status')
  @HttpCode(200)
  changeStatus(@Param('id', uuid) id: string, @Body() dto: ChangeStatusDto) {
    return this.issues.changeStatus(id, dto);
  }

  @Post(':id/photos')
  @HttpCode(201)
  @UseInterceptors(photoUpload())
  addPhoto(
    @Param('id', uuid) id: string,
    @Body() dto: AddPhotoDto,
    @UploadedFile() photo: UploadedPhoto | undefined,
  ) {
    return this.issues.addPhoto(id, dto.kind, photo);
  }

  @Delete(':id/photos/:photoId')
  deletePhoto(
    @Param('id', uuid) id: string,
    @Param('photoId', uuid) photoId: string,
  ) {
    return this.issues.deletePhoto(id, photoId);
  }

  @Post(':id/merge')
  @HttpCode(200)
  merge(@Param('id', uuid) id: string, @Body() dto: MergeIssuesDto) {
    return this.issues.merge(id, dto.sourceId);
  }

  @Delete(':id')
  remove(@Param('id', uuid) id: string) {
    return this.issues.remove(id);
  }
}
