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
      status.textContent = '';
document.getElementById('success-modal').hidden = false;
document.getElementById('success-confirm').focus();
      form.reset();
    } catch (error) {
      status.textContent = error.message || '연결 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
    } finally {
      button.disabled = false;
    }
  });
}
const successModal = document.createElement('div');
successModal.id = 'success-modal';
successModal.hidden = true;
successModal.setAttribute('role', 'dialog');
successModal.setAttribute('aria-modal', 'true');
successModal.setAttribute('aria-labelledby', 'success-title');

successModal.innerHTML = `
  <div style="position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:20px;z-index:99999;">
    <div style="width:100%;max-width:360px;background:#fff;border-radius:16px;padding:28px 22px;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.2);">
      <div style="font-size:36px;margin-bottom:12px;">✓</div>
      <h2 id="success-title" style="font-size:21px;color:#17365d;margin:0 0 12px;">상담 신청이 완료되었습니다.</h2>
      <p style="font-size:16px;color:#444;margin:0 0 24px;">상담원이 연락드리겠습니다.</p>
      <button id="success-confirm" type="button" style="width:100%;padding:13px;background:#1769d2;color:#fff;border:0;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;">확인</button>
    </div>
  </div>
`;

document.body.appendChild(successModal);

document.getElementById('success-confirm').addEventListener('click', () => {
  successModal.hidden = true;
});
