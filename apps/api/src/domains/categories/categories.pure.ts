/**
 * A reorder must name every category exactly once (contract: `ids` = all ids). Returns what is
 * wrong, or null when the list is a permutation of `existing`.
 */
export function reorderProblem(
  ids: readonly string[],
  existing: readonly string[],
): string | null {
  if (new Set(ids).size !== ids.length) return 'ids contains duplicates';
  const known = new Set(existing);
  if (ids.some((id) => !known.has(id))) return 'ids contains an unknown category';
  if (ids.length !== known.size) return 'ids must list every category';
  return null;
}
