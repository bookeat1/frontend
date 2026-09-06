import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * The ONE Markdown renderer shared by the site (`/pages/:slug`, T4) and the
 * cabinet's editor preview (`apps/admin`, «Страницы сайта»). Both MUST import
 * this component rather than rolling their own — otherwise the preview a
 * superadmin edits against lies about what a guest will actually see
 * (acceptance criterion 31 in `specs/web-fixes-20260906.md`).
 *
 * Content model: text pages a superadmin writes (about/jobs/contacts/
 * how-it-works/cancellation/offer/privacy), so the surface is deliberately
 * narrow — this is not a general-purpose Markdown viewer.
 *
 * Safety, all enforced here rather than trusted to the caller:
 *   - `skipHtml`: raw HTML in the source (`<script>`, `<iframe>`, …) is
 *     dropped, never parsed into DOM.
 *   - `allowedElements`: only the tags product actually asked for render;
 *     anything else (e.g. a stray `<h1>` that would fight the page's own
 *     title) is silently omitted rather than rendered.
 *   - links get `target="_blank" rel="noopener noreferrer"` — every link in
 *     this content is to something outside the page — and go through
 *     react-markdown's own `defaultUrlTransform`, which already turns
 *     `javascript:`/`data:` URIs into `""` (verified in
 *     `__tests__/Markdown.test.tsx`).
 *   - images are rendered ONLY when the (already-sanitized) `src` starts with
 *     `https://` — an editor pasting a bare `http://` image link gets no
 *     broken padlock on a page that talks about privacy and payments.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      allowedElements={ALLOWED_ELEMENTS}
      components={COMPONENTS}
    >
      {children}
    </ReactMarkdown>
  );
}

const ALLOWED_ELEMENTS = [
  "h2",
  "h3",
  "h4",
  "p",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "a",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "blockquote",
  "hr",
  "br",
  "img",
];

const COMPONENTS: Components = {
  a: ({ href, children, ...rest }) => (
    <a {...rest} href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  // `src` has already passed through react-markdown's `defaultUrlTransform`
  // (javascript:/data: already neutralized) by the time this renders — this
  // guard is specifically the "http, not https" case that transform does not
  // reject.
  img: ({ src, alt }) => {
    if (typeof src !== "string" || !src.startsWith("https://")) return null;
    // eslint-disable-next-line @next/next/no-img-element -- this is a shared,
    // framework-agnostic package; `next/image` needs a configured loader that
    // only the consuming app can provide, and content images here come from
    // an editor's free-text URL, not a known-domain list.
    return <img src={src} alt={alt ?? ""} loading="lazy" />;
  },
};
