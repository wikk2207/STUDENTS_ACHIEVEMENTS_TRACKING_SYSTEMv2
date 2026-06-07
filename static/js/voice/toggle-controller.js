/**
 * ToggleController — master ON/OFF + per-page voice guide toggle.
 */
window.ToggleController = (function () {
  const KEY_MASTER = 'saams_voice_master';
  const KEY_PAGE = 'saams_voice_page_guide';

  function isMasterOn() {
    const v = localStorage.getItem(KEY_MASTER);
    if (v === null || v === undefined) return true;
    return v !== 'off';
  }

  function isPageGuideOn() {
    const v = sessionStorage.getItem(KEY_PAGE);
    if (v === null || v === undefined) return true;
    return v !== 'off';
  }

  function setMasterOn(on) {
    localStorage.setItem(KEY_MASTER, on ? 'on' : 'off');
    updateMasterUi(on);
    window.SAAMS = window.SAAMS || {};
    window.SAAMS.voiceEnabled = !!on;
  }

  function setPageGuideOn(on) {
    sessionStorage.setItem(KEY_PAGE, on ? 'on' : 'off');
    updatePageUi(on);
  }

  function updateMasterUi(on) {
    const el = document.getElementById('voiceMasterToggle');
    const assistant = document.getElementById('voiceAssistant');
    if (!el) return;
    el.classList.toggle('voice-toggle-on', on);
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
    const label = el.querySelector('.voice-toggle-label');
    if (label) label.textContent = on ? 'Voice ON' : 'Voice OFF';
    if (assistant) assistant.classList.toggle('voice-disabled', !on);
  }

  function updatePageUi(on) {
    const el = document.getElementById('voicePageToggle');
    if (!el) return;
    el.checked = on;
    const lab = document.getElementById('voicePageToggleLabel');
    if (lab) lab.textContent = on ? 'Voice guide on' : 'Voice guide off';
  }

  function resetSession() {
    sessionStorage.removeItem('saams_voice_flow');
    sessionStorage.removeItem('saams_welcome_done');
    sessionStorage.removeItem('saams_voice_pending_upload');
  }

  function init() {
    const master = isMasterOn();
    updateMasterUi(master);
    window.SAAMS = window.SAAMS || {};
    window.SAAMS.voiceEnabled = !!master;

    const pageToggle = document.getElementById('voicePageToggle');
    if (pageToggle) {
      pageToggle.checked = isPageGuideOn();
      pageToggle.addEventListener('change', () => {
        setPageGuideOn(pageToggle.checked);
        if (!pageToggle.checked) VoiceEngine.stopListen();
      });
    }

    document.getElementById('voiceMasterToggle')?.addEventListener('click', () => {
      const next = !isMasterOn();
      if (next) {
        setMasterOn(true);
        resetSession();
        window.SAAMS?.Voice?.start?.();
      } else {
        setMasterOn(false);
        window.speechSynthesis?.cancel?.();
        VoiceEngine.stopListen();
        ToggleController.resetSession();
        console.log('Voice assistant stopped completely');
      }
    });
  }

  return {
    init,
    isMasterOn,
    isPageGuideOn,
    setMasterOn,
    setPageGuideOn,
    resetSession,
    updateMasterUi,
    updatePageUi,
  };
})();
