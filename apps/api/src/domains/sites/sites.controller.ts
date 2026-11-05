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
import { ResponseUtil } from '../../common/utils/response.util';
import { CreateSiteDto } from './dto/create-site.dto';
import { SiteListQueryDto } from './dto/site-list-query.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { SitesService } from './sites.service';

/** Sites (contract "Sites"). */
@Controller('sites')
export class SitesController {
  constructor(private readonly sites: SitesService) {}

  @Get()
  async list(@Query() query: SiteListQueryDto) {
    return ResponseUtil.paginated(await this.sites.list(query));
  }

  @Post()
  create(@Body() dto: CreateSiteDto) {
    return this.sites.create(dto);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.sites.get(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSiteDto) {
    return this.sites.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.sites.remove(id);
  }
}
