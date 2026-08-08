/**
 * Pure list-reorder helper for the «вверх»/«вниз» story controls.
 *
 * Swaps the item at `index` with its neighbour in `direction` (-1 = up, 1 =
 * down) and returns a NEW array of ids in the intended final order — exactly
 * what `reorderStories` wants as `ordered_ids`. A move at either edge (up from
 * the top, down from the bottom) is a no-op that returns an unchanged copy, so
 * the caller can hand the result straight to the API without an out-of-range
 * swap ever corrupting the order.
 */
export function moveItem<T>(ids: readonly T[], index: number, direction: -1 | 1): T[] {
  const next = index + direction;
  if (index < 0 || index >= ids.length || next < 0 || next >= ids.length) {
    return [...ids];
  }
  const result = [...ids];
  [result[index], result[next]] = [result[next], result[index]];
  return result;
}
