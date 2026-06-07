/**
 * SAAMS Voice App — starts strict sequential voice workflow.
 */
window.SAAMS = window.SAAMS || {};
window.SAAMS.Voice = (function () {
  function wireLandingButtons() {
    document.querySelector('[data-voice-target="login"]')?.addEventListener('click', () => {
      sessionStorage.setItem('saams_voice_seq', 'login_email');
    });
    document.querySelector('[data-voice-target="register"]')?.addEventListener('click', () => {
      sessionStorage.setItem('saams_voice_seq', 'register');
    });
  }

  function wireMic() {
    document.getElementById('voiceMicBtn')?.addEventListener('click', () => {
      if (!ToggleController.isMasterOn()) return;
      ToggleController.setPageGuideOn(true);
      const p = document.getElementById('voicePanel');
      if (p) p.hidden = false;
      VoiceSequencer.commandMode();
    });
    document.getElementById('voicePanelClose')?.addEventListener('click', () => {
      ToggleController.setPageGuideOn(false);
      VoiceEngine.stopListen();
    });
  }

  function init() {
    ToggleController.init();
    wireMic();
    wireLandingButtons();
    ToggleController.updateMasterUi(ToggleController.isMasterOn());

    if (!ToggleController.isMasterOn()) return;

    const arm = (event) => {
      if (event?.target?.closest?.('#voiceAssistant, #voiceMasterBar')) return;
      VoiceSequencer.commandMode();
    };
    if (VoiceSequencer.isLanding()) {
      document.addEventListener('click', arm, { once: true, capture: true });
      document.addEventListener('touchstart', arm, { once: true, capture: true });
    } else {
      setTimeout(arm, 150);
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    start: () => VoiceSequencer.commandMode(),
  };
})();
