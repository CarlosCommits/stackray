import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { updateScheduleRequestSchema } from "@/lib/contracts/schedules";
import { actorAuthErrorResponse, requireSessionOrBearerActor } from "@/lib/session/actor-auth";
import { errorResponse, zodErrorResponse } from "@/lib/server/http/error-response";
import { deleteSchedule, updateSchedule } from "@/lib/server/schedules/service";
import { DEMO_SCHEDULE_DISABLED_MESSAGE, isDemoModeEnabled } from "@/lib/demo-mode";

export async function PATCH(request: Request, context: { params: Promise<{ scheduleId: string }> }) {
  try {
    if (isDemoModeEnabled()) {
      return errorResponse(403, "demo_schedule_disabled", DEMO_SCHEDULE_DISABLED_MESSAGE);
    }

    const actor = await requireSessionOrBearerActor(request);
    const { scheduleId } = await context.params;
    const payload = await request.json();
    const parsed = updateScheduleRequestSchema.parse(payload);
    const response = await updateSchedule(actor, scheduleId, parsed);

    return NextResponse.json(response);
  } catch (error) {
    const authError = actorAuthErrorResponse(error);

    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return zodErrorResponse(error);
    }

    return errorResponse(400, "schedule_update_failed", error instanceof Error ? error.message : "Unable to update the schedule.");
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ scheduleId: string }> }) {
  try {
    if (isDemoModeEnabled()) {
      return errorResponse(403, "demo_schedule_disabled", DEMO_SCHEDULE_DISABLED_MESSAGE);
    }

    const actor = await requireSessionOrBearerActor(request);
    const { scheduleId } = await context.params;
    const response = await deleteSchedule(actor, scheduleId);

    return NextResponse.json(response);
  } catch (error) {
    return actorAuthErrorResponse(error)
      ?? errorResponse(400, "schedule_delete_failed", error instanceof Error ? error.message : "Unable to delete the schedule.");
  }
}
