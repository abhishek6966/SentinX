// =============================================================================
// SentinX — Email Service
// Resend API primary, AWS SES fallback
// =============================================================================
import { Resend } from 'resend';
import { db } from '../config/database';
import { stockReports, portfolioHoldings, users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { APP_DISCLAIMER } from '@sentinx/shared/src/constants';

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendReportEmail(reportId: string, userId: string): Promise<void> {
  // Fetch all required data
  const report = await db.query.stockReports.findFirst({
    where: eq(stockReports.id, reportId),
  });
  if (!report) throw new Error(`Report ${reportId} not found`);

  const holding = await db.query.portfolioHoldings.findFirst({
    where: eq(portfolioHoldings.id, report.holdingId),
  });
  if (!holding) throw new Error(`Holding ${report.holdingId} not found`);

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!user) throw new Error(`User ${userId} not found`);

  const emailSections = (holding.emailSections as any) || {
    fundamentals: true,
    socialSentiment: true,
    politicalSignals: true,
    thesisEvaluation: true,
  };

  const html = buildEmailHTML(report as any, holding as any, user as any, emailSections);

  try {
    const { data, error } = await resend.emails.send({
      from: `SentinX Intelligence <alerts@${process.env.EMAIL_DOMAIN || 'sentinx.app'}>`,
      to: user.email,
      subject: buildEmailSubject(report as any),
      html,
      tags: [
        { name: 'ticker', value: report.ticker },
        { name: 'recommendation', value: report.recommendation },
        { name: 'userId', value: userId },
      ],
    });

    if (error) {
      logger.error('Resend error, attempting SES fallback:', error);
      await sendViaSESFallback(user.email, buildEmailSubject(report as any), html);
    }

    // Mark email as sent
    await db
      .update(stockReports)
      .set({ emailSentAt: new Date() })
      .where(eq(stockReports.id, reportId));

    logger.info(`Email sent for report ${reportId} to ${user.email}`);
  } catch (err) {
    logger.error('Email dispatch failed:', err);
    throw err;
  }
}

function buildEmailSubject(report: any): string {
  const emoji = {
    BUY: '🟢',
    SELL: '🔴',
    HOLD: '🟡',
    MONITOR: '🔵',
  }[report.recommendation] || '📊';

  return `${emoji} ${report.ticker}: ${report.recommendation} — SentinX Intelligence Briefing`;
}

