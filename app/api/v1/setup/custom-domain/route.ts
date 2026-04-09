import { NextResponse } from "next/server"
import { ZodError } from "zod"

import { updateCustomDomainRequestSchema } from "@/lib/contracts/setup"
import { requireAppSession } from "@/lib/session/app-session"
import { errorResponse, zodErrorResponse } from "@/lib/server/http/error-response"
import { getCustomDomainState, saveCustomDomainHostname } from "@/lib/server/setup/service"

export async function GET() {
  try {
    const session = await requireAppSession()
    const response = await getCustomDomainState(session)

    return NextResponse.json(response)
  } catch (error) {
    return errorResponse(403, "custom_domain_read_failed", error instanceof Error ? error.message : "Unable to load custom domain state.")
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireAppSession()
    const payload = await request.json()
    const parsed = updateCustomDomainRequestSchema.parse(payload)
    const response = await saveCustomDomainHostname(session, parsed.hostname)

    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof ZodError) {
      return zodErrorResponse(error)
    }

    return errorResponse(400, "custom_domain_update_failed", error instanceof Error ? error.message : "Unable to save custom domain state.")
  }
}
