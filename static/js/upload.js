/** Certificate upload + OCR preview */
(function () {
  function getInput() {
    return document.querySelector(
      '#certificateInput, input[name="certificate"], input[name="document"].certificate-upload, .certificate-upload'
    );
  }

  function showOcrPanel(data) {
    let panel = document.getElementById('ocrPreviewPanel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'ocrPreviewPanel';
      panel.className = 'ocr-preview surface-card mt-3 p-3';
      const anchor = document.querySelector('.upload-zone') || document.querySelector('form');
      anchor?.parentElement?.appendChild(panel);
    }
    const pct = data.confidence_percent ?? Math.round((data.confidence_score || 0) * 100);
    panel.innerHTML = `
      <h6><i class="bi bi-shield-check"></i> Certificate scan</h6>
      <p class="mb-1"><strong>${data.scanner_verdict || data.verification_status}</strong></p>
      <p class="small mb-0">Confidence ${pct}% · Risk ${data.fraud_risk || '—'}</p>`;
    panel.dataset.ocr = JSON.stringify(data);
    window.SAAMS = window.SAAMS || {};
    window.SAAMS.lastOcrPreview = data;
  }

  async function preview(file) {
    if (!window.SAAMS?.urls?.ocrPreview) return;
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(window.SAAMS.urls.ocrPreview, {
      method: 'POST',
      headers: { 'X-CSRFToken': window.SAAMS.csrfToken },
      body: fd,
    });
    if (res.ok) showOcrPanel(await res.json());
  }

  function bind() {
    const input = getInput();
    const zone = document.querySelector('.upload-zone');
    if (!input) return;
    input.addEventListener('change', () => {
      const f = input.files?.[0];
      if (!f) return;
      console.debug('[SAAMS] Selected file:', f.name);
      window.SAAMS = window.SAAMS || {};
      window.SAAMS.pendingCertificate = { name: f.name, file: f };
      document.dispatchEvent(new CustomEvent('saams:file-selected', { detail: { name: f.name } }));
      if (window.SAAMS.urls?.ocrPreview) preview(f);

      // Auto-upload/submit after file selection
      setTimeout(() => {
        // Try to find the existing upload/submit button
        const submitBtn = document.querySelector('.btn-submit, [type="submit"].btn-primary-neu, #achievementForm button[type="submit"]');
        if (submitBtn) {
          console.debug('[SAAMS] Uploading certificate (auto-click submit)...');
          submitBtn.click();
        } else {
          console.debug('[SAAMS] Upload/submit button not found.');
        }
      }, 120);
    });
    if (zone) {
      zone.addEventListener('click', (e) => {
        if (e.target === input) return;
        input.click();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', bind);
  window.SAAMSUpload = { getFileInput: getInput, openPicker: () => { const i = getInput(); if (i) { i.click(); return true; } return false; }, showOcrPanel };
})();
