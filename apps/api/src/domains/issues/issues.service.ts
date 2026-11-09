import {
  BadRequestException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DomainErrorCode,
  ErrorCode,
  PHOTOS_PER_KIND_MAX,
  applyPatch,
  planCapture,
  type BulkIssuesResponse,
  type Deleted,
  type Issue,
  type IssueDetail,
  type IssuePatch,
  type IssueState,
  type PhotoKind,
  type Requirement,
  type StatusMove,
} from '@muayana/shared';
import { randomUUID } from 'node:crypto';
import { CLOCK, type Clock } from '../../common/clock/clock';
import { WithStatus } from '../../common/interceptors/with-status.interceptor';
import type { Paginated } from '../../common/interfaces/api-response.interface';
import type { Tx } from '../../common/interfaces/transaction.interface';
import {
  PHOTO_STORAGE,
  type PhotoStorage,
  type StoredFile,
} from '../../common/storage/photo-storage.interface';
import { sniffImageType, toStoredImage } from '../../common/utils/image.util';
import {
  buildIssueWhere,
  dateOnlyToDb,
  issueOrderBy,
} from '../../common/utils/issue-filter.util';
import { pageWindow, toPage } from '../../common/utils/pagination.util';
import { issuePhotoKey } from '../../common/utils/upload-dir.util';
import type { IssueListQueryDto } from './dto/issue-filter.dto';
import type {
  BulkIssuesDto,
  ChangeStatusDto,
  CreateIssueDto,
  UpdateIssueDto,
} from './dto/issue-requests.dto';
import {
  firstReachedStamp,
  planMove,
  ruleConflict,
  toIssue,
  toState,
  toStatusChange,
} from './issues.pure';
import {
  IssueRefsRepository,
  type WorkerFacts,
} from './repositories/issue-refs.repository';
import {
  IssueRepository,
  type IssueStateRow,
} from './repositories/issue.repository';

/** The uploaded file as multer hands it over (memory storage). */
export interface UploadedPhoto {
  buffer: Buffer;
  size: number;
}

/** A refusal in a bulk update: which issue, and why. */
interface BulkFailure {
  id: string;
  code: DomainErrorCode;
  missing: Requirement[];
}

@Injectable()
export class IssuesService {
  private readonly logger = new Logger(IssuesService.name);

