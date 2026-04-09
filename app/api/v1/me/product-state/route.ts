import { NextResponse } from "next/server"
import { ZodError } from "zod"

import { updateProductStateRequestSchema } from "@/lib/contracts/product-state"
import { requireAppSession } from "@/lib/session/app-session"
import { errorResponse, zodErrorResponse } from "@/lib/server/http/error-response"
import { getUserProductState, updateUserProductState } from "@/lib/server/product-state/service"

export async function GET() {
  try {
    const session = await requireAppSession()
    const response = await getUserProductState(session)

    return NextResponse.json(response)
  } catch (error) {
    return errorResponse(403, "product_state_read_failed", error instanceof Error ? error.message : "Unable to load product state.")
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAppSession()
    const payload = await request.json()
    const parsed = updateProductStateRequestSchema.parse(payload)
    const response = await updateUserProductState(session, parsed)

    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof ZodError) {
      return zodErrorResponse(error)
    }

    return errorResponse(400, "product_state_update_failed", error instanceof Error ? error.message : "Unable to update product state.")
  }
}
