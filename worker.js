const json = (data, status = 200, extraHeaders = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders }
});

const encoder = new TextEncoder();
const SESSION_SECONDS = 8 * 60 * 60;

function constantTimeEqual(a, b) {
  a = String(a ?? ''); b = String(b ?? '');
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function fromBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
async function sign(value, secret) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
}
async function makeSession(secret) {
  const payload = toBase64Url(encoder.encode(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })));
  return `${payload}.${await sign(payload, secret)}`;
}
async function validSession(request, secret) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)barun_admin_session=([^;]+)/);
  if (!match) return false;
  const parts = match[1].split('.');
  if (parts.length !== 2 || !constantTimeEqual(parts[1], await sign(parts[0], secret))) return false;
  try { return JSON.parse(new TextDecoder().decode(fromBase64Url(parts[0]))).exp > Math.floor(Date.now() / 1000); }
  catch { return false; }
}
function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/applications') {
      if (request.method !== 'POST') return json({ message: '지원하지 않는 요청입니다.' }, 405);
      if (!sameOrigin(request)) return json({ message: '요청을 확인할 수 없습니다.' }, 403);
      let body;
      try { body = await request.json(); }
      catch { return json({ message: '입력 내용을 확인해 주세요.' }, 400); }

      const name = String(body.name || '').trim();
      const phone = String(body.phone || '').replace(/[\s()-]/g, '');
      if (body.website) return json({ message: '접수할 수 없습니다.' }, 400);
      if (name.length < 2 || name.length > 40) return json({ message: '이름을 확인해 주세요.' }, 400);
      if (!/^01[016789]\d{7,8}$/.test(phone)) return json({ message: '휴대전화번호를 확인해 주세요. 숫자만 입력해 주세요.' }, 400);
      if (body.privacyConsent !== true) return json({ message: '개인정보 수집·이용 동의가 필요합니다.' }, 400);
      if (!env.APPLICATIONS) return json({ message: '접수 저장소 설정이 아직 완료되지 않았습니다. 운영자에게 문의해 주세요.' }, 503);

      const id = crypto.randomUUID();
      try {
        await env.APPLICATIONS.prepare('INSERT INTO applications (id, name, phone, created_at, status) VALUES (?, ?, ?, ?, ?)')
          .bind(id, name, phone, new Date().toISOString(), 'new').run();
      } catch {
        return json({ message: '신청 저장 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, 500);
      }

      if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
        try {
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: `새 상담 신청 접수\n접수번호: ${id}` })
          });
        } catch { /* application storage must succeed even if notification fails */ }
      }
      return json({ ok: true, applicationId: id }, 201);
    }

    if (url.pathname === '/api/admin/login') {
      if (request.method !== 'POST') return json({ message: '지원하지 않는 요청입니다.' }, 405);
      if (!sameOrigin(request)) return json({ message: '요청을 확인할 수 없습니다.' }, 403);
      if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) {
        return json({ message: '관리자 로그인 설정이 아직 완료되지 않았습니다.' }, 503);
      }
      let body;
      try { body = await request.json(); } catch { return json({ message: '아이디와 비밀번호를 입력해 주세요.' }, 400); }
      if (!constantTimeEqual(body.username, env.ADMIN_USERNAME) || !constantTimeEqual(body.password, env.ADMIN_PASSWORD)) {
        return json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' }, 401);
      }
      const token = await makeSession(env.ADMIN_SESSION_SECRET);
      return json({ ok: true }, 200, { 'Set-Cookie': `barun_admin_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}` });
    }

    if (url.pathname === '/api/admin/logout') {
      if (request.method !== 'POST') return json({ message: '지원하지 않는 요청입니다.' }, 405);
      return json({ ok: true }, 200, { 'Set-Cookie': 'barun_admin_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0' });
    }

    if (url.pathname === '/api/admin/applications') {
      if (request.method !== 'GET') return json({ message: '지원하지 않는 요청입니다.' }, 405);
      if (!env.ADMIN_SESSION_SECRET || !(await validSession(request, env.ADMIN_SESSION_SECRET))) {
        return json({ message: '로그인이 필요합니다.' }, 401);
      }
      if (!env.APPLICATIONS) return json({ message: '접수 저장소 설정을 확인해 주세요.' }, 503);
      try {
        const result = await env.APPLICATIONS.prepare(
          'SELECT id, name, phone, created_at, status FROM applications ORDER BY created_at DESC LIMIT 500'
        ).all();
        return json({ applications: result.results || [] });
      } catch {
        return json({ message: '상담 내역을 불러오지 못했습니다.' }, 500);
      }
    }

    if (url.pathname === '/admin' || url.pathname === '/admin/') {
      return env.ASSETS.fetch(new Request(new URL('/admin.html', request.url), request));
    }
    return env.ASSETS.fetch(request);
  }
};
