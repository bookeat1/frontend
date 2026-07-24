import { getDictionary } from "@bookeat/i18n";

/** RU is the default and only shipped locale (see @bookeat/i18n). Exposed as a
 * plain const so components import `t.admin.*` directly. */
export const t = getDictionary("ru");