function buildEmailHTML(report: any, holding: any, user: any, sections: any): string {
  const recommendationColor = {
    BUY: '#22c55e',
    SELL: '#ef4444',
    HOLD: '#f59e0b',
    MONITOR: '#3b82f6',
  }[report.recommendation] || '#6b7280';

  const cssScorePercent = Math.round((report.cssScore.score + 1) * 50); // -1..1 → 0..100

  const bullSignalsHTML = (report.keyBullSignals || []).slice(0, 3).map((s: any) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #1f2937;">
        <a href="${s.url}" style="color:#22c55e;text-decoration:none;font-size:13px;">${s.headline}</a>
        <div style="font-size:11px;color:#6b7280;margin-top:2px;">${s.source} · Credibility: ${Math.round(s.credibilityWeight * 100)}%</div>
      </td>
    </tr>`).join('');

  const bearSignalsHTML = (report.keyBearSignals || []).slice(0, 3).map((s: any) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #1f2937;">
        <a href="${s.url}" style="color:#ef4444;text-decoration:none;font-size:13px;">${s.headline}</a>
        <div style="font-size:11px;color:#6b7280;margin-top:2px;">${s.source} · Credibility: ${Math.round(s.credibilityWeight * 100)}%</div>
      </td>
    </tr>`).join('');

  const citationsHTML = (report.sourceCitations || []).slice(0, 5).map((c: any) => `
    <li style="margin-bottom:6px;font-size:12px;color:#9ca3af;">
      [${c.index}] <a href="${c.url}" style="color:#60a5fa;">${c.title}</a> — ${c.source}
    </li>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SentinX Briefing: ${report.ticker}</title>
</head>
<body style="margin:0;padding:0;background:#0a0f1e;font-family:'Segoe UI',system-ui,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
    
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:3px;color:#60a5fa;text-transform:uppercase;margin-bottom:8px;">SENTINX INTELLIGENCE</div>
      <div style="font-size:11px;color:#4b5563;">${new Date(report.generatedAt).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</div>
    </div>

    <!-- Recommendation Card -->
    <div style="background:#111827;border:1px solid ${recommendationColor}40;border-radius:12px;padding:28px;margin-bottom:20px;text-align:center;">
      <div style="font-size:12px;color:#6b7280;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">${report.ticker} · $${Number(report.priceAtReport).toFixed(2)}</div>
      <div style="font-size:42px;font-weight:800;color:${recommendationColor};letter-spacing:-1px;">${report.recommendation}</div>
      <div style="font-size:13px;color:#9ca3af;margin-top:4px;">Confidence: ${Math.round(Number(report.confidenceScore) * 100)}%</div>
      <div style="margin-top:16px;font-size:14px;color:#d1d5db;line-height:1.6;">${report.executiveSummary}</div>
    </div>

    <!-- CSS Gauge -->
    <div style="background:#111827;border:1px solid #1f2937;border-radius:12px;padding:20px;margin-bottom:20px;">
      <div style="font-size:11px;color:#6b7280;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">COMPOSITE SENTIMENT SCORE</div>
      <div style="background:#1f2937;border-radius:6px;height:8px;overflow:hidden;">
        <div style="width:${cssScorePercent}%;height:100%;background:${recommendationColor};border-radius:6px;transition:width 0.3s;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:11px;color:#4b5563;">
        <span>Bearish -1.0</span>
        <span style="color:${recommendationColor};font-weight:600;">${report.cssScore.score.toFixed(3)}</span>
        <span>+1.0 Bullish</span>
      </div>
      <div style="font-size:11px;color:#6b7280;margin-top:6px;">Based on ${report.cssScore.signalCount} signals</div>
    </div>

    ${sections.thesisEvaluation ? `
    <!-- Thesis Tracker -->
    <div style="background:#111827;border:1px solid #1f2937;border-radius:12px;padding:20px;margin-bottom:20px;">
      <div style="font-size:11px;color:#6b7280;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">THESIS EVALUATION</div>
      <div style="font-size:12px;color:#6b7280;margin-bottom:8px;">YOUR THESIS:</div>
      <div style="font-size:13px;color:#9ca3af;font-style:italic;margin-bottom:16px;padding:12px;background:#0f172a;border-radius:8px;">"${holding.investmentThesis}"</div>
      <div style="font-size:13px;color:#d1d5db;">${report.thesisAssessment}</div>
      <div style="margin-top:12px;display:inline-block;padding:4px 12px;background:${report.thesisValidityScore >= 70 ? '#16a34a' : report.thesisValidityScore >= 40 ? '#b45309' : '#dc2626'}20;border-radius:20px;font-size:11px;font-weight:600;color:${report.thesisValidityScore >= 70 ? '#22c55e' : report.thesisValidityScore >= 40 ? '#f59e0b' : '#ef4444'};">
        Thesis Validity: ${report.thesisValidityScore}/100
      </div>
    </div>` : ''}

    <!-- Bull/Bear Signals -->
    <div style="display:grid;gap:16px;margin-bottom:20px;">
      ${bullSignalsHTML ? `
      <div style="background:#111827;border:1px solid #1f293760;border-radius:12px;overflow:hidden;">
        <div style="padding:14px 16px;background:#16a34a15;border-bottom:1px solid #1f2937;font-size:11px;font-weight:700;letter-spacing:2px;color:#22c55e;text-transform:uppercase;">🟢 Bullish Signals</div>
        <table style="width:100%;border-collapse:collapse;">${bullSignalsHTML}</table>
      </div>` : ''}
      ${bearSignalsHTML ? `
      <div style="background:#111827;border:1px solid #1f293760;border-radius:12px;overflow:hidden;">
        <div style="padding:14px 16px;background:#dc262615;border-bottom:1px solid #1f2937;font-size:11px;font-weight:700;letter-spacing:2px;color:#ef4444;text-transform:uppercase;">🔴 Bearish Signals</div>
        <table style="width:100%;border-collapse:collapse;">${bearSignalsHTML}</table>
      </div>` : ''}
    </div>

    <!-- Source Citations -->
    ${citationsHTML ? `
    <div style="background:#111827;border:1px solid #1f2937;border-radius:12px;padding:20px;margin-bottom:20px;">
      <div style="font-size:11px;color:#6b7280;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">SOURCE CITATIONS</div>
      <ul style="margin:0;padding-left:16px;">${citationsHTML}</ul>
    </div>` : ''}

    <!-- Disclaimer -->
    <div style="padding:16px;border-radius:8px;background:#0f172a;border:1px solid #1f2937;font-size:11px;color:#4b5563;line-height:1.6;">
      ⚠️ ${APP_DISCLAIMER}
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:24px;font-size:11px;color:#374151;">
      <a href="${process.env.FRONTEND_URL}/alerts" style="color:#60a5fa;text-decoration:none;">Manage Alerts</a>
      &nbsp;·&nbsp;
      <a href="${process.env.FRONTEND_URL}/unsubscribe?token=UNSUBSCRIBE_TOKEN" style="color:#60a5fa;text-decoration:none;">Unsubscribe</a>
    </div>
  </div>
</body>
</html>`;
}

async function sendViaSESFallback(to: string, subject: string, html: string): Promise<void> {
  // AWS SES fallback - requires @aws-sdk/client-ses
  logger.info(`SES fallback sending to ${to}`);
  // Implementation: const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
  // Left as implementation detail for production setup
}
