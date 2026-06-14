/** Certificate upload + OCR preview */
(function () {
  function getInput() {
    return document.querySelector(
      '#certificateInput, input[name="certificate"], input[name="document"].certificate-upload, .certificate-upload'
    );
  }

  function bytesToLabel(bytes) {
    if (!Number.isFinite(bytes)) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function fileKind(file) {
    const name = (file.name || '').toLowerCase();
    if (file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(name)) return 'image';
    if (file.type === 'application/pdf' || /\.pdf$/i.test(name)) return 'pdf';
    return 'file';
  }

  function ensurePreviewShell(input) {
    const zone = input.closest('.upload-zone') || document.querySelector('.upload-zone');
    let selected = document.getElementById('selectedFile') || zone?.querySelector('[data-selected-file]');
    let preview = document.getElementById('certificatePreview') || zone?.querySelector('[data-certificate-preview]');

    if (zone && !selected) {
      selected = document.createElement('div');
      selected.id = 'selectedFile';
      selected.dataset.selectedFile = 'true';
      selected.className = 'selected-file-pill small mt-3';
      zone.appendChild(selected);
    }

    if (zone && !preview) {
      preview = document.createElement('div');
      preview.id = 'certificatePreview';
      preview.dataset.certificatePreview = 'true';
      preview.className = 'certificate-selected-preview mt-3';
      zone.appendChild(preview);
    }

    return { selected, preview };
  }

  function renderSelectedFile(input, file) {
    const { selected, preview: previewEl } = ensurePreviewShell(input);
    const size = bytesToLabel(file.size);
    const safeName = escapeHtml(file.name);
    if (selected) {
      selected.innerHTML = `
        <i class="bi bi-file-earmark-check"></i>
        <span>Selected: <strong>${safeName}</strong>${size ? ` <em>${size}</em>` : ''}</span>
        <button class="btn btn-neu btn-sm" type="button" data-clear-upload>Change</button>`;
    }

    if (!previewEl) return;

    const url = URL.createObjectURL(file);
    const kind = fileKind(file);
    previewEl.dataset.previewUrl = url;

    if (kind === 'image') {
      previewEl.innerHTML = `
        <img class="certificate-preview-media" src="${url}" alt="Selected certificate preview">
        <p class="small text-muted mt-2 mb-0">Preview ready. Click Submit only when you are done editing.</p>`;
    } else if (kind === 'pdf') {
      previewEl.innerHTML = `
        <iframe class="certificate-preview-frame" src="${url}" title="Selected certificate preview"></iframe>
        <p class="small text-muted mt-2 mb-0">Preview ready. Click Submit only when you are done editing.</p>`;
    } else {
      previewEl.innerHTML = `
        <div class="certificate-preview-fallback">
          <i class="bi bi-file-earmark-text"></i>
          <div>
            <strong>${safeName}</strong>
            <small class="text-muted d-block">Preview is not available for this file type. It will upload only after you submit.</small>
          </div>
        </div>`;
    }
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
      renderSelectedFile(input, f);
      document.dispatchEvent(new CustomEvent('saams:file-selected', { detail: { name: f.name } }));
      if (window.SAAMS.urls?.ocrPreview) preview(f);
    });
    if (zone) {
      zone.addEventListener('click', (e) => {
        if (e.target.closest('a, button, iframe')) return;
        if (e.target === input) return;
        input.click();
      });
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
      });
      zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        if (!e.dataTransfer?.files?.length) return;
        input.files = e.dataTransfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      zone.addEventListener('click', (e) => {
        const clear = e.target.closest('[data-clear-upload]');
        if (!clear) return;
        e.preventDefault();
        e.stopPropagation();
        input.value = '';
        window.SAAMS = window.SAAMS || {};
        window.SAAMS.pendingCertificate = null;
        const { selected, preview } = ensurePreviewShell(input);
        if (selected) selected.innerHTML = '';
        if (preview) preview.innerHTML = '';
      });
    }
  }

  document.addEventListener('DOMContentLoaded', bind);
  window.SAAMSUpload = { getFileInput: getInput, openPicker: () => { const i = getInput(); if (i) { i.click(); return true; } return false; }, showOcrPanel };
})();
