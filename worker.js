const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/applications') {
      if (request.method !== 'POST') return json({ message: '지원하지 않는 요청입니다.' }, 405);
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return json({ message: '요청을 확인할 수 없습니다.' }, 403);
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
        await env.APPLICATIONS.prepare(
          'INSERT INTO applications (id, name, phone, created_at, status) VALUES (?, ?, ?, ?, ?)'
        ).bind(id, name, phone, new Date().toISOString(), 'new').run();
      } catch (err) {
        return json({ message: '신청 저장 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, 500);
      }

      // Optional Telegram alert: application ID only. Never send name or phone to Telegram.
      if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
        try {
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: `새 상담 신청 접수\n접수번호: ${id}` })
          });
        } catch (_) { /* Saving the application must succeed even if notification fails. */ }
      }
      return json({ ok: true, applicationId: id }, 201);
    }
    return env.ASSETS.fetch(request);
  }
};