  constructor(
    private readonly issues: IssueRepository,
    private readonly refs: IssueRefsRepository,
    @Inject(PHOTO_STORAGE) private readonly storage: PhotoStorage,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  // ------------------------------------------------------------ reads

  async list(query: IssueListQueryDto): Promise<Paginated<Issue>> {
    const now = this.clock.now();
    const window = pageWindow(query.page, query.limit);
    const { rows, total } = await this.issues.findPage(
      buildIssueWhere(query, now),
      issueOrderBy(query.sort),
      window.skip,
      window.take,
    );
    return toPage(
      rows.map((row) => toIssue(row, now)),
      total,
      window,
    );
  }

  async findOne(id: string): Promise<IssueDetail> {
    const issue = await this.get(id);
    const history = await this.issues.findHistory(id);
    return { ...issue, history: history.map(toStatusChange) };
  }

  // ------------------------------------------------------------ create

  /**
   * Creates an issue from its first photo, numbered from the site's counter in the same
   * transaction. The optional trade, contractor and description go through applyPatch on a fresh
   * `new` state, so the issue lands in `new`, `unassigned` or `assigned` by the §4 rules; history
   * is `none → new` plus one row for that landing move. A refusal creates nothing. Idempotent on
   * the client's id (§6.9): an existing id answers 200 with that issue and changes nothing.
   */
  async create(
    dto: CreateIssueDto,
    file: UploadedPhoto | undefined,
  ): Promise<WithStatus<Issue>> {
    const existing = await this.issues.findById(dto.id);
    if (existing) return this.existing(existing.id);

    const photo = requirePhoto(file);
    const site = await this.refs.findSite(dto.siteId);
    if (!site) throw new NotFoundException('Site not found');
    if (site.archived) throw ruleConflict(DomainErrorCode.ARCHIVED_SITE);
    // Refuse before anything is stored; re-checked under the transaction below.
    await this.planCreate(dto);

    const photoId = randomUUID();
    const stored = await this.storePhoto(dto.id, photoId, photo);
    try {
      await this.issues.transaction(async (tx) => {
        const taken = await this.issues.takeNextNumber(tx, dto.siteId);
        if (!taken) throw new NotFoundException('Site not found');
        if (taken.archived) throw ruleConflict(DomainErrorCode.ARCHIVED_SITE);
        const plan = await this.planCreate(dto, tx);
        await this.issues.createIssue(tx, {
          id: dto.id,
          siteId: dto.siteId,
          number: taken.number,
          location: dto.location || null,
          capturedAt: new Date(dto.capturedAt),
          ...(dto.priority && { priority: dto.priority }),
          ...stateData(plan.state),
          ...firstReachedStamp(
            NOTHING_REACHED,
            plan.state.status,
            this.clock.now(),
          ),
        });
        await this.issues.createPhoto(tx, {
          id: photoId,
          issueId: dto.id,
          kind: 'before',
          storageKey: stored.file.key,
          url: stored.file.url,
          width: stored.width,
          height: stored.height,
          sortOrder: 0,
        });
        await this.issues.addStatusChange(tx, {
          issueId: dto.id,
          from: null,
          to: 'new',
        });
        if (plan.statusChange) {
          await this.issues.addStatusChange(tx, {
            issueId: dto.id,
            ...plan.statusChange,
          });
        }
      });
    } catch (error) {
      await this.discard([stored.file.key]);
      // The same capture uploaded twice at once: the other request made it.
      if (IssueRepository.isDuplicateKey(error)) return this.existing(dto.id);
      throw error;
    }
    return new WithStatus(HttpStatus.CREATED, await this.get(dto.id));
  }

  // ------------------------------------------------------------ photos

  /** Adds a before- or after-photo; at most 10 of each kind (§6.5). */
  async addPhoto(
    id: string,
    kind: PhotoKind,
    file: UploadedPhoto | undefined,
  ): Promise<Issue> {
    const photo = requirePhoto(file);
    await this.get(id);
    await this.assertRoomFor(id, kind);

    const photoId = randomUUID();
    const stored = await this.storePhoto(id, photoId, photo);
    try {
      await this.issues.transaction(async (tx) => {
        await this.lock(tx, id);
        await this.assertRoomFor(id, kind, 1, tx);
        await this.issues.createPhoto(tx, {
          id: photoId,
          issueId: id,
          kind,
          storageKey: stored.file.key,
          url: stored.file.url,
          width: stored.width,
          height: stored.height,
          sortOrder: await this.issues.nextPhotoSortOrder(tx, id, kind),
        });
      });
    } catch (error) {
      await this.discard([stored.file.key]);
      throw error;
    }
    return this.get(id);
  }

  /** Deletes a photo; the last before-photo is refused (§6.5), an after-photo never is. */
  async deletePhoto(id: string, photoId: string): Promise<Issue> {
    const key = await this.issues.transaction(async (tx) => {
      await this.lock(tx, id);
      const photo = await this.issues.findPhoto(tx, id, photoId);
      if (!photo) throw new NotFoundException('Photo not found');
      if (
        photo.kind === 'before' &&
        (await this.issues.countPhotos(id, 'before', tx)) <= 1
      ) {
        throw ruleConflict(DomainErrorCode.LAST_PHOTO);
      }
      await this.issues.deletePhoto(tx, photoId);
      return photo.storageKey;
    });
    await this.discard([key]);
    return this.get(id);
  }

  // ------------------------------------------------------------ changes

  /**
   * Edits an issue through applyPatch, which applies the automatic moves of §4. A history row is
   * written only when the status changed (§6.7).
   */
  async update(id: string, dto: UpdateIssueDto): Promise<Issue> {
    await this.issues.transaction(async (tx) => {
      const row = await this.lock(tx, id);
      const state = toState(row);
      const patch = rulePatch(dto);

      if (
        typeof patch.categoryId === 'string' &&
        patch.categoryId !== state.categoryId
      ) {
        await this.assertCategoryChoosable(patch.categoryId, tx);
      }
      const workerId =
        typeof patch.workerId === 'string' ? patch.workerId : state.workerId;
      const worker = workerId ? await this.workerFacts(workerId, tx) : null;

      const result = applyPatch(state, patch, { worker });
      if (!result.ok) {
        throw ruleConflict(result.code, { missing: result.missing });
      }

      await this.issues.update(tx, id, {
        ...stateData(result.state),
        ...(dto.location !== undefined && { location: dto.location || null }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...firstReachedStamp(row, result.state.status, this.clock.now()),
      });
      if (result.statusChange) {
        await this.issues.addStatusChange(tx, {
          issueId: id,
          ...result.statusChange,
        });
      }
    });
    return this.get(id);
  }

  /**
   * Moves an issue to a status (canMove decides; reopening lands on reopenTarget). Writes
   * exactly one history row carrying the note; asking for the current status writes none.
   */
  async changeStatus(id: string, dto: ChangeStatusDto): Promise<Issue> {
    await this.issues.transaction(async (tx) => {
      const row = await this.lock(tx, id);
      const plan = planMove(toState(row), dto.status, dto.estimatedDate);
      if (!plan.ok) throw ruleConflict(plan.code, { missing: plan.missing });

      await this.issues.update(tx, id, {
        ...stateData(plan.state),
        ...firstReachedStamp(row, plan.state.status, this.clock.now()),
      });
      if (plan.moved) {
        await this.issues.addStatusChange(tx, {
          issueId: id,
          from: row.status,
          to: plan.state.status,
          note: dto.note || null,
        });
      }
    });
    return this.get(id);
  }

  /**
   * One change applied to many issues, all or nothing: every issue is checked under lock first;
   * if any is refused nothing is written and the 409 lists the refused ids. Each issue whose
   * status changes gets exactly one history row (from its old to its final status).
   */
  async bulk(dto: BulkIssuesDto): Promise<BulkIssuesResponse> {
    if (!dto.categoryId && !dto.status && !dto.workerId) {
      throw new BadRequestException({
        message: 'Send at least one of categoryId, status or workerId',
        error: ErrorCode.VALIDATION_FAILED,
      });
    }
    const ids = [...new Set(dto.ids)];
    await this.issues.transaction(async (tx) => {
      if (dto.categoryId)
        await this.assertCategoryChoosable(dto.categoryId, tx);
      if (dto.workerId) await this.workerFacts(dto.workerId, tx);

      const rows = await this.issues.lockStates(tx, ids);
      const workers = await this.refs.findWorkers(
        [dto.workerId, ...rows.map((r) => r.workerId)].filter(
          (w): w is string => !!w,
        ),
        tx,
      );
      const found = new Set(rows.map((r) => r.id));
      const unknown = ids.filter((id) => !found.has(id));
      if (unknown.length > 0) {
        throw new NotFoundException({
          message: 'Issue not found',
          error: ErrorCode.NOT_FOUND,
          data: { ids: unknown },
        });
      }
      const failures: BulkFailure[] = [];
      const plans: { row: IssueStateRow; state: IssueState }[] = [];

      for (const row of rows) {
        const outcome = planBulk(row, dto, workers);
        if (outcome.ok) plans.push({ row, state: outcome.state });
        else failures.push({ id: row.id, ...outcome.failure });
      }
      if (failures.length > 0) {
        throw ruleConflict(failures[0].code, {
          ids: failures.map((f) => f.id),
          failures,
        });
      }

      const now = this.clock.now();
      for (const { row, state } of plans) {
        await this.issues.update(tx, row.id, {
          ...stateData(state),
          ...firstReachedStamp(row, state.status, now),
        });
        if (state.status !== row.status) {
          await this.issues.addStatusChange(tx, {
            issueId: row.id,
            from: row.status,
            to: state.status,
            note: dto.note || null,
          });
        }
      }
    });
    const now = this.clock.now();
    const issues = (await this.issues.findManyByIds(ids)).map((row) =>
      toIssue(row, now),
    );
    return { updated: issues.length, issues };
  }

  /**
   * Merges `sourceId` into `id` (§5.3): both must be `new`; the source's photos move to the
   * target (at most 10 of each kind) and the source is removed. No history row: neither moved.
   */
  async merge(id: string, sourceId: string): Promise<Issue> {
    if (id === sourceId) {
      throw new BadRequestException({
        message: 'An issue cannot be merged into itself',
        error: ErrorCode.VALIDATION_FAILED,
      });
    }
    await this.issues.transaction(async (tx) => {
      const rows = await this.issues.lockStates(tx, [id, sourceId]);
      if (rows.length < 2) throw new NotFoundException('Issue not found');
      if (rows.some((r) => r.status !== 'new')) {
        throw ruleConflict(DomainErrorCode.NOT_NEW);
      }
      for (const kind of ['before', 'after'] as const) {
        const total =
          (await this.issues.countPhotos(id, kind, tx)) +
          (await this.issues.countPhotos(sourceId, kind, tx));
        if (total > PHOTOS_PER_KIND_MAX) {
          throw ruleConflict(DomainErrorCode.PHOTO_LIMIT);
        }
      }
      await this.issues.movePhotos(tx, sourceId, id);
      await this.issues.deleteIssue(tx, sourceId);
    });
    return this.get(id);
  }

  /** Deletes a `new` issue (a wrong shot) with its photos; any other is cancelled instead (§3). */
  async remove(id: string): Promise<Deleted> {
    const keys = await this.issues.transaction(async (tx) => {
      const row = await this.lock(tx, id);
      if (row.status !== 'new') throw ruleConflict(DomainErrorCode.NOT_NEW);
      const photos = await this.issues.photoKeys(tx, id);
      await this.issues.deleteIssue(tx, id);
      return photos.map((p) => p.storageKey);
    });
    await this.discard(keys);
    return { id };
  }

  // ------------------------------------------------------------ helpers

  private async get(id: string): Promise<Issue> {
    const row = await this.issues.findById(id);
    if (!row) throw new NotFoundException('Issue not found');
    return toIssue(row, this.clock.now());
  }

  private async existing(id: string): Promise<WithStatus<Issue>> {
    return new WithStatus(HttpStatus.OK, await this.get(id));
  }

  private async lock(tx: Tx, id: string): Promise<IssueStateRow> {
    const row = await this.issues.lockState(tx, id);
    if (!row) throw new NotFoundException('Issue not found');
    return row;
  }

  private async assertRoomFor(
    id: string,
    kind: PhotoKind,
    adding = 1,
    tx?: Tx,
  ): Promise<void> {
    const count = await this.issues.countPhotos(id, kind, tx);
    if (count + adding > PHOTOS_PER_KIND_MAX) {
      throw ruleConflict(DomainErrorCode.PHOTO_LIMIT);
    }
  }

  /** A category may be newly chosen only while active (§6.11). */
  private async assertCategoryChoosable(id: string, tx?: Tx): Promise<void> {
    const category = await this.refs.findCategory(id, tx);
    if (!category) throw new NotFoundException('Category not found');
    if (!category.active) throw ruleConflict(DomainErrorCode.INACTIVE_CATEGORY);
  }

  private async workerFacts(id: string, tx?: Tx): Promise<WorkerFacts> {
    const worker = await this.refs.findWorker(id, tx);
    if (!worker) throw new NotFoundException('Worker not found');
    return worker;
  }

  /**
   * Where a new capture lands (shared planCapture: the same rules as sorting it later), after
   * checking the chosen trade may be chosen and fetching the contractor's facts. Throws the refusal.
   */
  private async planCreate(
    dto: CreateIssueDto,
    tx?: Tx,
  ): Promise<{ state: IssueState; statusChange: StatusMove | null }> {
    if (dto.categoryId) await this.assertCategoryChoosable(dto.categoryId, tx);
    const worker = dto.workerId
      ? await this.workerFacts(dto.workerId, tx)
      : null;
    const result = planCapture(dto, { worker });
    if (!result.ok) {
      throw ruleConflict(result.code, { missing: result.missing });
    }
    return { state: result.state, statusChange: result.statusChange };
  }

  /** Validates the bytes, normalises to the stored JPEG and writes it to storage. */
  private async storePhoto(
    issueId: string,
    photoId: string,
    photo: UploadedPhoto,
  ): Promise<{ file: StoredFile; width: number; height: number }> {
    if (!sniffImageType(photo.buffer)) throw notAnImage();
    const image = await toStoredImage(photo.buffer).catch(() => {
      throw notAnImage();
    });
    const file = await this.storage.put(
      issuePhotoKey(issueId, photoId),
      image.body,
      image.contentType,
    );
    return { file, width: image.width, height: image.height };
  }

  /** Best-effort removal of stored files whose rows are gone (or never committed). */
  private async discard(keys: string[]): Promise<void> {
    for (const key of keys) {
      try {
        await this.storage.delete(key);
      } catch (error) {
        this.logger.warn(
          `Could not delete stored photo ${key}: ${String(error)}`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------- pure glue

function requirePhoto(file: UploadedPhoto | undefined): UploadedPhoto {
  if (!file || file.size === 0) {
    throw new BadRequestException({
      message: 'A photo is required',
      error: ErrorCode.VALIDATION_FAILED,
    });
  }
  return file;
}

const notAnImage = () =>
  new BadRequestException({
    message: 'The photo must be a JPEG, PNG or WebP image',
    error: ErrorCode.UNSUPPORTED_MEDIA_TYPE,
  });

/** A new issue has reached no status yet, so every first-reached stamp is still empty. */
const NOTHING_REACHED = { assignedAt: null, sentAt: null, solvedAt: null };

/** The rule-bearing fields of a PATCH body, present keys only (absent = leave alone). */
function rulePatch(dto: UpdateIssueDto): IssuePatch {
  const patch: IssuePatch = {};
  if (dto.description !== undefined) patch.description = dto.description;
  if (dto.categoryId !== undefined) patch.categoryId = dto.categoryId;
  if (dto.workerId !== undefined) patch.workerId = dto.workerId;
  if (dto.estimatedDate !== undefined) patch.estimatedDate = dto.estimatedDate;
  return patch;
}

/** The columns an IssueState maps to. */
function stateData(state: IssueState) {
  return {
    status: state.status,
    description: state.description,
    categoryId: state.categoryId,
    workerId: state.workerId,
    estimatedDate:
      state.estimatedDate === null ? null : dateOnlyToDb(state.estimatedDate),
  };
}

type BulkOutcome =
  | { ok: true; state: IssueState }
  | { ok: false; failure: Omit<BulkFailure, 'id'> };

/** One issue of a bulk update: the category/worker patch (applyPatch), then the status move. */
function planBulk(
  row: IssueStateRow,
  dto: BulkIssuesDto,
  workers: Map<string, WorkerFacts>,
): BulkOutcome {
  let state = toState(row);
  const patch: IssuePatch = {};
  if (dto.categoryId) patch.categoryId = dto.categoryId;
  if (dto.workerId) patch.workerId = dto.workerId;

  if (patch.categoryId || patch.workerId) {
    const workerId = dto.workerId ?? state.workerId;
    const worker = workerId ? (workers.get(workerId) ?? null) : null;
    const result = applyPatch(state, patch, { worker });
    if (!result.ok) {
      return {
        ok: false,
        failure: { code: result.code, missing: result.missing },
      };
    }
    state = result.state;
  }
  if (dto.status) {
    const plan = planMove(state, dto.status);
    if (!plan.ok) {
      return { ok: false, failure: { code: plan.code, missing: plan.missing } };
    }
    state = plan.state;
  }
  return { ok: true, state };
}
