// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  changeMatchesPolicyConditions,
  policyCoversScan,
} from "@/lib/server/alerts/evaluation-service";

describe("alert policy evaluation", () => {
  it("matches every active change in all mode and explicit types in selected mode", () => {
    const bodyChange = {
      changeType: "body_fingerprint.changed",
      alertEligible: false,
    };

    expect(changeMatchesPolicyConditions(bodyChange, {
      selectionMode: "all",
      changeTypes: [],
    })).toBe(true);
    expect(changeMatchesPolicyConditions(bodyChange, {
      selectionMode: "selected",
      changeTypes: ["body_fingerprint.changed"],
    })).toBe(true);
  });

  it("matches only explicitly selected change types", () => {
    const change = {
      changeType: "technology.changed",
      alertEligible: true,
    };

    expect(changeMatchesPolicyConditions(change, {
      selectionMode: "selected",
      changeTypes: ["technology.changed"],
    })).toBe(true);
    expect(changeMatchesPolicyConditions(change, {
      selectionMode: "selected",
      changeTypes: ["status.changed"],
    })).toBe(false);
  });

  it("never matches retired endpoint inventory change types", () => {
    expect(changeMatchesPolicyConditions({
      changeType: "endpoint.added",
      alertEligible: true,
    }, {
      selectionMode: "all",
      changeTypes: [],
    })).toBe(false);
  });

  it("does not match routine-only response header evidence", () => {
    expect(changeMatchesPolicyConditions({
      changeType: "response_headers.changed",
      alertEligible: false,
    }, {
      selectionMode: "all",
      changeTypes: [],
    })).toBe(false);
    expect(changeMatchesPolicyConditions({
      changeType: "response_headers.changed",
      alertEligible: false,
    }, {
      selectionMode: "selected",
      changeTypes: ["response_headers.changed"],
    })).toBe(false);
    expect(changeMatchesPolicyConditions({
      changeType: "response_headers.changed",
      alertEligible: true,
    }, {
      selectionMode: "selected",
      changeTypes: ["response_headers.changed"],
    })).toBe(true);
  });

  it("supports all-target, selected-target, and selected-schedule coverage", () => {
    const common = {
      canonicalTargetId: "target_01",
      scheduleId: "schedule_01",
      selectedTargetIds: new Set(["target_01"]),
      selectedScheduleIds: new Set(["schedule_01"]),
    };

    expect(policyCoversScan({ ...common, coverage: "all_targets" })).toBe(true);
    expect(policyCoversScan({ ...common, coverage: "selected_targets" })).toBe(true);
    expect(policyCoversScan({ ...common, coverage: "selected_schedules" })).toBe(true);
    expect(policyCoversScan({
      ...common,
      coverage: "selected_targets",
      selectedTargetIds: new Set(["target_02"]),
    })).toBe(false);
  });
});
