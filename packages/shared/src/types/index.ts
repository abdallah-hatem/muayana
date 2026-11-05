import type { z } from 'zod';
import type {
  AddPhotoRequestSchema,
  BulkIssuesRequestSchema,
  BulkIssuesResponseSchema,
  CategoryListQuerySchema,
  CategoryRefSchema,
  CategorySchema,
  ChangePasswordRequestSchema,
  ChangeStatusRequestSchema,
  CreateCategoryRequestSchema,
  CreateIssueRequestSchema,
  CreateSiteRequestSchema,
  CreateWorkerRequestSchema,
  DashboardQuerySchema,
  DashboardSchema,
  DeletedSchema,
  IssueDetailSchema,
  IssueExportQuerySchema,
  IssueFilterSchema,
  IssueHistoryExportQuerySchema,
  IssueListQuerySchema,
  IssueSchema,
  LoginRequestSchema,
  LoginResponseSchema,
  MergeIssuesRequestSchema,
  PaginationQuerySchema,
  PhotoSchema,
  ReorderCategoriesRequestSchema,
  SiteListQuerySchema,
  SiteRefSchema,
  SiteSchema,
  StatusChangeSchema,
  UpdateCategoryRequestSchema,
  UpdateIssueRequestSchema,
  UpdateMeRequestSchema,
  UpdateSiteRequestSchema,
  UpdateWorkerRequestSchema,
  UserSchema,
  WorkerExportQuerySchema,
  WorkerListQuerySchema,
  WorkerRefSchema,
  WorkerSchema,
} from '../schemas';

/**
 * Types inferred from the contract schemas. Response shapes use `z.output`; request bodies and
 * queries use `z.input` (what a caller sends, before defaults and transforms).
 */

export type PaginationQuery = z.input<typeof PaginationQuerySchema>;
export type Deleted = z.output<typeof DeletedSchema>;

// Auth
export type User = z.output<typeof UserSchema>;
export type LoginRequest = z.input<typeof LoginRequestSchema>;
export type LoginResponse = z.output<typeof LoginResponseSchema>;
export type UpdateMeRequest = z.input<typeof UpdateMeRequestSchema>;
export type ChangePasswordRequest = z.input<typeof ChangePasswordRequestSchema>;

// Sites
export type Site = z.output<typeof SiteSchema>;
export type SiteRef = z.output<typeof SiteRefSchema>;
export type SiteListQuery = z.input<typeof SiteListQuerySchema>;
export type CreateSiteRequest = z.input<typeof CreateSiteRequestSchema>;
export type UpdateSiteRequest = z.input<typeof UpdateSiteRequestSchema>;

// Categories
export type Category = z.output<typeof CategorySchema>;
export type CategoryRef = z.output<typeof CategoryRefSchema>;
export type CategoryListQuery = z.input<typeof CategoryListQuerySchema>;
export type CreateCategoryRequest = z.input<typeof CreateCategoryRequestSchema>;
export type UpdateCategoryRequest = z.input<typeof UpdateCategoryRequestSchema>;
export type ReorderCategoriesRequest = z.input<
  typeof ReorderCategoriesRequestSchema
>;

// Workers
export type Worker = z.output<typeof WorkerSchema>;
export type WorkerRef = z.output<typeof WorkerRefSchema>;
export type WorkerListQuery = z.input<typeof WorkerListQuerySchema>;
export type CreateWorkerRequest = z.input<typeof CreateWorkerRequestSchema>;
export type UpdateWorkerRequest = z.input<typeof UpdateWorkerRequestSchema>;

// Issues
export type Photo = z.output<typeof PhotoSchema>;
export type StatusChange = z.output<typeof StatusChangeSchema>;
export type Issue = z.output<typeof IssueSchema>;
export type IssueDetail = z.output<typeof IssueDetailSchema>;
export type IssueFilter = z.input<typeof IssueFilterSchema>;
export type ParsedIssueFilter = z.output<typeof IssueFilterSchema>;
export type IssueListQuery = z.input<typeof IssueListQuerySchema>;
export type CreateIssueRequest = z.input<typeof CreateIssueRequestSchema>;
export type AddPhotoRequest = z.input<typeof AddPhotoRequestSchema>;
export type UpdateIssueRequest = z.input<typeof UpdateIssueRequestSchema>;
export type ChangeStatusRequest = z.input<typeof ChangeStatusRequestSchema>;
export type BulkIssuesRequest = z.input<typeof BulkIssuesRequestSchema>;
export type BulkIssuesResponse = z.output<typeof BulkIssuesResponseSchema>;
export type MergeIssuesRequest = z.input<typeof MergeIssuesRequestSchema>;

// Dashboard
export type DashboardQuery = z.input<typeof DashboardQuerySchema>;
export type Dashboard = z.output<typeof DashboardSchema>;

// Exports
export type IssueExportQuery = z.input<typeof IssueExportQuerySchema>;
export type IssueHistoryExportQuery = z.input<
  typeof IssueHistoryExportQuerySchema
>;
export type WorkerExportQuery = z.input<typeof WorkerExportQuerySchema>;
