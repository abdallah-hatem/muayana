import type { IssueStatus, Priority } from '../schemas/enums';
import { PRIORITIES } from '../schemas/enums';

/**
 * i18n keys for statuses and priorities (keys only; the text lives in the web's message files).
 * The same key in every namespace that shows them: `status.<value>`, `priority.<value>`.
 */
export const statusLabelKey = (status: IssueStatus): `status.${IssueStatus}` =>
  `status.${status}`;

export const priorityLabelKey = (priority: Priority): `priority.${Priority}` =>
  `priority.${priority}`;

/** Rank for sorting by priority: `urgent` highest. */
export const priorityRank = (priority: Priority): number =>
  PRIORITIES.indexOf(priority);
