import nodemailer from 'nodemailer';
import type { PaperWithScore } from '@/lib/db';

export function isMailerConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

export function createMailer() {
  const host = process.env.SMTP_HOST;
  if (!host) {
    throw new Error('SMTP_HOST is not configured. Set SMTP_* variables in your environment.');
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: user ? { user, pass } : undefined,
  });

  const from = process.env.MAIL_FROM || user || 'research-scout@localhost';

  async function send(options: { to: string; subject: string; html: string; text: string }) {
    return transport.sendMail({ from, ...options });
  }

  return { send };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function scoreColors(score: number): { bg: string; text: string } {
  if (score >= 7) return { bg: '#dcfce7', text: '#166534' };
  if (score >= 4) return { bg: '#fef9c3', text: '#854d0e' };
  return { bg: '#f3f4f6', text: '#4b5563' };
}

export function renderDigest(papers: PaperWithScore[], baseUrl: string): { subject: string; html: string; text: string } {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const subject = `Research Scout — ${papers.length} paper${papers.length === 1 ? '' : 's'} worth a look`;

  const cards = papers.map(paper => {
    const score = paper.score!;
    const colors = scoreColors(score.viability);
    const authors = paper.authors.split(',').slice(0, 3).map(a => a.trim()).join(', ');
    const category = paper.categories.split(',')[0]?.trim() ?? '';
    return `
      <tr>
        <td style="padding:0 0 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
            <tr>
              <td style="padding:20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <span style="display:inline-block;padding:4px 12px;border-radius:9999px;font-size:14px;font-weight:700;color:${colors.text};background:${colors.bg};">${score.viability}/10</span>
                    </td>
                    <td align="right" style="vertical-align:middle;font-size:12px;color:#9ca3af;">${escapeHtml(category)}</td>
                  </tr>
                </table>
                <a href="${baseUrl}/paper/${paper.id}" style="display:block;margin:12px 0 6px;font-size:18px;line-height:1.35;font-weight:700;color:#111827;text-decoration:none;">${escapeHtml(paper.title)}</a>
                <p style="margin:0 0 12px;font-size:13px;color:#6b7280;">${escapeHtml(authors)}</p>
                ${(score.tldr || score.discovery) ? `<p style="margin:0 0 8px;font-size:15px;line-height:1.5;color:#1f2937;">${escapeHtml(score.tldr || score.discovery)}</p>` : ''}
                ${score.tldr_points && score.tldr_points.length > 0 ? `<ul style="margin:0 0 10px;padding-left:20px;">${score.tldr_points.map(pt => `<li style="margin:2px 0;font-size:14px;line-height:1.45;color:#374151;">${escapeHtml(pt)}</li>`).join('')}</ul>` : ''}
                ${score.application_hint ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:10px 14px;background:#f9fafb;border-left:3px solid #d1d5db;border-radius:6px;font-size:13px;line-height:1.5;font-style:italic;color:#4b5563;">${escapeHtml(score.application_hint)}</td></tr></table>` : ''}
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                  <tr>
                    <td style="border-radius:8px;background:#2563eb;">
                      <a href="${baseUrl}/paper/${paper.id}" style="display:inline-block;padding:10px 18px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Deep-dive</a>
                    </td>
                    <td style="width:10px;"></td>
                    <td style="border-radius:8px;border:1px solid #d1d5db;">
                      <a href="${escapeHtml(paper.url)}" style="display:inline-block;padding:10px 18px;font-size:14px;font-weight:600;color:#374151;text-decoration:none;">Source</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${papers.length} paper${papers.length === 1 ? '' : 's'} above your score threshold for ${escapeHtml(date)}.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <tr>
            <td style="padding:0 4px 20px;">
              <h1 style="margin:0;font-size:22px;font-weight:800;color:#111827;">Research Scout</h1>
              <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${escapeHtml(date)} · ${papers.length} paper${papers.length === 1 ? '' : 's'} worth a look</p>
            </td>
          </tr>
          ${cards}
          <tr>
            <td style="padding:8px 4px 0;font-size:12px;line-height:1.6;color:#9ca3af;">
              <a href="${baseUrl}" style="color:#6b7280;text-decoration:underline;">Open Research Scout</a> · adjust frequency, score threshold and recipient on the Settings page.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = papers.map(paper => {
    const score = paper.score!;
    const points = score.tldr_points && score.tldr_points.length > 0
      ? '\n' + score.tldr_points.map(pt => `- ${pt}`).join('\n')
      : '';
    return `[${score.viability}/10] ${paper.title}\n${score.tldr || score.discovery}${points}\n${baseUrl}/paper/${paper.id}\n`;
  }).join('\n');

  return { subject, html, text };
}
