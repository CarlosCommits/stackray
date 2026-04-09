import { NextResponse } from "next/server"
import { ZodError } from "zod"

import { updateCustomDomainRequestSchema } from "@/lib/contracts/setup"
import { requireAppSession } from "@/lib/session/app-session"
import { errorResponse, zodErrorResponse } from "@/lib/server/http/error-response"
import { verifyCustomDomain } from "@/lib/server/setup/service"

export async function POST(request: Request) {
  try {
    const session = await requireAppSession()
    const payload = await request.json().catch(() => ({}))
    const parsed = Object.keys(payload).length > 0 ? updateCustomDomainRequestSchema.parse(payload) : { hostname: undefined }
    const response = await verifyCustomDomain(session, parsed.hostname)

    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof ZodError) {
      return zodErrorResponse(error)
    }

    return errorResponse(400, "custom_domain_verify_failed", error instanceof Error ? error.message : "Unable to verify the custom domain.")
  }
}
