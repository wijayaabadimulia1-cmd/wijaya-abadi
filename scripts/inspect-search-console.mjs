import crypto from 'node:crypto';
import { appendFile } from 'node:fs/promises';

const secret = process.env.GSC_SERVICE_ACCOUNT_JSON;
const siteUrl = process.env.GSC_SITE_URL || 'sc-domain:kreditmotorhonda.tech';
const sitemapUrl = process.env.GSC_SITEMAP_URL || 'https://kreditmotorhonda.tech/sitemap.xml';
if (!secret) throw new Error('Missing GSC_SERVICE_ACCOUNT_JSON secret.');

const account = JSON.parse(secret);
const now = Math.floor(Date.now() / 1000);
const b64 = (value) => Buffer.from(value).toString('base64url');
const unsigned = `${b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64(JSON.stringify({
  iss: account.client_email,
  scope: 'https://www.googleapis.com/auth/webmasters.readonly',
  aud: 'https://oauth2.googleapis.com/token',
  iat: now,
  exp: now + 3600,
}))}`;
const signer = crypto.createSign('RSA-SHA256');
signer.update(unsigned);
signer.end();
const assertion = `${unsigned}.${signer.sign(account.private_key, 'base64url')}`;
const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
});
const tokenBody = await tokenResponse.json();
if (!tokenResponse.ok) throw new Error(`OAuth failed: ${JSON.stringify(tokenBody)}`);

const sitemapResponse = await fetch(sitemapUrl);
if (!sitemapResponse.ok) throw new Error(`Sitemap returned HTTP ${sitemapResponse.status}`);
const xml = await sitemapResponse.text();
const propertyDomain = siteUrl.startsWith('sc-domain:') ? siteUrl.slice('sc-domain:'.length).toLowerCase() : null;
const urls = [...new Set([...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((match) => match[1].trim()))]
  .filter((url) => {
    if (!/^https:\/\//i.test(url)) return false;
    if (!propertyDomain) return url.startsWith(siteUrl);
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === propertyDomain || hostname.endsWith(`.${propertyDomain}`);
  })
  .slice(0, 1900);
if (!urls.length) throw new Error('Sitemap has no eligible URLs.');

const results = [];
for (const inspectionUrl of urls) {
  const response = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenBody.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inspectionUrl, siteUrl, languageCode: 'id-ID' }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Inspection failed for ${inspectionUrl}: ${JSON.stringify(body)}`);
  const status = body.inspectionResult?.indexStatusResult || {};
  results.push({ url: inspectionUrl, verdict: status.verdict || 'UNKNOWN', coverage: status.coverageState || '', indexing: status.indexingState || '', canonical: status.googleCanonical || status.userCanonical || '' });
}

const passed = results.filter((item) => item.verdict === 'PASS').length;
console.log(`Inspected ${results.length} URLs; ${passed} returned PASS.`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const rows = results.map((item) => `| [${new URL(item.url).pathname}](${item.url}) | ${item.verdict} | ${item.coverage} | ${item.indexing} | ${item.canonical || '-'} |`);
  await appendFile(process.env.GITHUB_STEP_SUMMARY, [
    '# Search Console URL Inspection', '',
    `Inspected ${results.length} URLs for ${siteUrl}; ${passed} returned PASS.`, '',
    'This reports indexed status only. It does not request indexing.', '',
    '| URL | Verdict | Coverage | Indexing | Canonical |', '| --- | --- | --- | --- | --- |', ...rows, '',
  ].join('\n'));
}
