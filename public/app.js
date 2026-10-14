const form = document.querySelector('#application-form');
if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = document.querySelector('#form-status');
    const button = form.querySelector('button[type="submit"]');
    const name = document.querySelector('#name')?.value.trim() || '';
    const phone = document.querySelector('#phone')?.value.trim() || '';
    const consent = document.querySelector('#privacyConsent')?.checked === true;
    const honeypot = document.querySelector('#website')?.value || '';

    if (!form.reportValidity()) return;
    if (!consent) {
      status.textContent = '개인정보 수집·이용 동의가 필요합니다.';
      return;
    }
    if (honeypot) return;

    status.textContent = '신청 내용을 안전하게 전송하고 있습니다…';
    try {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, privacyConsent: consent, website: honeypot })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || '접수에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      status.textContent = '상담 신청이 완료되었습니다. 빠른 시일 내에 연락드리겠습니다.';
      form.reset();
    } catch (error) {
      status.textContent = error.message || '연결 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
    } finally {
      button.disabled = false;
    }
  });
}
