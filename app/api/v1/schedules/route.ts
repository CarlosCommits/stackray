import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { createScheduleRequestSchema } from "@/lib/contracts/schedules";
import { apiActorErrorResponse, requireApiActor } from "@/lib/session/api-actor";
import { errorResponse, zodErrorResponse } from "@/lib/server/http/error-response";
import { createSchedule, listSchedules } from "@/lib/server/schedules/service";

export async function GET(request: Request) {
  try {
    const actor = await requireApiActor(request);
    const response = await listSchedules(actor);

    return NextResponse.json(response);
  } catch (error) {
    return apiActorErrorResponse(error)
      ?? errorResponse(403, "forbidden", error instanceof Error ? error.message : "Forbidden");
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireApiActor(request);
    const payload = await request.json();
    const parsed = createScheduleRequestSchema.parse(payload);
    const response = await createSchedule(actor, parsed);

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const authError = apiActorErrorResponse(error);

    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return zodErrorResponse(error);
    }

    return errorResponse(400, "schedule_create_failed", error instanceof Error ? error.message : "Unable to create the schedule.");
  }
}
