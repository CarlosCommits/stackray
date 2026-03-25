import { ResetPasswordForm } from "@/components/auth/reset-password-form"

interface ResetPasswordPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams
  const token = typeof params.token === "string" ? params.token : null

  return (
    <div className="min-h-screen bg-[var(--gray-charcoal)] px-6 py-24">
      <ResetPasswordForm token={token} />
    </div>
  )
}
