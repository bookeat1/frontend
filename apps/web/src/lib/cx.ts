/**
 * Склейка классов. Ровно то, что нужно, и ничего больше: `clsx`/`classnames`
 * тянуть в бандл ради восьми строк смысла нет.
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
