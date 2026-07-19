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

function scoreColor(score: number): string {
  if (score >= 7) return '#166534';
  if (score >= 4) return '#854d0e';
  return '#4b5563';
}

export function renderDigest(papers: PaperWithScore[], baseUrl: string): { subject: string; html: string; text: string } {
  const date = new Date().toISOString().slice(0, 10);
  const subject = `Research Scout digest — ${papers.length} promising paper${papers.length === 1 ? '' : 's'} (${date})`;

  const items = papers.map(paper => {
    const score = paper.score!;
    const authors = paper.authors.split(',').slice(0, 3).join(', ');
    return `
      <tr>
        <td style="padding:16px 0;border-bottom:1px solid #e5e7eb;">
          <div style="margin-bottom:4px;">
            <span style="display:inline-block;padding:2px 10px;border-radius:9999px;font-size:13px;font-weight:600;color:#ffffff;background:${scoreColor(score.viability)};">${score.viability}/10</span>
            <span style="font-size:12px;color:#6b7280;margin-left:8px;">${escapeHtml(paper.categories.split(',')[0])}</span>
          </div>
          <a href="${baseUrl}/paper/${paper.id}" style="font-size:16px;font-weight:600;color:#111827;text-decoration:none;">${escapeHtml(paper.title)}</a>
          <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${escapeHtml(authors)}</p>
          ${score.discovery ? `<p style="margin:8px 0 0;font-size:14px;color:#1f2937;">${escapeHtml(score.discovery)}</p>` : ''}
          ${score.application_hint ? `<p style="margin:4px 0 0;font-size:13px;font-style:italic;color:#4b5563;">${escapeHtml(score.application_hint)}</p>` : ''}
          <p style="margin:8px 0 0;font-size:13px;">
            <a href="${baseUrl}/paper/${paper.id}" style="color:#2563eb;text-decoration:none;">Deep-dive →</a>
            &nbsp;&nbsp;
            <a href="${escapeHtml(paper.url)}" style="color:#2563eb;text-decoration:none;">Source →</a>
          </p>
        </td>
      </tr>`;
  }).join('');

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;padding:24px;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
      <h1 style="margin:0 0 4px;font-size:20px;color:#111827;">Research Scout</h1>
      <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">Your daily digest — ${papers.length} paper${papers.length === 1 ? '' : 's'} worth a look</p>
      <table style="width:100%;border-collapse:collapse;">${items}</table>
      <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">
        <a href="${baseUrl}" style="color:#9ca3af;">Open Research Scout</a> · adjust digest settings on the Settings page
      </p>
    </div>
  </div>`;

  const text = papers.map(paper => {
    const score = paper.score!;
    return `[${score.viability}/10] ${paper.title}\n${score.discovery}\n${baseUrl}/paper/${paper.id}\n`;
  }).join('\n');

  return { subject, html, text };
}
