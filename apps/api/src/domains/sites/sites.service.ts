import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  DomainErrorCode,
  nameKey,
  type Deleted,
  type Site,
} from '@muayana/shared';
import { CLOCK, type Clock } from '../../common/clock/clock';
import type { Paginated } from '../../common/interfaces/api-response.interface';
import type { Tx } from '../../common/interfaces/transaction.interface';
import { domainConflict } from '../../common/utils/domain-error.util';
import { tallyByKey } from '../../common/utils/issue-counts.util';
import { blankToNull } from '../../common/utils/text.util';
import { triStateWhere } from '../../common/utils/tri-state.util';
import { DatabaseService } from '../../database/database.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { SiteListQueryDto } from './dto/site-list-query.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { SitesRepository, type SiteRow } from './repositories/sites.repository';
import { needsNameCheck, toSite } from './sites.pure';

@Injectable()
export class SitesService {
  constructor(
    private readonly sites: SitesRepository,
    private readonly db: DatabaseService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async list(query: SiteListQueryDto): Promise<Paginated<Site>> {
    const page = await this.sites.list({
      archived: triStateWhere(query.archived),
      search: query.search || undefined,
      page: query.page,
      limit: query.limit,
    });
    return { ...page, data: await this.withCounts(page.data) };
  }

  async get(id: string): Promise<Site> {
    const [site] = await this.withCounts([await this.findOrThrow(id)]);
    return site;
  }

  /** Name unique among non-archived sites, ignoring case and spaces (business §3). */
  async create(dto: CreateSiteDto): Promise<Site> {
    const key = nameKey(dto.name);
    const row = await this.db.transaction(async (tx) => {
      await this.assertNameFree(key, undefined, tx);
      return this.sites.create(
        {
          name: dto.name,
          nameKey: key,
          address: blankToNull(dto.address),
          notes: blankToNull(dto.notes),
        },
        tx,
      );
    });
    return toSite(row);
  }

  /** Renaming or unarchiving into a name another non-archived site uses is refused (§3). */
  async update(id: string, dto: UpdateSiteDto): Promise<Site> {
    await this.db.transaction(async (tx) => {
      const current = await this.findOrThrow(id, tx);
      const next = {
        nameKey: nameKey(dto.name ?? current.name),
        archived: dto.archived ?? current.archived,
      };
      if (
        needsNameCheck(
          { nameKey: nameKey(current.name), archived: current.archived },
          next,
        )
      )
        await this.assertNameFree(next.nameKey, id, tx);
      await this.sites.update(
        id,
        {
          name: dto.name,
          nameKey: dto.name === undefined ? undefined : next.nameKey,
          address: blankToNull(dto.address),
          notes: blankToNull(dto.notes),
          archived: dto.archived,
        },
        tx,
      );
    });
    return this.get(id);
  }

  /** A site with issues is archived, never deleted (business §6.8). */
  async remove(id: string): Promise<Deleted> {
    await this.findOrThrow(id);
    if ((await this.sites.countIssues(id)) > 0)
      throw domainConflict(
        DomainErrorCode.IN_USE,
        'This site has issues: archive it instead',
      );
    await this.sites.delete(id);
    return { id };
  }

  private async findOrThrow(id: string, tx?: Tx): Promise<SiteRow> {
    const row = await this.sites.findById(id, tx);
    if (!row) throw new NotFoundException('Site not found');
    return row;
  }

  private async assertNameFree(
    key: string,
    exceptId: string | undefined,
    tx: Tx,
  ): Promise<void> {
    await this.sites.lockNameKey(key, tx);
    if (await this.sites.findActiveByNameKey(key, exceptId, tx))
      throw domainConflict(
        DomainErrorCode.DUPLICATE,
        'Another site already has this name',
      );
  }

  private async withCounts(rows: SiteRow[]): Promise<Site[]> {
    const { byStatus, overdue } = await this.sites.issueCounts(
      rows.map((row) => row.id),
      this.clock.now(),
    );
    const tallies = tallyByKey(byStatus);
    return rows.map((row) =>
      toSite(row, tallies.get(row.id), overdue.get(row.id)),
    );
  }
}
