/**
 * SAAMS stateful voice flow — Listen → Intent → Act → State → Forward
 * Fixes applied:
 *   - register_name: uses raw (preserves casing), not t (lowercase)
 *   - login_email: validates email has @ and . before clicking Send OTP
 *   - login_otp: stores verified email; calls redirectAfterLogin (role-based)
 *   - beginLogin / beginRegister: call resetFlowPrompts for clean re-entry
 *   - startWelcome: re-fires welcome regardless of welcomeDone on toggle-ON
 *   - resumeOnPage: accepts force=true to re-prompt current step
 *   - Multi-user: resetSession called on beginLogin / beginRegister
 *   - All prompts use final transcript only (isFinal handled in voice.js)
 */
(function () {
  if (window.SAAMSFlowInitialized) return;
  window.SAAMSFlowInitialized = true;

  let handledThisPageLoad = false;

  const VM  = () => window.VoiceMemory;
  const API = () => window.VoiceMemoryAPI;
  const A   = () => window.SAAMSAgent;
  const urls = () => window.SAAMS?.urls || {};

  // ── Step prompts ──────────────────────────────────────────────────────
  const PROMPTS = {
    welcome:             'Welcome to SAMS. Would you like to login or register?',
    login_email:         'Please enter your email address.',
    login_otp_sent:      'OTP is sent to your email. Please check your email and tell me the OTP.',
    login_otp:           'Please tell me the OTP from your email.',
    login_verified:      'Verification successful.',
    register_name:       'Please tell your full name.',
    register_email:      'Please tell your email address.',
    register_mobile:     'Please tell your phone number.',
    register_department: 'Please tell your branch or department.',
    register_year:       'Please tell your year of study.',
    register_roll:       'Please tell your roll number.',
    register_role:       'Are you a student or mentor?',
    register_password:   'Please type your password on screen, then say done.',
    register_done:       'Registration complete.',
    register_verify:     'Please tell me the verification code from your email.',
  };

  // ── Helpers ───────────────────────────────────────────────────────────
  function persistFlow(step, flow) {
    API().setStep(step, flow);
    sessionStorage.setItem('saams_guide_active', '1');
    sessionStorage.setItem('saams_guide_step', step);
    if (flow) sessionStorage.setItem('saams_guide_flow', flow);
  }

  function isActive() {
    return !!sessionStorage.getItem('saams_guide_active');
  }

  function stop() {
    sessionStorage.removeItem('saams_guide_active');
    sessionStorage.removeItem('saams_guide_step');
    sessionStorage.removeItem('saams_guide_flow');
    VM().currentStep = null;
    VM().currentFlow = null;
    API().save();
    API().showGuide('');
  }

  async function actFill(name, value) {
    return A()?.runWithRetry(() => A().fillField(name, value), `[data-voice-field="${name}"]`);
  }

  async function actClick(kind) {
    return A()?.runWithRetry(() => A().clickSelectors(A().CLICK[kind]), A().CLICK[kind][0]);
  }

  function listenAfter(delay = 300) {
    if (!VM().voiceEnabled || window.SAAMSVoice?.isMicBlocked?.() || !VM().guideMode) return;
    setTimeout(() => window.SAAMSVoice?.startListening?.(), delay);
  }

  function advance(step, flow) {
    persistFlow(step, flow);
    API().markDone(step);
  }

  // ── Register step sequencer ───────────────────────────────────────────
  function nextRegisterStep() {
    const order = [
      ['register_name',       'full_name',  PROMPTS.register_name],
      ['register_email',      'email',      PROMPTS.register_email],
      ['register_mobile',     'mobile',     PROMPTS.register_mobile],
      ['register_department', 'department', PROMPTS.register_department],
      ['register_year',       'year',       PROMPTS.register_year],
      ['register_roll',       'roll_number', PROMPTS.register_roll],
      ['register_role',       'role',       PROMPTS.register_role],
      ['register_password',   'password',   PROMPTS.register_password],
    ];

    for (const [step, field] of order) {
      const alreadyDone =
        API().isDone(step) ||
        (field !== 'password' && field !== 'role' && API().fieldFilled(field));

      if (alreadyDone) {
        API().markDone(step);
        API().markDone(`${step}:prompt`);
        continue;
      }

      persistFlow(step, 'register');
      if (VM().guideMode) API().promptOnce(step, PROMPTS[step], { listen: true });
      else listenAfter();
      return step;
    }
    return 'register_password';
  }

  // ── Step handlers ─────────────────────────────────────────────────────
  const handlers = {

    // ── Welcome ─────────────────────────────────────────────────────────
    welcome(t) {
      if (/\blogin\b|log in|sign in/.test(t)) { beginLogin(); return true; }
      if (/\bregister\b|sign up|create account/.test(t)) { beginRegister(); return true; }
      if (VM().guideMode && !API().isDone('welcome:hint')) {
        API().markDone('welcome:hint');
        API().speakOnce('Say Login or Register.', { force: true });
      }
      return true;
    },

    // ── Login: email step ────────────────────────────────────────────────
    async login_email(t, raw) {
      // Allow "send OTP" as a shortcut if email already filled
      if (/^send otp|resend/.test(t) && !A()?.extractEmail(raw)) {
        if (!VM().otpSent) {
          await actClick('sendOtp');
          VM().otpSent = true;
          API().save();
          advance('login_otp', 'login');
          API().resultOnce('login_otp_sent', PROMPTS.login_otp_sent);
        }
        listenAfter();
        return true;
      }

      // Extract and normalize email from the FULL final transcript (raw preserves original)
      const email = A()?.extractEmail(raw) || A()?.normalizeEmail(raw);

      // Validate: must contain both @ and . to be a real email
      if (!email || !email.includes('@') || !email.includes('.')) {
        if (VM().guideMode) {
          // Re-ask once
          window.SAAMSVoice?.speak?.(
            'I could not understand the email. Please say it again.',
            true, false,
            () => window.SAAMSVoice?.startListening?.()
          );
        }
        return true;
      }

      // Store for role-based redirect after OTP
      VM().lastVerifiedEmail = email;
      API().save();

      await actFill('email', email);
      API().markDone('login_email');

      if (!VM().otpSent) {
        await actClick('sendOtp');
        VM().otpSent = true;
        API().save();
        advance('login_otp', 'login');
        API().resultOnce('login_otp_sent', PROMPTS.login_otp_sent);
      }

      if (VM().guideMode && !API().isDone('login_otp:prompt')) {
        API().promptOnce('login_otp', PROMPTS.login_otp, { listen: true });
      } else {
        listenAfter();
      }
      return true;
    },

    // ── Login: OTP step ──────────────────────────────────────────────────
    async login_otp(t, raw) {
      const code = A()?.extractOtp(raw);
      if (code && code.length >= 4) await actFill('code', code);

      if ((code && code.length >= 4) || /verify|submit|done/.test(t)) {
        if (!VM().verified) {
          await actClick('verifyOtp');
          VM().verified = true;
          API().save();
          API().resultOnce('login_verified', PROMPTS.login_verified);

          // Role-based redirect after successful OTP verification
          const verifiedEmail = VM().lastVerifiedEmail || '';
          setTimeout(() => A()?.redirectAfterLogin?.(verifiedEmail), 1200);
        }
        return true;
      }

      if (VM().guideMode) API().promptOnce('login_otp', PROMPTS.login_otp, { listen: true });
      return true;
    },

    // ── Register: name ───────────────────────────────────────────────────
    async register_name(t, raw) {
      // Use raw (original casing) not t (which is lowercase)
      // Remove common prefix phrases
      const name = A()?.normalizeName(
        raw.replace(/^(my name is|name is|i am|i'm)\s*/i, '').trim()
      ) || '';


      // Store confirmation state in VoiceMemory
      if (!VM().nameConfirmState) VM().nameConfirmState = {};
      const state = VM().nameConfirmState;

      // If awaiting confirmation
      if (state.awaiting && state.lastName) {
        if (/^(yes|correct|right|yeah|yep)$/i.test(t.trim())) {
          await actFill('full_name', state.lastName);
          API().markDone('register_name');
          VM().nameConfirmState = null;
          nextRegisterStep();
          return true;
        } else if (/^(no|wrong|incorrect|nope)$/i.test(t.trim())) {
          VM().nameConfirmState = null;
          if (VM().guideMode) {
            window.SAAMSVoice?.speak?.('Okay, please say your full name again.', true, false, () => window.SAAMSVoice?.startListening?.());
          }
          return true;
        }
        // If not yes/no, re-ask
        if (VM().guideMode) {
          window.SAAMSVoice?.speak?.(`You said: ${state.lastName}. Is this correct? Say yes or no.`, true, false, () => window.SAAMSVoice?.startListening?.());
        }
        return true;
      }


      // If name is too short, re-prompt
      if (name.length < 2) {
        if (VM().guideMode) API().promptOnce('register_name', PROMPTS.register_name, { listen: true });
        return true;
      }

      // Always speak back the name for confirmation
      if (VM().guideMode) {
        VM().nameConfirmState = { awaiting: true, lastName: name };
        window.SAAMSVoice?.speak?.(`You said: ${name}. Is this correct? Say yes or no.`, true, false, () => window.SAAMSVoice?.startListening?.());
        return true;
      }

      // If not in guide mode, just fill
      await actFill('full_name', name);
      API().markDone('register_name');
      nextRegisterStep();
      return true;
    },

    // ── Register: email ──────────────────────────────────────────────────
    async register_email(t, raw) {
      // Email confirmation state
      if (!VM().emailConfirmState) VM().emailConfirmState = {};
      const emailState = VM().emailConfirmState;
      const email = A()?.extractEmail(raw) || A()?.normalizeEmail(raw);

      // If awaiting confirmation
      if (emailState.awaiting && emailState.lastEmail) {
        if (/^(yes|correct|right|yeah|yep)$/i.test(t.trim())) {
          await actFill('email', emailState.lastEmail);
          API().markDone('register_email');
          VM().emailConfirmState = null;
          nextRegisterStep();
          return true;
        } else if (/^(no|wrong|incorrect|nope)$/i.test(t.trim())) {
          VM().emailConfirmState = null;
          if (VM().guideMode) {
            window.SAAMSVoice?.speak?.('Okay, please say your email again.', true, false, () => window.SAAMSVoice?.startListening?.());
          }
          return true;
        }
        // If not yes/no, re-ask
        if (VM().guideMode) {
          window.SAAMSVoice?.speak?.(`You said: ${emailState.lastEmail}. Is this correct? Say yes or no.`, true, false, () => window.SAAMSVoice?.startListening?.());
        }
        return true;
      }

      if (!email || !email.includes('@') || !email.includes('.')) {
        if (VM().guideMode) {
          window.SAAMSVoice?.speak?.(
            'I could not understand the email. Please say it again.',
            true, false,
            () => window.SAAMSVoice?.startListening?.()
          );
        }
        return true;
      }

      // Always speak back the email for confirmation
      if (VM().guideMode) {
        VM().emailConfirmState = { awaiting: true, lastEmail: email };
        window.SAAMSVoice?.speak?.(`You said: ${email}. Is this correct? Say yes or no.`, true, false, () => window.SAAMSVoice?.startListening?.());
        return true;
      }

      await actFill('email', email);
      API().markDone('register_email');
      nextRegisterStep();
      return true;
    },

    // ── Register: mobile ─────────────────────────────────────────────────
    async register_mobile(t, raw) {
      const mobile = A()?.normalizeMobile(raw);
      if (!mobile || mobile.length < 10) {
        if (VM().guideMode) API().promptOnce('register_mobile', PROMPTS.register_mobile, { listen: true });
        return true;
      }
      await actFill('mobile', mobile);
      API().markDone('register_mobile');
      nextRegisterStep();
      return true;
    },

    // ── Register: department ─────────────────────────────────────────────
    async register_department(t, raw) {
      // Preserve original casing for department name
      const dept = raw.replace(/^(department is|branch is|in)\s*/i, '').trim();
      if (!dept) {
        if (VM().guideMode) API().promptOnce('register_department', PROMPTS.register_department, { listen: true });
        return true;
      }
      await actFill('department', dept);
      API().markDone('register_department');
      nextRegisterStep();
      return true;
    },

    // ── Register: year ───────────────────────────────────────────────────
    async register_year(t, raw) {
      const y = A()?.parseYear(raw) || raw.replace(/\D/g, '').slice(0, 1) || '';
      if (y) await actFill('year', y);
      API().markDone('register_year');
      nextRegisterStep();
      return true;
    },

    // ── Register: roll number ────────────────────────────────────────────
    async register_roll(t, raw) {
      const roll = raw.replace(/^(roll number is|roll is|roll|my roll is)\s*/i, '').trim();
      if (roll.length < 1) {
        API().promptOnce('register_roll', PROMPTS.register_roll, { listen: true });
        return true;
      }
      await actFill('roll_number', roll);
      API().markDone('register_roll');
      nextRegisterStep();
      return true;
    },

    // ── Register: role ───────────────────────────────────────────────────
    async register_role(t) {
      const role = /mentor|teacher|faculty/.test(t) ? 'mentor' : 'student';
      await actFill('role', role);
      document.getElementById('roleSelect')?.dispatchEvent(new Event('change', { bubbles: true }));
      API().markDone('register_role');
      nextRegisterStep();
      return true;
    },

    // ── Register: password (manual entry, then "done") ───────────────────
    async register_password(t) {
      if (/done|submit|register|continue|ready/.test(t)) {
        if (!API().isDone('register_submit')) {
          await actClick('register');
          API().markDone('register_submit');
          API().resultOnce('register_done', PROMPTS.register_done);
          advance('register_verify', 'register');
        }
        return true;
      }
      if (VM().guideMode) API().promptOnce('register_password', PROMPTS.register_password, { listen: true });
      return true;
    },

    // ── Register: email verify OTP ───────────────────────────────────────
    async register_verify(t, raw) {
      const code = A()?.extractOtp(raw);
      if (code && code.length >= 4) await actFill('code', code);
      if ((code && code.length >= 4) || /verify|submit|done/.test(t)) {
        if (!API().isDone('register_verified')) {
          await actClick('verifyOtp');
          API().markDone('register_verified');
          API().resultOnce('register_verified', 'Email verified. Registration complete.');
        }
        return true;
      }
      if (VM().guideMode) API().promptOnce('register_verify', PROMPTS.register_verify, { listen: true });
      return true;
    },
  };

  // ── Main input handler ────────────────────────────────────────────────
  async function handleInput(raw) {
    const t    = raw.toLowerCase().trim();
    const path = window.location.pathname;

    if (/turn off guide|stop voice guide|disable assistant|turn off command/.test(t)) {
      API().disableGuide();
      return true;
    }
    if (/turn on guide|enable assistant|enable guide/.test(t)) {
      API().enableGuide();
      listenAfter();
      return true;
    }

    if (/\blogin\b|log in|sign in/.test(t))           { beginLogin();    return true; }
    if (/\bregister\b|sign up|create account/.test(t)) { beginRegister(); return true; }

    // Auto-detect context from URL even if guide wasn't explicitly started
    if (/\/auth\/login\/?$/i.test(path) && !/mentor/.test(path)) {
      if (A()?.extractEmail(raw)) {
        await handlers.login_email(t, raw);
        return true;
      }
    }
    if (/\/verify/i.test(path) && A()?.extractOtp(raw)) {
      const flow = sessionStorage.getItem('saams_guide_flow');
      if (flow === 'login') await handlers.login_otp(t, raw);
      else await handlers.register_verify(t, raw);
      return true;
    }
    if (/\/auth\/register/i.test(path) && !isActive()) {
      persistFlow('register_name', 'register');
    }

    if (!isActive()) return false;

    const step = VM().currentStep || sessionStorage.getItem('saams_guide_step');
    const fn   = handlers[step];
    if (!fn) return false;
    await fn(t, raw);
    return true;
  }

  // ── Page resume ───────────────────────────────────────────────────────
  /**
   * Resume the voice flow for the current page.
   * force=true → re-prompt even if already spoken (used on toggle-ON).
   */
  function resumeOnPage(force = false) {
    if (!force && handledThisPageLoad) return;
    handledThisPageLoad = true;

    const path = window.location.pathname;
    const flow = sessionStorage.getItem('saams_guide_flow') || VM().currentFlow;
    const step = sessionStorage.getItem('saams_guide_step') || VM().currentStep;
    if (!step || !sessionStorage.getItem('saams_guide_active')) return;

    VM().currentFlow = flow;
    VM().currentStep = step;

    const voicePanel = document.getElementById('voicePanel');
    if (voicePanel) voicePanel.hidden = false;

    const onVerify   = /\/verify/i.test(path);
    const onLogin    = /\/auth\/login\/?$/i.test(path);
    const onRegister = /\/auth\/register\/?$/i.test(path);

    // When force=true, clear prompt-done markers so they speak again
    if (force && flow === 'login')    API().resetFlowPrompts?.('login_');
    if (force && flow === 'register') API().resetFlowPrompts?.('register_');

    setTimeout(() => {
      if (onVerify && flow === 'login') {
        persistFlow('login_otp', 'login');
        API().promptOnce('login_otp', PROMPTS.login_otp, { listen: true, force });
      } else if (onVerify && flow === 'register') {
        persistFlow('register_verify', 'register');
        API().promptOnce('register_verify', PROMPTS.register_verify, { listen: true, force });
      } else if (onLogin) {
        persistFlow('login_email', 'login');
        API().promptOnce('login_email', PROMPTS.login_email, { listen: true, force });
      } else if (onRegister) {
        persistFlow(step || 'register_name', 'register');
        nextRegisterStep();
      }
    }, 400);
  }

  // ── Welcome screen ────────────────────────────────────────────────────
  function startWelcome(force = false) {
    if (localStorage.getItem('saams_voice') === 'off') return;

    // Skip only if NOT being forced (toggle-ON always re-fires)
    if (!force && VM().welcomeDone) return;

    sessionStorage.setItem('saams_guide_active', '1');
    persistFlow('welcome', null);

    const voicePanel = document.getElementById('voicePanel');
    if (voicePanel) voicePanel.hidden = false;

    const text = PROMPTS.welcome;
    API().showGuide(text);

    // Speak once and then start listening
    window.SAAMSVoice?.speak?.(text, true, true, () => {
      if (!window.SAAMSVoice?.isMicBlocked?.()) {
        window.SAAMSVoice?.startListening?.();
      }
    });

    // Mark done to prevent double-fire on the same page
    VM().welcomeDone = true;
    sessionStorage.setItem('saams_welcome_done', '1');
    API().markDone('welcome');
    API().markDone('welcome:prompt');
    API().save();
  }

  // ── Begin login ───────────────────────────────────────────────────────
  function beginLogin() {
    // Multi-user safety: reset session state for new login
    A()?.resetSession?.();

    VM().otpSent  = false;
    VM().verified = false;
    VM().lastVerifiedEmail = null;
    API().clearFlowKeys('login_');
    API().resetFlowPrompts?.('login_');
    persistFlow('login_email', 'login');
    handledThisPageLoad = false;

    const voicePanel = document.getElementById('voicePanel');
    if (voicePanel) voicePanel.hidden = false;

    const dest = urls().login || '/auth/login';
    API().showGuide('Going to login…');
    window.SAAMSVoice?.speak?.('Going to login.', true, true);
    window.location.href = dest;
  }

  // ── Begin register ────────────────────────────────────────────────────
  function beginRegister() {
    // Multi-user safety: reset session state for new registration
    A()?.resetSession?.();

    API().clearFlowKeys('register_');
    API().resetFlowPrompts?.('register_');
    persistFlow('register_name', 'register');
    handledThisPageLoad = false;

    const voicePanel = document.getElementById('voicePanel');
    if (voicePanel) voicePanel.hidden = false;

    const dest = urls().register || '/auth/register';
    API().showGuide('Going to register…');
    window.SAAMSVoice?.speak?.('Going to register.', true, true);
    window.location.href = dest;
  }

  // ── Init on page load ─────────────────────────────────────────────────
  function initFlow() {
    handledThisPageLoad = false;
    const path   = window.location.pathname;
    const isHome = path === '/' || path === '';

    if (sessionStorage.getItem('saams_guide_active') === '1') {
      resumeOnPage(false);
      return;
    }

    if (isHome && localStorage.getItem('saams_voice') !== 'off') {
      setTimeout(() => startWelcome(false), 600);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────
  window.SAAMSGuide = {
    handleInput,
    startWelcome,
    beginRegister,
    beginLogin,
    stop,
    isActive: () => isActive(),
    resumeOnPage,    // accepts force=true for toggle-ON
    fillField: (n, v) => A()?.fillField(n, v),
    smoothNav: (url) => { window.location.href = url; },
    setStep:   (s) => persistFlow(s, VM().currentFlow),
  };

  // Disabled auto-initialization. Only master controller should start flows.
})();
