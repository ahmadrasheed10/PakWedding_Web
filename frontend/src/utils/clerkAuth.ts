import { useAuthStore } from '../store/authStore'

type ClerkErrorItem = {
  message: string
  longMessage?: string
  code?: string
}

export function getClerkErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const extractErrors = (source: any): ClerkErrorItem[] | undefined => {
    if (!source || typeof source !== 'object') return undefined
    if (Array.isArray(source.errors)) return source.errors
    if (Array.isArray(source?.response?.data?.errors)) return source.response.data.errors
    if (Array.isArray(source?.data?.errors)) return source.data.errors
    return undefined
  }

  const errors = extractErrors(err)
  if (errors?.length) {
    const first = errors[0]
    const normalizedCode = first.code?.toString().toLowerCase() || ''
    if (normalizedCode.includes('form_identifier_exists') || normalizedCode.includes('identifier_exists') || normalizedCode.includes('identifier_in_use')) {
      return 'This email is already registered. Please login or reset your password.'
    }
    if (normalizedCode.includes('form_password_incorrect') || normalizedCode.includes('password_incorrect')) {
      return 'Incorrect email or password. Please try again.'
    }
    return first.longMessage || first.message || fallback
  }

  if (err && typeof err === 'object') {
    const data = (err as any)?.response?.data || (err as any)?.data
    if (data) {
      // Handle FastAPI's detail field
      if (data.detail) {
        if (typeof data.detail === 'string') return data.detail
        if (Array.isArray(data.detail) && data.detail[0]?.msg) return data.detail[0].msg
      }
      if (typeof data.message === 'string' && data.message.trim()) {
        return data.message
      }
    }
    const message = (err as any)?.message
    if (typeof message === 'string' && message.trim()) {
      return message
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
