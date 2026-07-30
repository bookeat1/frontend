/**
 * Moving one venue inside a collection's order.
 *
 * This lives apart from the component because it is the part that can be wrong
 * silently. The endpoint takes the intended FINAL sequence and refuses anything
 * that is not exactly the current membership (422 guide_order_mismatch), so a
 * move that drops an id, duplicates one, or invents one does not produce a
 * subtly wrong order — it produces a refusal the editor has to make sense of
 * mid-drag. Getting it right is a property of an array, and an array is
 * testable without a DOM.
 */

/**
 * Returns the order with the item at `from` moved to `to`.
 *
 * Out-of-range indices and a no-op move return the SAME array reference, so a
 * caller can skip the request entirely — dropping a card back where it started
 * must not write anything.
 */
export function moveInOrder<T>(order: readonly T[], from: number, to: number): readonly T[] {
  if (from === to) return order;
  if (from < 0 || from >= order.length) return order;
  if (to < 0 || to >= order.length) return order;
  const next = order.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * True when `next` is a genuine reordering of `current`: same members, same
 * count, each exactly once, but a different sequence.
 *
 * The panel checks this before sending. Not as validation — the server does that
 * and is the authority — but so a drag that changed nothing never costs a
 * request, and so a bug that loses a venue from the list is caught here rather
 * than turning into a refusal the editor cannot explain.
 */
export function isReorderOf(current: readonly string[], next: readonly string[]): boolean {
  if (current.length !== next.length) return false;
  if (current.length === 0) return false;

  const seen = new Set<string>();
  for (const id of next) {
    if (seen.has(id)) return false;
    seen.add(id);
  }
  for (const id of current) {
    if (!seen.has(id)) return false;
  }
  return current.some((id, i) => id !== next[i]);
}
