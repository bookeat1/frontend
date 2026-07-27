import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * REGRESSION GUARD — a venue employee, kicked out of the panel by an expired
 * token, landed on `404 page not found` instead of a sign-in form.
 *
 * The panel is served under `/admin-preview` on the test deploy. Next prefixes
 * the routes IT owns, but `window.location.href = "/login"` is just a string:
 * the browser went to the site root, where Caddy proxies `/login` straight into
 * the Go API, which has no such route. So the employee saw a white page with a
 * line of English on it, every fifteen minutes, and had no way back in except
 * being told the full URL over the phone.
 *
 * What must never regress: the place the panel sends a bounced-out employee is
 * the panel's OWN login screen, prefix included, and it says why they are there.
 */

/** The module reads process.env inside its functions (Next inlines
 * NEXT_PUBLIC_* at build time either way), so each case re-imports it with the
 * environment it wants. */
async function loadWith(prefix: string | undefined) {
  vi.resetModules();
  if (prefix === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
  else process.env.NEXT_PUBLIC_BASE_PATH = prefix;
  return import("../base-path");
}

afterEach(() => {
  delete process.env.NEXT_PUBLIC_BASE_PATH;
});

describe("where a bounced-out employee is sent", () => {
  // The trailing slash matches next.config's `trailingSlash: true`: the static
  // export writes login/index.html, which is what the test deploy serves.
  it("keeps the panel's prefix, so the login screen is the panel's own", async () => {
    const { loginUrl } = await loadWith("/admin-preview");
    expect(loginUrl()).toBe("/admin-preview/login/");
  });

  it("says the session expired, so the login screen is not a silent logout", async () => {
    const { loginUrl, SESSION_EXPIRED_REASON } = await loadWith("/admin-preview");
    expect(loginUrl(SESSION_EXPIRED_REASON)).toBe("/admin-preview/login/?reason=session-expired");
  });

  it("stays at the root when the panel is served at the root (dev)", async () => {
    const { loginUrl } = await loadWith(undefined);
    expect(loginUrl()).toBe("/login/");
  });

  it("tolerates a trailing slash in the configured prefix", async () => {
    const { loginUrl } = await loadWith("/admin-preview/");
    expect(loginUrl()).toBe("/admin-preview/login/");
  });

  it("recognises the prefixed login route, with or without a trailing slash", async () => {
    const { isOnLoginRoute } = await loadWith("/admin-preview");
    expect(isOnLoginRoute("/admin-preview/login")).toBe(true);
    expect(isOnLoginRoute("/admin-preview/login/")).toBe(true);
    // The bare path is the API's, not ours — treating it as "already on login"
    // is exactly how the 404 page used to become a dead end.
    expect(isOnLoginRoute("/login")).toBe(false);
    expect(isOnLoginRoute("/admin-preview/bookings")).toBe(false);
  });
});

describe("redirecting", () => {
  it("navigates to the prefixed login url and leaves no way back to the dead page", async () => {
    const { redirectToLogin } = await loadWith("/admin-preview");
    const replace = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({
      pathname: "/admin-preview/bookings",
      search: "",
      replace,
    } as unknown as Location);

    redirectToLogin("session-expired");

    expect(replace).toHaveBeenCalledWith("/admin-preview/login/?reason=session-expired");
  });

  it("does not reload the login screen it is already on", async () => {
    const { redirectToLogin } = await loadWith("/admin-preview");
    const replace = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({
      pathname: "/admin-preview/login",
      search: "",
      replace,
    } as unknown as Location);

    redirectToLogin("session-expired");

    expect(replace).not.toHaveBeenCalled();
  });
});
