/**
 * VoiceEngine — strict speak-then-listen (no overlap).
 */
window.VoiceEngine = (function () {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;

  let recognition = null;
  let isSpeaking = false;
  let isListening = false;
  let preferredVoice = null;

  function stopListen() {
    isListening = false;
    if (recognition) {
      try {
        recognition.abort();
      } catch (_) {
        try {
          recognition.stop();
        } catch (__) {}
      }
    }
    recognition = null;
    console.log('Recognition stopped');
  }

  function isEnabled() {
    try {
      if (window.SAAMS && window.SAAMS.voiceEnabled === false) return false;
      if (window.ToggleController && typeof ToggleController.isMasterOn === 'function') {
        return !!ToggleController.isMasterOn();
      }
    } catch (_) {}
    return true;
  }

  function speak(text) {
    if (!isEnabled()) return Promise.resolve();
    stopListen();
    if (!text) return Promise.resolve();
    isSpeaking = true;
    synth.cancel();
    return new Promise((resolve) => {
      if (!isEnabled()) {
        isSpeaking = false;
        return resolve();
      }
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      u.pitch = 1;
      u.voice = preferredVoice || pickVoice();
      let resolved = false;
      const done = () => {
        if (resolved) return;
        resolved = true;
        isSpeaking = false;
        console.log('Recognition ended (speech)');
        resolve();
      };
      u.onend = done;
      u.onerror = done;
      synth.speak(u);
      setTimeout(done, Math.max(1800, text.length * 95));
      const hint = document.getElementById('voiceGuideStep');
      if (hint) hint.textContent = text;
    });
  }

  function pickVoice() {
    const voices = synth?.getVoices?.() || [];
    preferredVoice =
      voices.find((v) => /en[-_]in/i.test(v.lang) && /female|zira|susan|samantha/i.test(v.name)) ||
      voices.find((v) => /en[-_]in/i.test(v.lang)) ||
      voices.find((v) => /^en/i.test(v.lang)) ||
      null;
    return preferredVoice;
  }

  function setVoice(mode) {
    const voices = synth?.getVoices?.() || [];
    const wantFemale = /female|woman|girl/i.test(mode || '');
    const wantMale = /male|man|boy/i.test(mode || '');
    preferredVoice =
      voices.find((v) => wantFemale && /^en/i.test(v.lang) && /female|zira|susan|samantha|google uk english female/i.test(v.name)) ||
      voices.find((v) => wantMale && /^en/i.test(v.lang) && /male|david|mark|daniel|google uk english male/i.test(v.name)) ||
      pickVoice();
    return preferredVoice;
  }

  /**
   * Listen for one response. Recognition OFF while speaking.
   * @param {{ allowInterim?: boolean, timeoutMs?: number, validate?: (text:string)=>boolean }} opts
   */
  function listenOnce(opts = {}) {
    if (!isEnabled()) return Promise.reject(new Error('voice-disabled'));
    if (isSpeaking) return Promise.reject(new Error('still speaking'));
    if (!SpeechRecognition) return Promise.reject(new Error('SpeechRecognition unavailable'));

    stopListen();

    return new Promise((resolve, reject) => {
      let settled = false;
      let starting = false;
      const deadline = Date.now() + (opts.timeoutMs || 18000);
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 5;
      recognition.lang = 'en-IN';

      const guide = document.getElementById('voiceGuideStep');

      const canKeepListening = () => !settled && isEnabled() && !isSpeaking && Date.now() < deadline;

      const startRecognition = (delay = 120) => {
        if (!recognition || settled || starting || !canKeepListening()) return;
        starting = true;
        setTimeout(() => {
          starting = false;
          if (!recognition || settled || !canKeepListening()) {
            if (!settled && Date.now() >= deadline) {
              settled = true;
              stopListen();
              reject(new Error('no-match'));
            }
            return;
          }
          try {
            recognition.start();
          } catch (err) {
            if (!/already started/i.test(String(err.message || err))) startRecognition(250);
          }
        }, delay);
      };

      const finish = (transcript) => {
        if (settled) return;
        settled = true;
        stopListen();
        resolve(transcript.trim());
      };

      recognition.onstart = () => {
        isListening = true;
        console.log('Recognition started');
        if (guide) guide.textContent = 'Listening...';
      };

      recognition.onend = () => {
        isListening = false;
        console.log('Recognition ended');
        if (canKeepListening()) {
          startRecognition(180);
        } else if (!settled) {
          settled = true;
          stopListen();
          reject(new Error('no-match'));
        }
      };

      recognition.onerror = (e) => {
        if (e.error === 'aborted' || settled) return;
        console.log('Recognition error:', e.error);
        if (e.error === 'no-speech') {
          if (guide) guide.textContent = 'Still listening... please speak now.';
          if (canKeepListening()) startRecognition(180);
          return;
        }
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          settled = true;
          reject(new Error(e.error));
        }
      };

      recognition.onresult = (e) => {
        if (!isEnabled()) return;
        const result = e.results[e.results.length - 1];
        const alternatives = [];
        for (let i = 0; i < result.length; i++) {
          const text = (result[i]?.transcript || '').trim();
          if (text) alternatives.push(text);
        }
        const transcript = alternatives[0] || '';
        const command = transcript.toLowerCase().trim();
        if (!command) return;
        const commands = alternatives.map((text) => text.toLowerCase().trim());
        const firstValid = opts.validate ? alternatives.find((text) => opts.validate(text.toLowerCase().trim())) : transcript;
        const stopNow = commands.some((text) =>
          /\b(stop guide|stop voice|turn off|voice off|disable voice|pause assistant|be quiet)\b/i.test(text)
        );
        if (stopNow) {
          try {
            window.ToggleController?.setPageGuideOn?.(false);
            window.VoiceEngine?.stopListen?.();
          } catch (_) {}
          finish('__voice_stop__');
          return;
        }

        if (!result.isFinal) {
          console.log('Interim transcript:', alternatives.join(' | '));
          if (guide) guide.textContent = `Listening: ${transcript}`;
          if (opts.allowInterim && firstValid) {
            finish(firstValid);
          }
          return;
        }

        console.log('Voice transcript:', alternatives.join(' | '));
        if (opts.validate && !firstValid) {
          if (guide) guide.textContent = 'I heard you, but that was not expected here. Please try again.';
          if (canKeepListening()) startRecognition(150);
          return;
        }
        finish(firstValid || transcript);
      };

      startRecognition(0);
    });
  }

  return {
    speak,
    listenOnce,
    stopListen,
    setVoice,
    get isSpeaking() {
      return isSpeaking;
    },
    get isListening() {
      return isListening;
    },
  };
})();
