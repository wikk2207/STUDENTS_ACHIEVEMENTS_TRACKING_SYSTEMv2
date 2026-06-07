/** Page helpers for voice (sequencer owns the workflow). */
window.AuthFlow = {
  isLanding() {
    const p = window.location.pathname;
    return p === '/' || p === '';
  },
  isLoginPage() {
    return /\/auth\/login\/?$/i.test(window.location.pathname);
  },
  isRegisterPage() {
    return /\/auth\/register\/?$/i.test(window.location.pathname);
  },
  save(state) {
    sessionStorage.setItem('saams_voice_flow', JSON.stringify(state));
  },
};
