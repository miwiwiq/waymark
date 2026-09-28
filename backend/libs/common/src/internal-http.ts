import { ServiceUnavailableException } from '@nestjs/common';

const TIMEOUT_MS = 2000;

/**
 * Calls another service over the Docker network (decision A6): a 2 s timeout,
 * and any failure becomes 503. A 404 returns null for the caller to interpret.
 */
export async function internalRequest<T>(url: string, init: RequestInit = {}): Promise<T | null> {
  const service = new URL(url).host;
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new ServiceUnavailableException(`${service} is unavailable`);
  }
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new ServiceUnavailableException(`${service} answered ${res.status}`);
  }
  return (await res.json()) as T;
}
