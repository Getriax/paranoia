import postgres from 'postgres';

// Stable, app-scoped 32-bit key for pg_advisory_lock.
// All replicas use the same key so only one can run boot init at a time.
const BOOT_LOCK_KEY = 7263911;

export async function withBootLock<T>(fn: () => Promise<T>): Promise<T> {
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error('POSTGRES_URL is required for boot lock');

  const client = postgres(url, { max: 1, prepare: false });
  try {
    await client`SELECT pg_advisory_lock(${BOOT_LOCK_KEY})`;
    return await fn();
  } finally {
    try {
      await client`SELECT pg_advisory_unlock(${BOOT_LOCK_KEY})`;
    } catch {
      // session close releases the lock anyway
    }
    await client.end({ timeout: 5 });
  }
}
