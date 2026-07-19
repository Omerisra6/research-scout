export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startDigestScheduler } = await import('@/lib/scheduler');
    startDigestScheduler();
  }
}
