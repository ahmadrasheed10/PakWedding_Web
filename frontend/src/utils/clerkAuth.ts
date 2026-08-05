import { useAuthStore } from '../store/authStore'

type ClerkErrorItem = {
  message: string
  longMessage?: string
  code?: string
}

export function getClerkErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err && typeof err === 'object' && 'errors' in err) {
    const clerkErr = err as { errors?: ClerkErrorItem[] }
    const first = clerkErr.errors?.[0]
    if (first) {
      const normalizedCode = first.code?.toString().toLowerCase() || ''
      if (normalizedCode.includes('form_identifier_exists') || normalizedCode.includes('identifier_exists') || normalizedCode.includes('identifier_in_use')) {
        return 'This email is already registered. Please login or reset your password.'
      }
      if (normalizedCode.includes('form_password_incorrect') || normalizedCode.includes('password_incorrect')) {
        return 'Incorrect email or password. Please try again.'
      }
      return first.longMessage || first.message
    }
  }

  if (err instanceof Error && err.message) {
    return err.message
  }

  return fallback
}

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim()
  const parts = trimmed.split(/\s+/)
  const firstName = parts[0] || ''
  const lastName = parts.slice(1).join(' ')
  return { firstName, lastName }
}

export async function waitForAuthSync(maxAttempts = 10, delayMs = 200): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i += 1) {
    const token = useAuthStore.getState().token
    if (token) return true
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  return false
}
