/**
 * SAAMS VoiceMemory — state, no-repetition, dual-mode (guided / silent).
 * Fixes applied:
 *   - promptOnce: force param bypasses spokenTexts guard (needed for toggle-ON re-prompt)
 *   - resetFlowPrompts(): clears prompt-done keys so steps re-fire after toggle
 *   - speakOnce: allowRepeat correctly bypasses spokenTexts AND lastSpoken guard
 *   - Multi-user: state fully isolated to session storage per page load
 */
(function () {
  const STORE = 'saams_voice_memory_v1';

  function load() {
    try {
      const raw = sessionStorage.getItem(STORE);
      if (!raw) return null;
      const d = JSON.parse(raw);
      d.completedSteps = new Set(d.completedSteps || []);
      d.spokenTexts    = new Set(d.spokenTexts || []);
      return d;
    } catch (_) {
      return null;
    }
  }

  function save() {
    sessionStorage.setItem(
      STORE,
      JSON.stringify({
        ...window.VoiceMemory,
        completedSteps: [...window.VoiceMemory.completedSteps],
        spokenTexts:    [...window.VoiceMemory.spokenTexts],
      })
    );
  }

  const persisted = load();
  const guideOff  = localStorage.getItem('saams_guide_mode') === 'silent';

  window.VoiceMemory = {
    lastSpoken:    persisted?.lastSpoken   ?? null,
    completedSteps: persisted?.completedSteps ?? new Set(),
    spokenTexts:    persisted?.spokenTexts    ?? new Set(),
    currentStep:   persisted?.currentStep  ?? null,
    currentFlow:   persisted?.currentFlow  ?? null,
    currentPage:   persisted?.currentPage  ?? null,
    pageResumed:   persisted?.pageResumed  ?? false,
    welcomeDone:   persisted?.welcomeDone  ?? sessionStorage.getItem('saams_welcome_done') === '1',
    guideMode:     guideOff ? false : persisted?.guideMode !== false,
    voiceEnabled:  localStorage.getItem('saams_voice') !== 'off',
    otpSent:       persisted?.otpSent   ?? false,
    verified:      persisted?.verified  ?? false,
    // Stores the last verified email for role-based redirect
    lastVerifiedEmail: persisted?.lastVerifiedEmail ?? null,
  };

  // ── Step tracking ─────────────────────────────────────────────────────
  function markDone(step) {
    window.VoiceMemory.completedSteps.add(step);
    save();
  }

  function isDone(step) {
    return window.VoiceMemory.completedSteps.has(step);
  }

  function wasSpoken(text) {
    return window.VoiceMemory.spokenTexts.has(text);
  }

  function setStep(step, flow) {
    window.VoiceMemory.currentStep = step;
    if (flow !== undefined) window.VoiceMemory.currentFlow = flow;
    save();
  }

  function routeGuard(pageKey) {
    if (window.VoiceMemory.currentPage === pageKey && window.VoiceMemory.pageResumed) {
      return false;
    }
    window.VoiceMemory.currentPage   = pageKey;
    window.VoiceMemory.pageResumed   = true;
    save();
    return true;
  }

  function resetPageResume() {
    window.VoiceMemory.pageResumed = false;
    save();
  }

  // ── Field filled check ────────────────────────────────────────────────
  function fieldFilled(name) {
    const el = document.querySelector(
      `[data-voice-field="${name}"], [name="${name}"], #${name}`
    );
    if (!el) return false;
    return (el.value || '').trim().length > 0;
  }

  // ── Speak once ────────────────────────────────────────────────────────
  /**
   * Speaks text only if it hasn't been spoken before in this session.
   * opts.force    → speak even if already spoken / guide mode off
   * opts.allowRepeat → bypass lastSpoken AND spokenTexts guards
   * opts.resultOnly  → allowed outside guide mode (for action results)
   */
  function speakOnce(text, opts = {}) {
    const V = window.VoiceMemory;
    if (!text) return false;
    if (!opts.force && !V.voiceEnabled) return false;
    if (!V.guideMode && !opts.resultOnly && !opts.force) return false;

    // Repetition guard — bypass when allowRepeat or force is set
    if (!opts.force && !opts.allowRepeat) {
      if (V.lastSpoken === text || V.spokenTexts.has(text)) return false;
    }

    V.lastSpoken = text;
    V.spokenTexts.add(text);
    save();

    if (window.SAAMSVoice?.speak) {
      window.SAAMSVoice.speak(text, true, !!opts.force, opts.onDone);
    } else if (opts.onDone) {
      opts.onDone();
    }
    return true;
  }

  // ── Prompt once ───────────────────────────────────────────────────────
  /**
   * Speaks a step prompt and starts listening.
   * opts.force → bypass all repetition guards (used when toggle is turned back ON)
   * opts.listen → start listening after speaking
   */
  function promptOnce(stepKey, text, opts = {}) {
    const V = window.VoiceMemory;
    const promptKey = `${stepKey}:prompt`;

    if (!opts.force) {
      if (isDone(promptKey)) return false;
      if (!V.voiceEnabled || !V.guideMode) return false;
      if (V.spokenTexts.has(text)) return false;
    }

    markDone(promptKey);
    showGuide(text);
    V.lastSpoken = text;
    V.spokenTexts.add(text);
    save();

    if (window.SAAMSVoice?.speak) {
      window.SAAMSVoice.speak(text, true, !!opts.force, () => {
        if (opts.listen !== false && !window.SAAMSVoice?.isMicBlocked?.()) {
          window.SAAMSVoice.startListening();
        }
      });
    }
    return true;
  }

  // ── Result once ───────────────────────────────────────────────────────
  function resultOnce(stepKey, text) {
    const resultKey = `${stepKey}:result`;
    if (isDone(resultKey)) return false;
    markDone(resultKey);
    showGuide(text);
    return speakOnce(text, { resultOnly: true, force: !window.VoiceMemory.guideMode });
  }

  // ── Guide tooltip ─────────────────────────────────────────────────────
  function showGuide(text) {
    const g = document.getElementById('voiceGuideStep');
    if (g) {
      g.textContent = text || '';
      g.hidden = !text;
    }
  }

  // ── Flow key management ───────────────────────────────────────────────
  function clearFlowKeys(prefix) {
    const V = window.VoiceMemory;
    for (const key of [...V.completedSteps]) {
      if (key.startsWith(prefix)) V.completedSteps.delete(key);
    }
    for (const text of [...V.spokenTexts]) {
      if (prefix === 'login_' && /email|otp|verification/i.test(text))
        V.spokenTexts.delete(text);
      if (prefix === 'register_' && /name|email|phone|department|year|role|password|registration|verification/i.test(text))
        V.spokenTexts.delete(text);
    }
    save();
  }

  /**
   * Resets ONLY the prompt-done markers for a flow, so prompts re-fire
   * after toggle-ON without re-running completed field-fill steps.
   * prefix: 'login_' | 'register_'
   */
  function resetFlowPrompts(prefix) {
    const V = window.VoiceMemory;
    for (const key of [...V.completedSteps]) {
      // Remove only ":prompt" markers so prompts speak again
      if (key.startsWith(prefix) && key.endsWith(':prompt')) {
        V.completedSteps.delete(key);
      }
    }
    // Also clear the spoken-text guard so the same text can be spoken again
    for (const text of [...V.spokenTexts]) {
      if (prefix === 'login_' && /enter your email|sent to your email|enter the otp/i.test(text))
        V.spokenTexts.delete(text);
      if (prefix === 'register_' && /tell your|please tell/i.test(text))
        V.spokenTexts.delete(text);
    }
    save();
  }

  // ── Guide mode ────────────────────────────────────────────────────────
  function disableGuide() {
    window.speechSynthesis?.cancel();
    window.VoiceMemory.guideMode = false;
    localStorage.setItem('saams_guide_mode', 'silent');
    save();
    speakOnce('Guide mode disabled. Operating silently.', { force: true, allowRepeat: true });
    markDone('guide_disabled_msg');
  }

  function enableGuide() {
    window.VoiceMemory.guideMode = true;
    localStorage.setItem('saams_guide_mode', 'guided');
    save();
    window.VoiceMemory.spokenTexts.delete('Guide mode enabled.');
    speakOnce('Guide mode enabled.', { force: true, allowRepeat: true });
    markDone('guide_enabled_msg');
  }

  // ── Welcome once ──────────────────────────────────────────────────────
  function welcomeOnce() {
    if (window.VoiceMemory.welcomeDone) return false;
    window.VoiceMemory.welcomeDone = true;
    sessionStorage.setItem('saams_welcome_done', '1');
    markDone('welcome');
    markDone('welcome:prompt');
    setStep('welcome', null);
    const text = 'Welcome to SAMS. Would you like to login or register?';
    showGuide(text);
    if (window.VoiceMemory.guideMode) speakOnce(text, { force: true });
    save();
    return true;
  }

  // ── Public API ────────────────────────────────────────────────────────
  window.VoiceMemoryAPI = {
    markDone,
    isDone,
    wasSpoken,
    setStep,
    routeGuard,
    resetPageResume,
    clearFlowKeys,
    resetFlowPrompts,   // NEW — for toggle-ON re-prompt
    fieldFilled,
    speakOnce,
    promptOnce,
    resultOnce,
    showGuide,
    disableGuide,
    enableGuide,
    welcomeOnce,
    save,
  };
})();
