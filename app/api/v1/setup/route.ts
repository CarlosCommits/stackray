import { NextResponse } from "next/server"
import { ZodError } from "zod"

import { updateSetupRequestSchema } from "@/lib/contracts/setup"
import { requireAppSession } from "@/lib/session/app-session"
import { errorResponse, zodErrorResponse } from "@/lib/server/http/error-response"
import { completeSetup, getSetupState } from "@/lib/server/setup/service"

export async function GET() {
  try {
    const session = await requireAppSession()
    const response = await getSetupState(session)

    return NextResponse.json(response)
  } catch (error) {
    return errorResponse(403, "setup_read_failed", error instanceof Error ? error.message : "Unable to load setup state.")
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireAppSession()
    const payload = await request.json()
    const parsed = updateSetupRequestSchema.parse(payload)
    const response = await completeSetup(session, parsed.publicUrl)

    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof ZodError) {
      return zodErrorResponse(error)
    }

    return errorResponse(400, "setup_update_failed", error instanceof Error ? error.message : "Unable to save setup state.")
  }
}
