import { runIngest, runScoring } from '@/lib/scan';
import { getProfile, getLastDigest, recordDigest, getDigestPapers } from '@/lib/db';
import { createMailer, renderDigest, isMailerConfigured } from '@/lib/mailer';

export type DigestOutcome = {
  status: 'sent' | 'empty' | 'skipped' | 'error';
  paperCount: number;
  detail: string;
};

export function getAppBaseUrl(): string {
  return (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export async function runDailyDigest(options?: { force?: boolean }): Promise<DigestOutcome> {
  const profile = getProfile();

  if (!profile.digest_enabled && !options?.force) {
    return { status: 'skipped', paperCount: 0, detail: 'Digest is disabled in settings.' };
  }
  if (!profile.digest_email) {
    return { status: 'skipped', paperCount: 0, detail: 'No recipient email configured in settings.' };
  }
  if (!isMailerConfigured()) {
    return { status: 'skipped', paperCount: 0, detail: 'SMTP is not configured (set SMTP_HOST and friends).' };
  }

  try {
    await runIngest();
    await runScoring();

    const last = getLastDigest();
    const papers = getDigestPapers(last?.sent_at ?? null, profile.digest_min_score);

    if (papers.length === 0) {
      recordDigest({ paper_count: 0, status: 'empty', error: '' });
      return { status: 'empty', paperCount: 0, detail: 'No new papers above the score threshold.' };
    }

    const { subject, html, text } = renderDigest(papers, getAppBaseUrl());
    await createMailer().send({ to: profile.digest_email, subject, html, text });

    recordDigest({ paper_count: papers.length, status: 'sent', error: '' });
    return {
      status: 'sent',
      paperCount: papers.length,
      detail: `Sent ${papers.length} paper${papers.length === 1 ? '' : 's'} to ${profile.digest_email}.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    recordDigest({ paper_count: 0, status: 'error', error: message });
    return { status: 'error', paperCount: 0, detail: message };
  }
}
