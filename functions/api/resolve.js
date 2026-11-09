// Cloudflare Pages Function: GET /api/resolve?url=<google maps short or long link>
// Follows redirects and extracts coordinates. Only Google/goo.gl hosts are allowed.

const ALLOWED = /(^|\.)(google\.[a-z]{2,3}(\.[a-z]{2})?|goo\.gl|g\.co)$/i;
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36';

function coordsFrom(raw) {
  let s = raw;
  try { s = decodeURIComponent(raw); } catch (e) {}
  const m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
    || s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    || s.match(/[?&](?:q|query|ll|destination|daddr|center)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/i);
  return m ? { lat: +m[1], lng: +m[2] } : null;
}

function labelFrom(raw) {
  try {
    const m = decodeURIComponent(raw).match(/\/maps\/place\/([^/@?]+)/);
    if (m) return m[1].replace(/\+/g, ' ');
    const q = new URL(raw).searchParams.get('q');
    if (q && !/^-?\d/.test(q)) return q;
  } catch (e) {}
  return '';
}

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function onRequestGet({ request }) {
  let url;
  try { url = new URL(new URL(request.url).searchParams.get('url')); }
  catch (e) { return json({ error: 'bad url' }, 400); }
  if (!/^https?:$/.test(url.protocol) || !ALLOWED.test(url.hostname)) return json({ error: 'host not allowed' }, 400);

  let current = url.toString();
  for (let hop = 0; hop < 8; hop++) {
    const c = coordsFrom(current);
    if (c) return json({ ...c, label: labelFrom(current) });

    let res;
    try {
      res = await fetch(current, { redirect: 'manual', headers: { 'user-agent': UA, 'accept-language': 'en' } });
    } catch (e) { return json({ error: 'fetch failed' }, 502); }

    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) {
      const next = new URL(loc, current);
      if (!ALLOWED.test(next.hostname)) return json({ error: 'redirect not allowed' }, 400);
      current = next.toString();
      continue;
    }

    // Final page: look for coordinates inside the HTML
    const body = (await res.text()).slice(0, 400000);
    const b = body.match(/center=(-?\d+\.\d+)%2C(-?\d+\.\d+)/)
      || body.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
      || body.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/);
    const label = labelFrom(current);
    if (b) return json({ lat: +b[1], lng: +b[2], label });
    return json({ query: label || null });
  }
  return json({ error: 'too many redirects' }, 508);
}
