/**
 * UploadFlow — voice certificate upload on achievement/activity forms.
 */
window.UploadFlow = (function () {
  let voicePick = false;

  function canGuide() {
    return ToggleController.isMasterOn() && ToggleController.isPageGuideOn();
  }

  function hasUploadField() {
    return !!window.SAAMSUpload?.getFileInput?.();
  }

  document.addEventListener('saams:file-selected', (e) => {
    if (!voicePick || !canGuide()) return;
    voicePick = false;
    VoiceEngine.speak('Certificate uploaded successfully.');
  });

  async function handle(text) {
    if (!/upload.*certificate|upload certificate/i.test(text)) return false;

    if (!hasUploadField()) {
      const url = window.SAAMS?.urls?.achievementAdd;
      if (url) {
        VoiceEngine.speak('Opening the achievement form.');
        window.location.href = url;
        sessionStorage.setItem('saams_voice_pending_upload', '1');
      }
      return true;
    }

    if (!canGuide()) return true;

    voicePick = true;
    VoiceEngine.speak('Please select your certificate file.').then(() => {
      window.SAAMSUpload?.openPicker?.();
    });
    return true;
  }

  function resumePendingUpload() {
    if (sessionStorage.getItem('saams_voice_pending_upload') !== '1') return;
    sessionStorage.removeItem('saams_voice_pending_upload');
    if (!hasUploadField() || !canGuide()) return;
    VoiceEngine.speak('Please select your certificate file.').then(() => {
      window.SAAMSUpload?.openPicker?.();
    });
  }

  return { handle, resumePendingUpload };
})();
