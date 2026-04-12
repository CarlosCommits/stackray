import { describe, expect, it } from "vitest"

import {
  createScheduleRequestSchema,
  updateScheduleRequestSchema,
} from "@/lib/contracts/schedules"

describe("schedules contract", () => {
  it("rejects explicit null weekday for weekly schedules", () => {
    expect(() =>
      createScheduleRequestSchema.parse({
        targets: ["https://example.com"],
        frequency: "weekly",
        timeOfDay: "09:00",
        weekday: null,
        timezone: "America/New_York",
        options: {
          followRedirects: true,
        },
      }),
    ).toThrow(/weekday is required/i)
  })

  it("rejects explicit null dayOfMonth for monthly schedules", () => {
    expect(() =>
      createScheduleRequestSchema.parse({
        targets: ["https://example.com"],
        frequency: "monthly",
        timeOfDay: "09:00",
        dayOfMonth: null,
        timezone: "America/New_York",
        options: {
          followRedirects: true,
        },
      }),
    ).toThrow(/dayOfMonth is required/i)
  })

  it("accepts enabled-only patch payloads", () => {
    expect(
      updateScheduleRequestSchema.parse({
        enabled: false,
      }),
    ).toEqual({ enabled: false })
  })

  it("treats mixed patch payloads as full edits rather than enabled-only updates", () => {
    expect(
      updateScheduleRequestSchema.parse({
        enabled: false,
        targets: ["https://example.com"],
        frequency: "weekly",
        timeOfDay: "09:00",
        weekday: 1,
        timezone: "America/New_York",
        options: {
          followRedirects: true,
        },
      }),
    ).toEqual({
      enabled: false,
      targets: ["https://example.com"],
      frequency: "weekly",
      timeOfDay: "09:00",
      weekday: 1,
      timezone: "America/New_York",
      options: {
        followRedirects: true,
      },
    })
  })

  it("rejects mixed patch payloads with invalid null recurrence values", () => {
    expect(() =>
      updateScheduleRequestSchema.parse({
        enabled: true,
        targets: ["https://example.com"],
        frequency: "weekly",
        timeOfDay: "09:00",
        weekday: null,
        timezone: "America/New_York",
        options: {
          followRedirects: true,
        },
      }),
    ).toThrow(/weekday is required/i)
  })

  it("rejects removed schedule-only raw response and headless option keys", () => {
    expect(() =>
      createScheduleRequestSchema.parse({
        targets: ["https://example.com"],
        frequency: "daily",
        timeOfDay: "09:00",
        timezone: "America/New_York",
        options: {
          followRedirects: true,
          includeRawResponse: false,
        },
      }),
    ).toThrow(/unrecognized key/i)
  })
})
