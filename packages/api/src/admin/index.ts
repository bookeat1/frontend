/**
 * Web-safe admin surface of @bookeat/api. Import from `@bookeat/api/admin` so
 * the mobile mock data (which statically imports .jpg assets) never enters a
 * web bundle. Consumed by apps/admin.
 */
export * from "./types";
export { AdminApiClient, AdminApiError, type AdminApiClientOptions } from "./client";
