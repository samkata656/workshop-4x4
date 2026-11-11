// Code node "Build branded e-mail" in "Workshop — Send offer e-mail".
// Turns the owner's approved plain text into an HTML e-mail in the site's look:
// carbon background, rust accent, condensed uppercase headings, mono labels.
// The text is escaped first, so nothing typed in the offer can become markup.

const SITE_URL = 'https://workshop.samkobuilds.com';
const C = {
  carbon: '#171c19',
  raised: '#1d2420',
  olive: '#343d32',
  rust: '#c36a3c',
  rustBright: '#d98250',
  sand: '#d9d1c3',
  paper: '#f2f0e9',
  muted: '#9a968c',
  line: '#343a36',
};
const DISPLAY = "'Sofia Sans Extra Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
const SANS = "Manrope,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'JetBrains Mono','SFMono-Regular',Consolas,'Courier New',monospace";

const { to, subject, body, requestId } = $input.first().json.body;

const escapeHtml = (text) =>
  String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Blank line = new paragraph; single line break stays a line break.
const paragraphs = String(body ?? '')
  .replace(/\r\n/g, '\n')
  .trim()
  .split(/\n{2,}/)
  .map(
    (block) =>
      `<p style="margin:0 0 18px 0;font-family:${SANS};font-size:16px;line-height:1.65;color:${C.paper};">${escapeHtml(block).replace(/\n/g, '<br>')}</p>`,
  )
  .join('\n');

const label = (text, color = C.muted) =>
  `<span style="font-family:${MONO};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${color};">${text}</span>`;

const html = `<!doctype html>
<html lang="bg">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.carbon};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.carbon};">Ориентировъчна оферта от 4×4 Сервиз за вашето запитване.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.carbon}" style="background-color:${C.carbon};">
<tr><td align="center" style="padding:32px 12px;">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

    <!-- Header: the site's wordmark -->
    <tr><td style="padding:0 4px 18px 4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td align="left" valign="bottom">
          <a href="${SITE_URL}" style="text-decoration:none;font-family:${DISPLAY};font-size:38px;line-height:1;font-weight:700;letter-spacing:0.03em;color:${C.paper};">4<span style="color:${C.rust};">&times;</span>4</a>
        </td>
        <td align="right" valign="bottom">${label('Toyota &middot; Lexus GX/LX')}</td>
      </tr></table>
    </td></tr>

    <!-- Card -->
    <tr><td bgcolor="${C.raised}" style="background-color:${C.raised};border:1px solid ${C.line};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td height="6" bgcolor="${C.rust}" style="height:6px;line-height:6px;font-size:0;background-color:${C.rust};background-image:repeating-linear-gradient(-45deg,${C.rust} 0,${C.rust} 6px,${C.raised} 6px,${C.raised} 12px);">&nbsp;</td></tr>
        <tr><td style="padding:30px 28px 8px 28px;">
          ${label('N&deg; ' + escapeHtml(String(requestId ?? '')).padStart(2, '0'), C.rustBright)} ${label('/ Оферта за модификации')}
          <h1 style="margin:14px 0 24px 0;font-family:${DISPLAY};font-size:44px;line-height:0.98;font-weight:700;text-transform:uppercase;letter-spacing:0.01em;color:${C.paper};">${escapeHtml(subject)}</h1>
        </td></tr>
        <tr><td style="padding:0 28px 10px 28px;border-top:1px solid ${C.line};">
          <div style="height:24px;line-height:24px;font-size:0;">&nbsp;</div>
          ${paragraphs}
        </td></tr>
        <tr><td style="padding:6px 28px 30px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td bgcolor="${C.rust}" style="background-color:${C.rust};">
              <a href="${SITE_URL}" style="display:inline-block;padding:14px 22px;font-family:${MONO};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;color:${C.carbon};">Към сайта &rarr;</a>
            </td>
          </tr></table>
        </td></tr>
        <tr><td bgcolor="${C.olive}" style="background-color:${C.olive};padding:14px 28px;">
          <span style="font-family:${SANS};font-size:13px;line-height:1.5;color:${C.sand};">Цените са ориентировъчни. Точната оферта и цената на труда потвърждаваме след оглед в сервиза.</span>
        </td></tr>
      </table>
    </td></tr>

    <!-- Footer -->
    <tr><td style="padding:20px 4px 0 4px;">
      ${label('4&times;4 Сервиз &middot; рамкови Toyota и Lexus GX/LX')}
      <p style="margin:10px 0 0 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.muted};">Получавате този имейл, защото изпратихте запитване за модификация през <a href="${SITE_URL}" style="color:${C.sand};">workshop.samkobuilds.com</a>. Можете да отговорите директно на него.</p>
    </td></tr>

  </table>

</td></tr>
</table>
</body>
</html>`;

return [{ json: { to, subject, html, requestId } }];
