import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DomainErrorCode,
  ErrorCode,
  normalizeEgyptPhone,
  type Deleted,
  type Worker,
} from '@muayana/shared';
import { CLOCK, type Clock } from '../../common/clock/clock';
import type { Paginated } from '../../common/interfaces/api-response.interface';
import {
  domainConflict,
  isUniqueViolation,
} from '../../common/utils/domain-error.util';
import { tallyByKey } from '../../common/utils/issue-counts.util';
import { blankToNull } from '../../common/utils/text.util';
import { triStateWhere } from '../../common/utils/tri-state.util';
import { DatabaseService } from '../../database/database.service';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import {
  WorkerExportQueryDto,
  WorkerFilterDto,
  WorkerListQueryDto,
} from './dto/worker-list-query.dto';
import {
  WorkersRepository,
  type WorkerFilter,
  type WorkerRow,
} from './repositories/workers.repository';
import {
  newlyAddedInactive,
  phoneSearchDigits,
  toWorker,
  workersCsv,
} from './workers.pure';

const duplicatePhone = () =>
  domainConflict(
    DomainErrorCode.DUPLICATE,
    'Another worker already has this phone',
  );

function toFilter(query: WorkerFilterDto): WorkerFilter {
  const search = query.search || undefined;
  return {
    active: triStateWhere(query.active),
    categoryId: query.categoryId,
    search,
    phoneDigits: (search && phoneSearchDigits(search)) || undefined,
  };
}

@Injectable()
export class WorkersService {
  constructor(
    private readonly workers: WorkersRepository,
    private readonly db: DatabaseService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async list(query: WorkerListQueryDto): Promise<Paginated<Worker>> {
    const page = await this.workers.list(
      toFilter(query),
      query.page,
      query.limit,
    );
    return { ...page, data: await this.withCounts(page.data) };
  }

  /** Every worker matching the list filter, as a CSV in the requested language (business §7). */
  async exportCsv(query: WorkerExportQueryDto): Promise<string> {
    const rows = await this.workers.listAll(toFilter(query));
    return workersCsv(await this.withCounts(rows), query.lang);
  }

  async get(id: string): Promise<Worker> {
    const [worker] = await this.withCounts([await this.findOrThrow(id)]);
    return worker;
  }

  /** Phone stored as +20… and unique; at least one category, each active (§3, §6.11). */
  async create(dto: CreateWorkerDto): Promise<Worker> {
    const phone = await this.freePhone(dto.phone);
    const categoryIds = await this.checkCategories(dto.categoryIds, []);
    const row = await this.saving(() =>
      this.workers.create(
        { name: dto.name, phone, notes: blankToNull(dto.notes) },
        categoryIds,
      ),
    );
    return toWorker(row);
  }

  /**
   * Edits, (de)activation and category changes. Issues already assigned to him are untouched,
   * even when a category is removed (§3); categories newly added must be active.
   */
  async update(id: string, dto: UpdateWorkerDto): Promise<Worker> {
    const current = await this.findOrThrow(id);
    const phone =
      dto.phone === undefined ? undefined : await this.freePhone(dto.phone, id);
    const categoryIds =
      dto.categoryIds === undefined
        ? undefined
        : await this.checkCategories(
            dto.categoryIds,
            current.categories.map(({ category }) => category.id),
          );
    await this.saving(() =>
      this.db.transaction((tx) =>
        this.workers.update(
          id,
          {
            name: dto.name,
            phone,
            notes: blankToNull(dto.notes),
            active: dto.active,
          },
          categoryIds,
          tx,
        ),
      ),
    );
    return this.get(id);
  }

  /** A worker with issues is deactivated, never deleted (business §6.8). */
  async remove(id: string): Promise<Deleted> {
    await this.findOrThrow(id);
    if ((await this.workers.countIssues(id)) > 0)
      throw domainConflict(
        DomainErrorCode.IN_USE,
        'This worker has issues: deactivate him instead',
      );
    await this.workers.delete(id);
    return { id };
  }

  private async findOrThrow(id: string): Promise<WorkerRow> {
    const row = await this.workers.findById(id);
    if (!row) throw new NotFoundException('Worker not found');
    return row;
  }

  /** The phone in +20… form; refused when it is not one (400) or another worker has it (409). */
  private async freePhone(input: string, exceptId?: string): Promise<string> {
    const phone = normalizeEgyptPhone(input);
    if (!phone)
      throw new BadRequestException({
        message: 'phone must be an Egyptian phone number',
        error: ErrorCode.VALIDATION_FAILED,
      });
    if (await this.workers.findByPhone(phone, exceptId)) throw duplicatePhone();
    return phone;
  }

  /** De-duplicated ids; unknown ones are a 400, newly added inactive ones a 409. */
  private async checkCategories(
    ids: string[],
    current: string[],
  ): Promise<string[]> {
    const unique = [...new Set(ids)];
    const found = await this.workers.findCategories(unique);
    if (found.length !== unique.length)
      throw new BadRequestException({
        message: 'categoryIds contains an unknown category',
        error: ErrorCode.VALIDATION_FAILED,
      });
    if (newlyAddedInactive(found, current).length > 0)
      throw domainConflict(
        DomainErrorCode.INACTIVE_CATEGORY,
        'A deactivated category cannot be chosen',
      );
    return unique;
  }

  /** A write that can still lose a race to the unique phone index answers DUPLICATE. */
  private async saving<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (isUniqueViolation(error)) throw duplicatePhone();
      throw error;
    }
  }

  private async withCounts(rows: WorkerRow[]): Promise<Worker[]> {
    const { byStatus, overdue } = await this.workers.issueCounts(
      rows.map((row) => row.id),
      this.clock.now(),
    );
    const tallies = tallyByKey(byStatus);
    return rows.map((row) =>
      toWorker(row, tallies.get(row.id), overdue.get(row.id)),
    );
  }
}
