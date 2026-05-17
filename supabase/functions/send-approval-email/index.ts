// Sends an "account approved" email to a newly approved member via Resend.
// Invoked from the client (admin store) after a successful approval.
//
// Required environment variables (set with `supabase secrets set`):
//   RESEND_API_KEY  — Resend API key
//   APPROVAL_FROM   — e.g. "RCMI Portal <noreply@rcmi.org>"
//   APP_URL         — e.g. "https://portal.rcmi.org"

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const APPROVAL_FROM = Deno.env.get('APPROVAL_FROM') ?? 'RCMI Portal <onboarding@resend.dev>'
const APP_URL = Deno.env.get('APP_URL') ?? 'https://portal.rcmi.org'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Payload {
    email: string
    firstName?: string | null
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (!RESEND_API_KEY) {
        return new Response(
            JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
    }

    let body: Payload
    try {
        body = await req.json()
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    if (!body.email) {
        return new Response(JSON.stringify({ error: 'email is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    const firstName = body.firstName?.trim() || 'there'
    const dashboardUrl = `${APP_URL}/app/dashboard`

    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5f6f8;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(15,23,42,0.06);">
        <tr><td style="background:#0b1d40;padding:32px 32px 24px;color:#ffffff;">
          <h1 style="margin:0;font-size:22px;font-weight:700;">RCMI Portal</h1>
          <p style="margin:6px 0 0;color:#c7d2fe;font-size:13px;">Account Approved</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 12px;font-size:20px;color:#0b1d40;">Welcome, ${escapeHtml(firstName)}!</h2>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">
            Great news — your account has been <strong>approved</strong> by your church administrator. You now have full access to the RCMI Portal.
          </p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">
            You can now post on the Devotional Wall, submit Prayer Requests, browse the Member Directory, RSVP to events, and use your QR code for fast check-in.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td>
            <a href="${dashboardUrl}" style="display:inline-block;background:#0b1d40;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:8px;">
              Go to Dashboard
            </a>
          </td></tr></table>
          <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;line-height:1.6;">
            If the button above doesn't work, paste this link into your browser:<br>
            <span style="color:#6b7280;">${dashboardUrl}</span>
          </p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:16px 32px;font-size:12px;color:#9ca3af;text-align:center;">
          You're receiving this because your RCMI account was approved.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim()

    const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: APPROVAL_FROM,
            to: [body.email],
            subject: 'Your RCMI Portal account has been approved',
            html,
        }),
    })

    const respBody = await resp.text()
    if (!resp.ok) {
        return new Response(
            JSON.stringify({ error: 'Resend API error', detail: respBody }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
    }

    return new Response(respBody, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
})

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]!))
}
