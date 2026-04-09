import { NextResponse } from "next/server"
import { ZodError } from "zod"

import { firstAdminBootstrapRequestSchema } from "@/lib/contracts/bootstrap"
import { errorResponse, zodErrorResponse } from "@/lib/server/http/error-response"
import { BootstrapClosedError, createFirstAdmin, isBootstrapOpen } from "@/lib/server/bootstrap/service"

export async function GET() {
  return NextResponse.json({ bootstrapOpen: await isBootstrapOpen() })
}

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const parsed = firstAdminBootstrapRequestSchema.parse(payload)
    const response = await createFirstAdmin(parsed)

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      return zodErrorResponse(error)
    }

    if (error instanceof BootstrapClosedError) {
      return errorResponse(409, "bootstrap_closed", error.message)
    }

    return errorResponse(400, "bootstrap_failed", error instanceof Error ? error.message : "Unable to create the first admin account.")
  }
}
