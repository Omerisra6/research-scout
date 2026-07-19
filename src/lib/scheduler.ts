import { getProfile, getLastDigestRunAt } from '@/lib/db';
import { runDailyDigest } from '@/lib/digest';

const CHECK_INTERVAL_MS = 60_000;

function parseSqliteUtc(value: string): Date {
  return new Date(value.replace(' ', 'T') + 'Z');
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function startDigestScheduler() {
  const globalState = globalThis as typeof globalThis & { __digestSchedulerStarted?: boolean };
  if (globalState.__digestSchedulerStarted) return;
  globalState.__digestSchedulerStarted = true;

  let running = false;

  async function tick() {
    if (running) return;

    const profile = getProfile();
    if (!profile.digest_enabled) return;

    const now = new Date();
    if (now.getHours() !== profile.digest_hour) return;

    const lastRunAt = getLastDigestRunAt();
    if (lastRunAt && isSameLocalDay(parseSqliteUtc(lastRunAt), now)) return;

    running = true;
    try {
      const outcome = await runDailyDigest();
      console.log(`[digest] ${outcome.status}: ${outcome.detail}`);
    } catch (error) {
      console.error('[digest] Unexpected failure:', error);
    } finally {
      running = false;
    }
  }

  setInterval(() => {
    tick().catch(error => console.error('[digest] Tick failed:', error));
  }, CHECK_INTERVAL_MS);

  console.log('[digest] Scheduler started (checks every minute for the configured send hour).');
}
