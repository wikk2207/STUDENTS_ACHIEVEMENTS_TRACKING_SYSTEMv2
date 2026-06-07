/**
 * SAAMS Global Voice Assistant — Web Speech API
 * Fixed: continuous=false, isFinal-only for fields, confidence filter,
 *        self-hearing prevention, clean toggleVoice API, no loops.
 */
(function () {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;

  // SINGLE global recognition instance and running lock
  let recognition = null;
  let recognitionRunning = false;
  let helpCache = null;
  let lastSpoken = '';
  let micBlocked = false;
  let lastLoggedStatus = '';

  // ── Ref-style flags (plain vars in vanilla JS) ───────────────────────
  let isSpeaking = false;
  let shouldListen = false;
  let commandHandled = false;
  // currentStep is managed by voice-guide.js / VoiceMemory

  // ── DOM helpers ───────────────────────────────────────────────────────
  const micBtn      = () => document.getElementById('voiceMicBtn');
  const micHelp     = () => document.getElementById('voiceMicHelp');
  const enableMicBtn = () => document.getElementById('voiceEnableMicBtn');
  const panel       = () => document.getElementById('voicePanel');
  const statusEl    = () => document.getElementById('voiceStatus');
  const transcriptEl = () => document.getElementById('voiceTranscript');

  // ── Status / transcript log ───────────────────────────────────────────
  function setStatus(msg, logTranscript = true) {
    if (statusEl()) statusEl().textContent = msg;
    if (!logTranscript) return;
    if (msg === lastLoggedStatus) return;
    lastLoggedStatus = msg;
    if (transcriptEl()) {
      const p = document.createElement('p');
      p.textContent = `> ${msg}`;
      transcriptEl().prepend(p);
      while (transcriptEl().children.length > 8) transcriptEl().lastChild.remove();
    }
  }

  // ── Mic UI ────────────────────────────────────────────────────────────
  function showMicHelp(show) {
    const help = micHelp();
    if (help) help.hidden = !show;
    const icon = document.getElementById('voiceMicIcon');
    if (icon) icon.className = show ? 'bi bi-mic-mute-fill' : 'bi bi-mic-fill';
  }

  function setMicBlocked(blocked) {
    micBlocked = blocked;
    if (blocked) {
      showMicHelp(true);
    } else {
      sessionStorage.removeItem('saams_mic_blocked');
      showMicHelp(false);
    }
  }

  function syncMicButtonUI() {
    const on = shouldListen || isSpeaking;
    const btn = micBtn();
    if (btn) btn.classList.toggle('listening', on);
    const pulse = document.getElementById('voicePulse');
    if (pulse) pulse.hidden = !on;
    if (panel() && on) panel().hidden = false;
  }

  function showPanel() {
    if (panel()) panel().hidden = false;
  }

  // ── Safe speak — stops mic first, only restarts mic in onend ─────────
  function speak(text, interrupt = true, force = false, onDone) {
    if (!text || (!force && !voiceEnabled)) {
      if (onDone) onDone();
      return;
    }

    // Stop recognition before speaking so we never hear our own voice
    if (recognition) {
      try { recognition.stop(); } catch (_) {}
    }
    shouldListen = false;

    if (interrupt) synth.cancel();

    isSpeaking = true;
    syncMicButtonUI();

    lastSpoken = text;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 1;
    u.pitch = 1;

    u.onend = () => {
      isSpeaking = false;
      syncMicButtonUI();
      if (typeof onDone === 'function') onDone();
    };
    u.onerror = () => {
      isSpeaking = false;
      syncMicButtonUI();
      if (typeof onDone === 'function') onDone();
    };

    if (voiceEnabled || force) {
      synth.speak(u);
    } else {
      isSpeaking = false;
      if (onDone) onDone();
    }

    if (statusEl() && text.length < 80) setStatus(text, false);
  }

  // speak + automatically start listening when done
  function speakAndListen(text, interrupt = true) {
    speak(text, interrupt, false, () => {
      if (voiceEnabled && !micBlocked) {
        setTimeout(() => startListening(), 150);
      }
    });
  }

  // ── Start listening ───────────────────────────────────────────────────
  function startListening() {
    if (!voiceEnabled) return;
    if (isSpeaking) return;
    if (micBlocked) return;
    if (!SpeechRecognition) {
      setStatus('Use Chrome or Edge for voice.', false);
      return;
    }
    if (!recognition) initRecognition();
    if (!recognition) return;

    shouldListen = true;
    commandHandled = false;
    showPanel();

    // Stop any active session first, then start fresh after a brief gap
    try { recognition.stop(); } catch (_) {}

    setTimeout(() => {
      if (!voiceEnabled || isSpeaking) return;
      try {
        recognition.start();
        syncMicButtonUI();
        setStatus('Listening…', false);
      } catch (err) {
        if (String(err).includes('already started')) {
          syncMicButtonUI();
          return;
        }
        // retry once
        setTimeout(() => {
          try { recognition.start(); syncMicButtonUI(); } catch (_) {}
        }, 300);
      }
    }, 120);
  }

  function stopListening() {
    shouldListen = false;
    commandHandled = false;
    if (recognition) {
      try { recognition.stop(); } catch (_) {}
    }
    syncMicButtonUI();
    setStatus('Mic off. Tap mic to speak again.', false);
  }

  function toggleListening() {
    if (shouldListen) {
      stopListening();
    } else {
      startListening();
    }
  }

  // ── Permission helper ─────────────────────────────────────────────────
  async function syncMicPermission() {
    try {
      if (navigator.permissions?.query) {
        const st = await navigator.permissions.query({ name: 'microphone' });
        if (st.state === 'granted') { setMicBlocked(false); return true; }
        if (st.state === 'denied')  { return false; }
        st.onchange = () => {
          if (st.state === 'granted') {
            setMicBlocked(false);
            setStatus('Microphone allowed. Click the mic or type a command below.', true);
          }
        };
      }
    } catch (_) {}
    return !micBlocked;
  }

  async function requestMicAccess() {
    if (!navigator.mediaDevices?.getUserMedia) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicBlocked(false);
      showMicHelp(false);
      return true;
    } catch (_) {
      return false;
    }
  }

  // ── Recognition init ──────────────────────────────────────────────────
  function initRecognition() {
    if (!SpeechRecognition) return;
    recognition = new SpeechRecognition();

    // NON-continuous: mic stops automatically after one utterance.
    // This is the key fix to prevent the assistant from hearing its own voice.
    recognition.continuous = false;
    recognition.interimResults = true;   // show interim in status bar (fast feedback)
    recognition.maxAlternatives = 1;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      syncMicButtonUI();
      setStatus('Listening…', false);
    };

    // ── RESULT HANDLER ────────────────────────────────────────────────
    recognition.onresult = (event) => {
      if (!voiceEnabled) return;
      if (isSpeaking)    return;
      if (commandHandled) return;

      const result = event.results[event.results.length - 1];

      // Only process final results for form fields and commands
      if (!result.isFinal) {
        setStatus(`… ${result[0].transcript}`, false);
        return;
      }

      const transcript = result[0].transcript.trim();
      if (!transcript || transcript.length < 2) return;

      // Confidence filter — ignore very low-confidence results
      const confidence = result[0].confidence || 1;
      if (confidence < 0.60) {
        setStatus('Could not understand. Please try again.', false);
        commandHandled = false;
        shouldListen = true;
        setTimeout(() => {
          if (voiceEnabled && !isSpeaking && shouldListen) {
            try { recognition.start(); } catch (_) {}
          }
        }, 200);
        return;
      }

      // Normalization for specific fields
      let normalized = transcript;
      let lastField = window.SAAMSGuide?.lastField || '';
      if (/email|e-mail|mail/i.test(lastField)) {
        normalized = transcript
          .toLowerCase()
          .replace(/at the rate/g, "@")
          .replace(/\bat\b/g, "@")
          .replace(/\bdot\b/g, ".")
          .replace(/\s+/g, "");
        // Confirm email contains @ and .
        if (!/@/.test(normalized) || !/\./.test(normalized)) {
          speak('Please say your full email address, including at and dot.');
          commandHandled = false;
          shouldListen = true;
          setTimeout(() => { if (voiceEnabled && !isSpeaking && shouldListen) { try { recognition.start(); } catch (_) {} } }, 200);
          return;
        }
      } else if (/name/i.test(lastField)) {
        normalized = transcript.trim().replace(/\s+/g, ' ');
      } else if (/otp|code/i.test(lastField)) {
        normalized = transcript.replace(/\D/g, '');
      } else if (/phone|mobile/i.test(lastField)) {
        normalized = transcript.replace(/\D/g, '');
      }

      commandHandled = true;
      shouldListen   = false;
      try { recognition.stop(); } catch (_) {}
      setStatus(`Heard: ${normalized}`, true);
      // If filling a field, use normalized value
      if (window.SAAMSGuide?.lastField) {
        setFieldValue(window.SAAMSGuide.lastField, normalized);
      } else {
        parseCommand(normalized).catch(() => setStatus('Try again', false));
      }
    };

    // ── END HANDLER ───────────────────────────────────────────────────
    // Only restart if we are still expecting input (shouldListen=true)
    // and no command has been handled yet.
    recognition.onend = () => {
      syncMicButtonUI();
      if (
        voiceEnabled &&
        shouldListen &&
        !isSpeaking &&
        !commandHandled
      ) {
        // Re-start to keep listening (no-speech timeout case)
        try { recognition.start(); } catch (_) {}
      }
    };

    // ── ERROR HANDLER ─────────────────────────────────────────────────
    recognition.onerror = (e) => {
      if (e.error === 'no-speech') {
        if (shouldListen && voiceEnabled && !isSpeaking) {
          try { recognition.start(); } catch (_) {}
        }
        return;
      }
      if (e.error === 'aborted') return;

      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setMicBlocked(true);
        shouldListen = false;
        syncMicButtonUI();
        showMicHelp(true);
        setStatus('Mic blocked — allow in address bar and refresh.', false);
        return;
      }
      if (e.error === 'network') {
        shouldListen = false;
        syncMicButtonUI();
        setStatus('Voice needs internet. Check Wi‑Fi.', false);
        return;
      }
      if (e.error === 'audio-capture') {
        shouldListen = false;
        syncMicButtonUI();
        setStatus('No microphone found.', false);
        return;
      }
      setStatus(`Voice: ${e.error}. Tap mic again.`, false);
    };
  }

  // ── Toggle voice ON / OFF ─────────────────────────────────────────────
  function disableVoice() {
    voiceEnabled = false;
    isSpeaking   = false;
    shouldListen  = false;
    commandHandled = false;
    localStorage.setItem('saams_voice', 'off');

    synth.cancel();
    if (recognition) { try { recognition.stop(); } catch (_) {} }

    if (window.VoiceMemory) {
      window.VoiceMemory.voiceEnabled = false;
    }

    syncMicButtonUI();
    setStatus('Voice off.', false);
  }

  function enableVoice() {
    voiceEnabled = true;
    localStorage.setItem('saams_voice', 'on');

    if (window.VoiceMemory) {
      window.VoiceMemory.voiceEnabled = true;
    }

    showPanel();
    setStatus('Voice on.', false);

    // Resume the current page flow
    const path = window.location.pathname;
    const isHome = path === '/' || path === '';

    if (isHome) {
      // Re-run welcome on home page
      setTimeout(() => {
        speak('Welcome to SAMS. Would you like to login or register?', true, true, () => {
          startListening();
        });
      }, 300);
    } else {
      // Resume step-by-step flow on login/register pages
      setTimeout(() => {
        if (window.SAAMSGuide?.resumeOnPage) {
          window.SAAMSGuide.resumeOnPage(true); // force=true to re-prompt
        } else {
          startListening();
        }
      }, 300);
    }
  }

  // Public toggle — called by the voice form toggle checkbox
  function toggleVoice(on) {
    if (on) {
      enableVoice();
    } else {
      disableVoice();
    }
  }

  // ── Text command runner (from command bar) ────────────────────────────
  function runTextCommand(text) {
    const raw = (text || '').trim();
    if (!raw) return;
    showPanel();
    parseCommand(raw).catch(() => setStatus('Try again', false));
  }

  // ── Field helpers ─────────────────────────────────────────────────────
  function findField(label) {
    const map = {
      title: ['title'],
      category: ['category'],
      'event name': ['event_name'],
      organizer: ['organizer'],
      date: ['event_date', 'date'],
      rank: ['rank'],
      level: ['level'],
      description: ['description'],
      email: ['email'],
      password: ['password'],
      'confirm password': ['confirm_password'],
      'full name': ['full_name'],
      mobile: ['mobile'],
      department: ['department'],
      year: ['year'],
      code: ['code'],
      'activity name': ['activity_name'],
      'activity type': ['activity_type'],
      role: ['role'],
      duration: ['duration'],
      comment: ['mentor_comment'],
    };
    const keys = map[label] || [label.replace(/\s/g, '_')];
    for (const k of keys) {
      const el = document.querySelector(`[name="${k}"], #${k}, [data-voice-field="${k}"]`);
      if (el) return el;
    }
    return null;
  }

  function setFieldValue(label, value) {
    if (window.SAAMSGuide?.fillField) {
      const key = label.replace(/\s+/g, '_');
      if (window.SAAMSGuide.fillField(key, value, false)) return true;
    }
    const el = findField(label);
    if (!el) {
      speak(`Could not find field for ${label}`);
      return false;
    }
    const sensitive = el.type === 'password' || /password|otp|code|pin/i.test(label);
    if (el.tagName === 'SELECT') {
      const opt = [...el.options].find(
        (o) =>
          o.text.toLowerCase().includes(value.toLowerCase()) ||
          o.value.toLowerCase() === value.toLowerCase()
      );
      if (opt) el.value = opt.value;
      else el.value = value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (sensitive) speak(`Please type your ${label} on screen. I will not read it aloud.`);
    else speak(`Set ${label} to ${value}`);
    return true;
  }

  function selectCategory(value) {
    return setFieldValue('category', value);
  }

  function clickButton(selectors) {
    const list = Array.isArray(selectors) ? selectors : [selectors];
    for (const sel of list) {
      const btn = document.querySelector(sel);
      if (btn) { btn.click(); return true; }
    }
    return false;
  }

  function clickVoiceTarget(target) {
    const el = document.querySelector(`[data-voice-target="${target}"], [data-voice-action="${target}"]`);
    if (el) { el.click(); return true; }
    return false;
  }

  // ── Navigation ────────────────────────────────────────────────────────
  function navigate(url) {
    if (!url) return;
    if (window.SAAMSSpa?.navigate) window.SAAMSSpa.navigate(url, { delay: 420 });
    else window.location.href = url;
  }

  // ── Achievements filter ───────────────────────────────────────────────
  function filterAchievements(status, category) {
    const base = window.SAAMS?.urls?.achievements;
    if (!base) {
      speak('Open achievements after logging in as a student.');
      return;
    }
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (category) params.set('category', category);
    const q = params.toString();
    navigate(base + (q ? `?${q}` : ''));
    speak(`Showing ${status || 'all'} achievements${category ? ' in ' + category : ''}.`);
  }

  function openNotifications() {
    const btn = document.querySelector('[aria-label="Notifications"]');
    if (btn) { btn.click(); speak('Notifications opened.'); return true; }
    speak('Notification center is not available on this page.');
    return false;
  }

  function currentSubmissionId() {
    const m = window.location.pathname.match(/\/submissions\/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }

  async function goToNextSubmission() {
    const urls = window.SAAMS?.urls || {};
    const after = currentSubmissionId();
    const apiUrl = urls.voiceNextSubmission + (after ? `?after=${after}` : '');
    try {
      const res = await fetch(apiUrl);
      const data = await res.json();
      if (data.url) {
        speak(data.message || `Opening ${data.title || 'next submission'}.`);
        navigate(data.url);
        return;
      }
      speak(data.message || 'No pending submissions.');
    } catch (_) {
      const link = document.querySelector('table tbody a[href*="/submissions/"]');
      if (link) { link.click(); speak('Opening submission.'); }
      else if (urls.submissions) { navigate(urls.submissions); speak('Opening submissions list.'); }
      else speak('Could not find the next submission.');
    }
  }

  async function showHelp() {
    if (!helpCache) {
      try {
        const res = await fetch(window.SAAMS?.urls?.voiceHelp || '/voice/help');
        helpCache = (await res.json()).help || '';
      } catch (_) { helpCache = ''; }
    }
    const landing = 'Landing: Login, Register me, Send OTP, Turn voice off. ';
    const text = landing + (helpCache || 'Say open dashboard, add achievement, set title, upload certificate, submit form.');
    speak(text.length > 400 ? text.slice(0, 397) + '...' : text);
    setStatus('Say "Help" anytime · Ctrl+Shift+V');
  }

  function readOcrOnPage() {
    const pre = document.querySelector('.ocr-preview, [data-ocr-text], pre.small');
    const ocrPanel = document.getElementById('ocrPreviewPanel');
    if (ocrPanel?.dataset.ocr) {
      const d = JSON.parse(ocrPanel.dataset.ocr);
      speak(
        `Verification ${d.verification_status}. Name match ${Math.round((d.match_score || 0) * 100)} percent. Confidence ${Math.round((d.confidence_score || 0) * 100)} percent.`
      );
      return;
    }
    if (pre) { speak(pre.innerText?.slice(0, 400) || 'No OCR text.'); return; }
    speak('No OCR results on this page.');
  }

  function openFilePicker() {
    const input =
      window.SAAMSUpload?.getFileInput?.() ||
      document.querySelector('#certificateInput, input[name="certificate"], input[name="document"], .certificate-upload');
    if (input) {
      input.click();
      speak('Opening file picker. Select your certificate file. I will confirm when it is attached.');
      return true;
    }
    speak('No upload field on this page. Say add achievement first.');
    return false;
  }

  function confirmPendingUpload() {
    const pending = window.SAAMS?.pendingCertificate;
    if (!pending?.file) {
      speak('No file selected yet. Say upload certificate to open the file picker.');
      return false;
    }
    speak(`Certificate ${pending.name} attached successfully. Say submit form to complete your submission.`);
    return true;
  }

  function autoFillFromOcr(data) {
    if (!data) data = window.SAAMS?.lastOcrPreview;
    if (!data) { speak('No OCR data. Upload a certificate first.'); return; }
    let filled = 0;
    if (data.detected_event && setFieldValue('event name', data.detected_event)) filled++;
    if (data.detected_date && setFieldValue('date', data.detected_date)) filled++;
    if (filled) speak('Form fields filled from certificate.');
    else speak('Could not auto-fill fields from certificate.');
  }

  // ── Command parser ────────────────────────────────────────────────────
  async function parseCommand(raw) {
    if (window.SAAMSAgent?.handleInterrupt?.(raw)) return;

    const t = raw.toLowerCase().trim();
    const urls = window.SAAMS?.urls || {};

    // Fast navigation from any page
    if (/^login$|^log in$|^sign in$/.test(t)) { window.SAAMSGuide?.beginLogin?.(); return; }
    if (/^register$|^sign up$|^create account$/.test(t)) { window.SAAMSGuide?.beginRegister?.(); return; }

    if (await window.SAAMSAgent?.executeStackFromRaw?.(raw)) return;
    if (await window.SAAMSAgent?.tryCompound?.(raw)) return;
    if (await window.SAAMSGuide?.handleInput?.(raw)) return;

    let m;

    if (/turn voice off|close voice|disable voice|stop voice|pause assistant/.test(t)) {
      disableVoice();
      speak('Voice assistant turned off.', true, true);
      return;
    }
    if (/turn voice on|wake up|enable voice|wake up assistant/.test(t)) {
      enableVoice();
      return;
    }
    if (/turn on guide|enable guide|enable assistant/.test(t)) {
      window.VoiceMemoryAPI?.enableGuide?.();
      return;
    }
    if (/turn off guide|stop voice guide|disable assistant|stop helping me/.test(t)) {
      window.VoiceMemoryAPI?.disableGuide?.();
      return;
    }
    if (/go to dashboard|open dashboard/.test(t)) {
      return navigate(urls.mentorDashboard && window.SAAMS?.role === 'mentor' ? urls.mentorDashboard : urls.studentDashboard);
    }
    if (/open student panel|student dashboard/.test(t)) return navigate(urls.studentDashboard);
    if (/open mentor panel|mentor dashboard/.test(t)) return navigate(urls.mentorDashboard || urls.mentorLogin);
    if (/read page summary|summarize page|what is on this page/.test(t)) {
      const main = document.getElementById('main-content');
      speak((main?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 500) || 'No content on this page.');
      return;
    }
    if (/help|what can you do/.test(t)) { showHelp(); return; }
    if (/repeat that|say again/.test(t)) { if (lastSpoken) speak(lastSpoken, false); return; }
    if (/stop listening|stop microphone|stop mic/.test(t)) { stopListening(); speak('Stopped listening.'); return; }
    if (/stop speaking|be quiet|mute/.test(t)) { synth.cancel(); return; }
    if (/scroll down/.test(t)) { window.scrollBy({ top: 400, behavior: 'smooth' }); return; }
    if (/scroll to top|scroll up/.test(t)) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (/go back|back to home|go back to home/.test(t)) {
      if (/home/.test(t)) return navigate('/');
      window.history.back();
      return;
    }

    if (/^login$|log in|sign in$/.test(t)) { window.SAAMSGuide?.beginLogin?.(); return; }
    if (/^register$|register me|sign up|create account/.test(t)) { window.SAAMSGuide?.beginRegister?.(); return; }

    m = t.match(/register me as a (?:student|mentor) named (.+?) with email (.+)/);
    if (m) {
      navigate(urls.register);
      setTimeout(() => {
        setFieldValue('full name', m[1].trim());
        setFieldValue('email', m[2].trim());
        const roleEl = document.querySelector('[name="role"]');
        if (roleEl) roleEl.value = t.includes('mentor') ? 'mentor' : 'student';
      }, 600);
      speak('Opening registration. Filling your name and email.');
      return;
    }

    if (/google|sign in with google|login with google/.test(t)) {
      speak('Google Sign-In is not available. Say login to sign in with OTP.');
      return;
    }
    if (/logout|log out/.test(t)) {
      if (clickVoiceTarget('logout')) return;
      return navigate(urls.logout);
    }
    if (/otp|login with otp/.test(t)) return navigate(urls.loginOtp);
    if (/send otp|resend otp|resend code/.test(t)) {
      clickButton('[type="submit"]');
      speak('Sending verification code.');
      return;
    }
    m = t.match(/verify otp (\d+)|otp (\d{4,8})/);
    if (m) return setFieldValue('code', m[1] || m[2]);
    if (/forgot password/.test(t)) return navigate(urls.forgotPassword);

    if (/student dashboard|open student dashboard/.test(t)) return navigate(urls.studentDashboard);
    if (/mentor dashboard|open mentor dashboard/.test(t)) return navigate(urls.mentorDashboard);
    if (/open dashboard|^dashboard$/.test(t)) {
      if (!window.SAAMS?.isAuthenticated) { speak('Please log in first.'); return navigate(urls.login); }
      return navigate(window.SAAMS?.role === 'mentor' ? urls.mentorDashboard : urls.studentDashboard);
    }
    if (/add (a )?technical achievement|technical achievement/.test(t)) {
      navigate(urls.achievementAdd);
      setTimeout(() => selectCategory('Technical'), 800);
      speak('Opening achievement form with technical category.');
      return;
    }
    if (/add achievement|new achievement|open achievement form/.test(t)) return navigate(urls.achievementAdd);
    if (/add activity|new activity/.test(t)) return navigate(urls.activityAdd);
    if (/go to achievements|open achievements/.test(t)) return navigate(urls.achievements);
    if (/go to activities|open activities/.test(t)) return navigate(urls.activities);
    if (/open reports|reports section/.test(t)) return navigate(urls.reports);
    if (/pending submissions|open submissions/.test(t)) return navigate(urls.submissions);
    if (/analytics|open analytics/.test(t)) return navigate(urls.analytics);
    if (/leaderboard|top 10|top ten students/.test(t)) return navigate(urls.leaderboard);
    if (/profile|profile settings/.test(t)) return navigate(urls.profile);
    if (/portfolio|download.*portfolio/.test(t)) {
      const link = document.querySelector('a[href*="portfolio/pdf"]');
      if (link) { link.click(); speak('Downloading portfolio PDF.'); }
      else navigate(urls.reports || urls.portfolio);
      return;
    }
    if (/download.*excel|achievements in excel/.test(t)) {
      const link = document.querySelector('a[href*="export/excel"]');
      if (link) link.click();
      else if (urls.exportExcel) navigate(urls.exportExcel);
      speak('Downloading Excel export.');
      return;
    }
    if (/home|landing/.test(t)) return navigate('/');

    if (/show only approved|approved achievements/.test(t)) return filterAchievements('Approved');
    if (/show rejected|rejected submissions/.test(t)) return filterAchievements('Rejected');
    if (/show pending|pending submissions/.test(t)) return filterAchievements('Submitted');
    m = t.match(/filter.*(technical|academic|sports|cultural|research|certification|leadership)/);
    if (m) {
      const cat = m[1].charAt(0).toUpperCase() + m[1].slice(1);
      if (window.SAAMS?.role === 'mentor' && urls.submissions) {
        navigate(`${urls.submissions}?category=${cat}`);
        speak(`Filtering by ${cat} category.`);
      } else filterAchievements('', cat);
      return;
    }
    if (/search for (.+)|search student (.+)/.test(t)) {
      m = t.match(/search (?:for |student )?(.+)/);
      const input = document.getElementById('globalSearch');
      if (input && m) {
        input.value = m[1];
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        speak(`Searching for ${m[1]}.`);
        return;
      }
    }
    if (/notification|open notification/.test(t)) { openNotifications(); return; }
    if (/enable dark|dark mode on/.test(t)) {
      document.documentElement.dataset.theme = 'dark';
      fetch(urls.toggleDark, { method: 'POST', headers: { 'X-CSRFToken': window.SAAMS?.csrfToken } }).catch(() => {});
      speak('Dark mode enabled.');
      return;
    }
    if (/disable dark|light mode/.test(t)) {
      document.documentElement.dataset.theme = 'light';
      fetch(urls.toggleDark, { method: 'POST', headers: { 'X-CSRFToken': window.SAAMS?.csrfToken } }).catch(() => {});
      speak('Light mode enabled.');
      return;
    }
    if (/toggle dark|switch theme/.test(t)) {
      document.getElementById('darkModeToggle')?.click();
      speak('Theme toggled.');
      return;
    }

    m = t.match(
      /set (title|category|event name|organizer|date|rank|level|description|email|password|full name|mobile|department|activity name|activity type|role|duration) to (.+)/i
    );
    if (m) return setFieldValue(m[1].toLowerCase(), m[2].trim());

    m = t.match(/fill event name as (.+)|set organizer to (.+)/i);
    if (m) return setFieldValue(m[1] ? 'event name' : 'organizer', (m[1] || m[2]).trim());

    m = t.match(/select (.+) from category|category (.+)/);
    if (m) return selectCategory((m[1] || m[2]).trim());

    if (/fill from certificate|auto.?fill/.test(t)) { autoFillFromOcr(); return; }

    if (/open file manager|open file picker|upload certificate|browse file|help me upload/.test(t)) {
      if (!window.SAAMSUpload?.getFileInput?.() && urls.achievementAdd) {
        speak('Opening the achievement form so you can upload your certificate.');
        navigate(urls.achievementAdd);
        setTimeout(() => openFilePicker(), 1100);
        return;
      }
      return openFilePicker();
    }

    if (/upload (the )?selected file|attach (the )?selected|upload this file|attach document/.test(t)) {
      confirmPendingUpload();
      return;
    }

    if (/submit achievement|submit this achievement|submit form|submit this/.test(t)) {
      if (clickButton('.btn-submit, [type="submit"][name="submit"], button[type="submit"].btn-primary-neu')) {
        speak('Submitting.');
      } else speak('Submit button not found.');
      return;
    }
    if (/click submit/.test(t)) { clickButton('[type="submit"]'); speak('Clicked submit.'); return; }
    if (/save draft|save this as draft/.test(t)) { clickButton('[name="save_draft"]'); speak('Saving draft.'); return; }
    if (/clear form|reset form|reset this form/.test(t)) { document.querySelector('form')?.reset(); speak('Form cleared.'); return; }
    if (/resubmit/.test(t)) {
      if (clickButton('form[action*="resubmit"] button, button')) speak('Resubmitting.');
      else speak('No resubmit action on this page.');
      return;
    }
    if (/delete.*draft/.test(t)) { clickButton('form[action*="delete"] button'); speak('Delete requested.'); return; }

    if (/approve|approve submission|approve this/.test(t)) {
      clickButton('[name="submit_approve"], .btn-approve');
      speak('Approving submission.');
      return;
    }
    if (/reject/.test(t)) { clickButton('[name="submit_reject"], .btn-reject'); speak('Rejecting submission.'); return; }
    if (/next submission|approve the next/.test(t)) { goToNextSubmission(); return; }

    m = t.match(/add comment (.+)|reject.*comment (.+)/);
    if (m) {
      const ta = document.querySelector('[name="mentor_comment"]');
      if (ta) { ta.value = m[1]; speak('Comment added.'); }
      return;
    }
    if (/read mentor remarks|read why.*rejected/.test(t)) {
      const main = document.getElementById('main-content');
      speak(main?.innerText?.slice(0, 500) || 'No remarks found.');
      return;
    }
    if (/read (the )?ocr|read extracted|ocr extracted|verification status|confidence score/.test(t)) {
      readOcrOnPage();
      return;
    }
    if (/read (all )?fields|read this page/.test(t)) {
      const main = document.getElementById('main-content');
      speak(main?.innerText?.slice(0, 600) || 'No content.');
      return;
    }
    if (/is my submission approved/.test(t)) {
      const badge = document.querySelector('.status-badge, [class*="status-"]');
      speak(badge ? `Status is ${badge.textContent.trim()}` : 'Check your achievements list for status.');
      return;
    }
    if (/open certificate preview|view certificate/.test(t)) {
      const link = document.querySelector('a[href*="certificate"], a[target="_blank"]');
      if (link) { link.click(); speak('Opening certificate.'); }
      else speak('No certificate link on this page.');
      return;
    }

    speak(`I heard: ${raw}. Say help for commands.`);
  }

  // ── File-selected event ───────────────────────────────────────────────
  function onFileSelected(detail) {
    if (!voiceEnabled) return;
    speak(`${detail.name} selected. Certificate attached successfully. Say submit form when you are ready.`);
  }

  // ── Init ──────────────────────────────────────────────────────────────
  async function initVoiceSystem() {
    if (window.voiceInitialized) return;
    window.voiceInitialized = true;

    initRecognition();
    sessionStorage.removeItem('saams_mic_blocked');
    showMicHelp(false);

    // Voice form toggle (login / register pages)
    document.addEventListener('saams:voice-toggle', (e) => {
      toggleVoice(e.detail?.on);
    });

    document.getElementById('voiceBtnGuideOff')?.addEventListener('click', () => {
      window.VoiceMemoryAPI?.disableGuide?.();
      stopListening();
      setStatus('Guide off — buttons still work', false);
    });

    enableMicBtn()?.addEventListener('click', () => {
      setMicBlocked(false);
      showMicHelp(false);
      startListening();
    });

    micBtn()?.addEventListener('click', () => {
      showPanel();
      toggleListening();
    });

    if (window.location.pathname === '/' || window.location.pathname === '') {
      setTimeout(showPanel, 500);
    }

    document.getElementById('voicePanelClose')?.addEventListener('click', () => {
      if (panel()) panel().hidden = true;
      stopListening();
    });

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        toggleListening();
      }
    });

    document.addEventListener('saams:file-selected', (e) => onFileSelected(e.detail));

    // Welcome-back for authenticated users
    const onDashboard =
      window.SAAMS?.isAuthenticated === true &&
      !!window.SAAMS?.userName?.trim() &&
      /(student|mentor)/.test(window.location.pathname);

    if (voiceEnabled && onDashboard && !sessionStorage.getItem('saams_welcomed_back')) {
      sessionStorage.setItem('saams_welcomed_back', '1');
      setTimeout(() => {
        window.VoiceMemoryAPI?.speakOnce?.(
          `Welcome back, ${window.SAAMS.userName.split(' ')[0]}. Say help for commands.`,
          { force: true, allowRepeat: true }
        );
      }, 800);
    }
  }

  // Master controller: Only call initVoiceSystem() from here if this is the main entry point.
  // Remove auto-initialization to prevent multiple systems running.

  // ── Public API ────────────────────────────────────────────────────────
  window.SAAMSVoice = {
    speak,
    speakAndListen,
    parseCommand,
    runTextCommand,
    startListening,
    stopListening,
    toggleVoice,
    enableVoice,
    disableVoice,
    requestMicAccess,
    syncMicPermission,
    isMicBlocked: () => micBlocked,
    isVoiceEnabled: () => voiceEnabled,
    isSpeakingNow: () => isSpeaking,
    openFilePicker,
    showHelp,
    autoFillFromOcr,
    confirmPendingUpload,
  };
})();
