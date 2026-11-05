import { IsOptional, IsUUID } from 'class-validator';

/** Mirrors DashboardQuerySchema: the dashboard of one site, or of every active site. */
export class DashboardQueryDto {
  @IsOptional()
  @IsUUID()
  siteId?: string;
}
