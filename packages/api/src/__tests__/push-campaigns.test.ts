import { describe, expect, it } from "vitest";

import { AdminApiError } from "../admin/client";
import {
  classifyPushCampaignFailure,
  pushCampaignsPollIntervalMs,
} from "../admin/push-campaigns";
import type { PushCampaignStatus, PushCampaignSummary } from "../admin/types";

function campaign(status: PushCampaignStatus): Pick<PushCampaignSummary, "status"> {
  return { status };
}

describe("classifyPushCampaignFailure", () => {
  it("reads one of the five 422 reasons from the error code (spec §4 criterion 4)", () => {
    expect(
      classifyPushCampaignFailure(new AdminApiError("nope", 422, undefined, "subject_not_published")),
    ).toEqual({ kind: "subject_not_published" });
    expect(
      classifyPushCampaignFailure(new AdminApiError("nope", 422, undefined, "quiet_hours")),
    ).toEqual({ kind: "quiet_hours" });
  });

  it("maps 409 to a concurrent campaign, regardless of code", () => {
    expect(classifyPushCampaignFailure(new AdminApiError("nope", 409))).toEqual({
      kind: "in_progress",
    });
  });

  it("maps 503 to a disabled send channel", () => {
    expect(classifyPushCampaignFailure(new AdminApiError("nope", 503))).toEqual({
      kind: "channel_disabled",
    });
  });

  it("maps 403/401/404 to their own kinds", () => {
    expect(classifyPushCampaignFailure(new AdminApiError("nope", 403)).kind).toBe("forbidden");
    expect(classifyPushCampaignFailure(new AdminApiError("nope", 401)).kind).toBe("unauthorized");
    expect(classifyPushCampaignFailure(new AdminApiError("nope", 404)).kind).toBe("not_found");
  });

  it("falls back to unknown for a plain network failure", () => {
    expect(classifyPushCampaignFailure(new Error("offline")).kind).toBe("unknown");
  });
});

describe("pushCampaignsPollIntervalMs", () => {
  it("polls every 5s while any campaign is queued or sending (spec §4 criterion 29)", () => {
    expect(pushCampaignsPollIntervalMs([campaign("queued")])).toBe(5000);
    expect(pushCampaignsPollIntervalMs([campaign("sending")])).toBe(5000);
    expect(pushCampaignsPollIntervalMs([campaign("done"), campaign("sending")])).toBe(5000);
  });

  it("stops once nothing is in flight", () => {
    expect(pushCampaignsPollIntervalMs([campaign("done")])).toBe(false);
    expect(pushCampaignsPollIntervalMs([campaign("failed"), campaign("cancelled")])).toBe(false);
    expect(pushCampaignsPollIntervalMs([])).toBe(false);
    expect(pushCampaignsPollIntervalMs(undefined)).toBe(false);
  });
});
