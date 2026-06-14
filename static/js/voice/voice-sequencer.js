/**
 * VoiceSequencer — guided, confirm-before-submit workflows for SAAMS.
 */
window.VoiceSequencer = (function () {
  const D = window.VoiceDOM;
  const VE = () => window.VoiceEngine;
  const SK = 'saams_voice_seq';

  let running = false;

  function path() {
    return window.location.pathname;
  }

  function isLanding() {
    const p = path();
    return p === '/' || p === '';
  }

  function isLogin() {
    return /\/auth\/login\/?$/i.test(path());
  }

  function isRegister() {
    return /\/auth\/register\/?$/i.test(path());
  }

  function isVerify() {
    return /\/verify-(login-)?otp|\/mentor-verify-otp/i.test(path());
  }

  function isAchievementForm() {
    return /\/achievements\/(add|\d+\/edit)\/?$/i.test(path());
  }

  function isActivityForm() {
    return /\/activities\/(add|\d+\/edit)\/?$/i.test(path());
  }

  function isDashboardLike() {
    return !!window.SAAMS?.isAuthenticated && !isAchievementForm() && !isActivityForm();
  }

  function norm(text) {
    return String(text || '').toLowerCase().trim();
  }

  function compact(text) {
    return norm(text).replace(/[^a-z0-9]/g, '');
  }

  function matchLogin(c) {
    const t = norm(c);
    const k = compact(c);
    return (
      /\b(login|log in|logon|log on|sign in|signin|sign me in|log me in|let me in|open login|open sign in|go to login|go to sign in|take me to login|take me to sign in|student login)\b/i.test(t) ||
      /(login|logmein|signin|signmein|studentlogin|opentologin|gotologin|takemetologin)/i.test(k)
    );
  }

  function matchRegister(c) {
    const t = norm(c);
    const k = compact(c);
    return (
      /\b(register|registration|resgister|sign up|signup|sign-up|create account|new account|register me|open register|go to register|take me to register)\b/i.test(t) ||
      /(register|registration|signup|createaccount|newaccount|openregister|gotoregister|takemetoregister)/i.test(k)
    );
  }

  function isYes(c) {
    return /\b(yes|yeah|yep|correct|right|ok|okay|confirm|proceed|submit)\b/i.test(c);
  }

  function isNo(c) {
    return /\b(no|nope|wrong|incorrect|repeat|again|change)\b/i.test(c);
  }

  function cleanPrefix(text, prefixes) {
    let value = String(text || '').trim();
    prefixes.forEach((p) => {
      value = value.replace(new RegExp(`^${p}\\s+`, 'i'), '');
    });
    return value.trim();
  }

  function cleanName(text) {
    return titleCaseName(removeSpellingEcho(cleanPrefix(text, ['my name is', 'name is', 'i am', "i'm"])));
  }

  function cleanRoll(text) {
    return cleanPrefix(text, ['roll number is', 'roll is', 'my roll is', 'id is']);
  }

  function cleanBranch(text) {
    return titleCaseName(cleanPrefix(text, ['branch is', 'department is', 'in']));
  }

  function exactText(text) {
    return String(text || '').trim().replace(/\s+/g, ' ');
  }

  function titleCaseName(text) {
    return exactText(text)
      .toLowerCase()
      .replace(/\b[a-z]/g, (m) => m.toUpperCase());
  }

  function removeSpellingEcho(text) {
    const tokens = exactText(text).split(/\s+/).filter(Boolean);
    const kept = [];
    let i = 0;
    while (i < tokens.length) {
      const run = [];
      let j = i;
      while (j < tokens.length && /^[a-z]$/i.test(tokens[j])) {
        run.push(tokens[j].toLowerCase());
        j += 1;
      }
      if (run.length >= 2 && tokens[j]) {
        const spelled = run.join('');
        const next = tokens[j].toLowerCase().replace(/[^a-z]/g, '');
        if (next === spelled) {
          kept.push(tokens[j]);
          i = j + 1;
          continue;
        }
      }
      kept.push(tokens[i]);
      i += 1;
    }
    return kept.join(' ');
  }

  function normalizeSpelled(text) {
    const words = {
      zero: '0',
      oh: '0',
      o: '0',
      one: '1',
      two: '2',
      to: '2',
      three: '3',
      four: '4',
      for: '4',
      five: '5',
      six: '6',
      seven: '7',
      eight: '8',
      ate: '8',
      nine: '9',
      at: '@',
      dot: '.',
      period: '.',
      underscore: '_',
      dash: '-',
      hyphen: '-',
      minus: '-',
      plus: '+',
    };
    return String(text || '')
      .toLowerCase()
      .replace(/\bat\s+the\s+rate\b/g, ' @ ')
      .replace(/\bat\s+rate\b/g, ' @ ')
      .replace(/\bg\s*mail\b/g, 'gmail')
      .split(/\s+/)
      .map((token) => {
        const clean = token.replace(/[^\w@.+-]/g, '');
        return words[clean] ?? clean;
      })
      .join('');
  }

  function parseEmail(text) {
    const cleaned = String(text || '')
      .replace(/\bat\s+the\s+rate\s+or\s+at\b/gi, 'at the rate')
      .replace(/\bor\s+at\s+(gmail|yahoo|outlook|hotmail)\b/gi, 'at $1');
    return D.extractEmail(cleaned) || D.normalizeEmail(cleaned) || D.normalizeEmail(normalizeSpelled(cleaned));
  }

  function parsePassword(text) {
    return normalizeSpelled(
      cleanPrefix(text, ['password is', 'my password is', 'confirm password is', 'confirmation password is'])
    ).replace(/\s+/g, '');
  }

  function parseRole(text) {
    const t = norm(text);
    if (/mentor|faculty|teacher/.test(t)) return 'mentor';
    return 'student';
  }

  function speakEmail(email) {
    return String(email || '')
      .replace(/@/g, ' at the rate ')
      .replace(/\./g, ' dot ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseYear(text) {
    const t = norm(text);
    if (/\b(1|first|one)\b/.test(t)) return '1';
    if (/\b(2|second|two)\b/.test(t)) return '2';
    if (/\b(3|third|three)\b/.test(t)) return '3';
    if (/\b(4|fourth|four)\b/.test(t)) return '4';
    return '';
  }

  function parseOtp(text) {
    const words = {
      zero: '0',
      oh: '0',
      o: '0',
      one: '1',
      two: '2',
      to: '2',
      three: '3',
      four: '4',
      for: '4',
      five: '5',
      six: '6',
      seven: '7',
      eight: '8',
      ate: '8',
      nine: '9',
    };
    const spoken = norm(text)
      .split(/\s+/)
      .map((w) => words[w] ?? w)
      .join('');
    return spoken.replace(/\D/g, '').slice(0, 6);
  }

  function chooseOption(value, fallback) {
    return value || fallback || '';
  }

  async function hear(opts = {}) {
    const attempts = opts.attempts || 3;
    let lastError = null;

    for (let i = 0; i < attempts; i++) {
      try {
        const transcript = await VE().listenOnce(opts);
        if (transcript === '__voice_stop__') {
          await VE().speak('Voice guide is off for this page. Use the voice button to start again.');
          throw new Error('voice-stopped');
        }
        return transcript;
      } catch (err) {
        lastError = err;
        const message = String(err.message || err);
        if (/voice-stopped|not-allowed|service-not-allowed/i.test(message)) throw err;
        if (i < attempts - 1) await VE().speak('I am listening. Please say that again.');
      }
    }

    throw lastError || new Error('no-match');
  }

  async function askConfirmed(step) {
    while (true) {
      await VE().speak(step.say);
      let value = '';
      while (!step.valid(value)) {
        const transcript = await hear(step.listen || {});
        value = step.parse(transcript);
        if (!step.valid(value)) await VE().speak(step.retry || step.say);
      }
      await VE().speak(step.confirm(value));
      const answer = await hear({
        allowInterim: true,
        validate: (c) => isYes(c) || isNo(c),
      });
      if (isYes(answer)) return value;
      await VE().speak('No problem. Let us try that again.');
    }
  }

  function fillAndFocus(name, value) {
    D.fill(name, value);
    D.field(name)?.focus?.();
  }

  function speakThenGo(message, url) {
    VE().speak(message);
    setTimeout(() => {
      window.location.href = url;
    }, 350);
  }

  function goNow(url) {
    if (!url) return false;
    window.location.href = url;
    return true;
  }

  async function homeFlow() {
    await VE().speak('Welcome to Student Achievement and Activity Management System. Would you like to login or register?');
    while (true) {
      try {
        const transcript = await hear({
          allowInterim: true,
          attempts: 5,
          timeoutMs: 22000,
          validate: (c) => matchLogin(c) || matchRegister(c),
        });
        const c = norm(transcript);
        if (matchLogin(c)) {
          sessionStorage.setItem(SK, 'login_email');
          speakThenGo('Opening login.', window.SAAMS?.urls?.login || '/auth/login');
          return;
        }
        if (matchRegister(c)) {
          sessionStorage.setItem(SK, 'register');
          speakThenGo('Opening register.', window.SAAMS?.urls?.register || '/auth/register');
          return;
        }
      } catch (err) {
        if (String(err.message).includes('voice-stopped')) throw err;
      }
      await VE().speak('I did not catch that. Please say login or register.');
    }
  }

  async function loginEmailFlow() {
    await VE().speak('Student login selected.');
    const email = await askConfirmed({
      say: 'Please tell me your email letter by letter. For example, say w o r k w i t h w i k at the rate gmail dot com.',
      parse: parseEmail,
      valid: (v) => v.includes('@') && v.includes('.'),
      retry: 'I could not understand the email. Please say it again slowly, letter by letter.',
      confirm: (v) => `I heard your email as ${speakEmail(v)}. Is this correct?`,
      listen: { timeoutMs: 32000 },
    });
    fillAndFocus('email', email);
    sessionStorage.setItem(SK, 'login_otp');
    await VE().speak('Sending OTP now.');
    D.click(['#sendOtpBtn', 'button[type="submit"]']);
  }

  async function otpFlow() {
    await VE().speak('OTP is sent to your email. Please check your email.');
    const code = await askConfirmed({
      say: 'Please tell me the six digit OTP.',
      parse: parseOtp,
      valid: (v) => /^\d{6}$/.test(v),
      retry: 'I need six digits. Please say the OTP again.',
      confirm: (v) => `The OTP is ${v.split('').join(' ')}. Is it right?`,
      listen: { allowInterim: true, timeoutMs: 22000, validate: (c) => /\d|zero|one|two|to|three|four|for|five|six|seven|eight|ate|nine|oh|o/i.test(c) },
    });
    fillAndFocus('code', code);
    await VE().speak('Verifying OTP now.');
    D.click(['#verifyOtpBtn', 'button[type="submit"]']);
    sessionStorage.removeItem(SK);
  }

  async function registerFlow() {
    await VE().speak('Registration selected. I will ask each field one by one and confirm it before moving ahead.');
    let password = '';
    const steps = [
      {
        say: 'Full Name. Please tell your full name. You can spell it and then say the full word.',
        field: 'full_name',
        parse: cleanName,
        valid: (v) => v.length >= 2,
        retry: 'Please tell your full name again.',
        confirm: (v) => `Your name is ${v}. Is this correct?`,
      },
      {
        say: 'Email. Please tell your email letter by letter. For example, b i n a r y a i zero zero one zero at gmail dot com.',
        field: 'email',
        parse: parseEmail,
        valid: (v) => v.includes('@') && v.includes('.'),
        retry: 'I could not understand the email. Please say it again slowly, letter by letter.',
        confirm: (v) => `I heard your email as ${speakEmail(v)}. Is this correct?`,
        listen: { timeoutMs: 32000 },
      },
      {
        say: 'Mobile. Please tell your ten digit mobile number.',
        field: 'mobile',
        parse: (t) => D.normalizePhone(t),
        valid: (v) => v.replace(/\D/g, '').length >= 10,
        retry: 'Please tell your ten digit mobile number.',
        confirm: (v) => `Your mobile number is ${v.split('').join(' ')}. Is this correct?`,
      },
      {
        say: 'Role. Say student or mentor. Say student for student registration.',
        field: 'role',
        parse: parseRole,
        valid: (v) => v === 'student' || v === 'mentor',
        retry: 'Please say student or mentor.',
        confirm: (v) => `Your role is ${v}. Is this correct?`,
      },
      {
        say: 'Department. Please tell your branch or department.',
        field: 'department',
        parse: cleanBranch,
        valid: (v) => v.length >= 2,
        retry: 'Please tell your branch or department again.',
        confirm: (v) => `Your department is ${v}. Is this correct?`,
      },
      {
        say: 'Year. Please tell your year. Say first, second, third, or fourth year.',
        field: 'year',
        parse: parseYear,
        valid: (v) => !!v,
        retry: 'Please say first, second, third, or fourth year.',
        confirm: (v) => `Your year is ${v}. Is this correct?`,
      },
      {
        say: 'Roll Number. Please tell your roll number.',
        field: 'roll_number',
        parse: cleanRoll,
        valid: (v) => v.length >= 1,
        retry: 'Please tell your roll number again.',
        confirm: (v) => `Your roll number is ${v}. Is this correct?`,
      },
      {
        say: 'Password. Please tell your password. It must be at least eight characters.',
        field: 'password',
        parse: parsePassword,
        valid: (v) => v.length >= 8,
        retry: 'Password must be at least eight characters. Please say it again.',
        confirm: () => 'I have entered the password. Is this correct?',
        after: (v) => { password = v; },
      },
      {
        say: 'Confirm Password. Please repeat the same password.',
        field: 'confirm_password',
        parse: parsePassword,
        valid: (v) => v.length >= 8 && v === password,
        retry: 'Confirm password must match the first password. Please say the same password again.',
        confirm: () => 'I have entered the confirm password. Is this correct?',
      },
    ];

    for (const step of steps) {
      const value = await askConfirmed(step);
      fillAndFocus(step.field, value);
      step.after?.(value);
    }
    await VE().speak('Registration form is ready. Should I submit it?');
    const answer = await hear({ allowInterim: true, validate: (c) => isYes(c) || isNo(c) });
    if (isYes(answer)) {
      D.click(['#registerBtn', 'button[type="submit"]']);
      sessionStorage.removeItem(SK);
    } else {
      await VE().speak('Okay. I will leave the form open for you.');
    }
  }

  async function guidedFormFlow(config) {
    await VE().speak(config.intro);
    for (const step of config.steps) {
      const value = await askConfirmed(step);
      fillAndFocus(step.field, value);
    }
    await VE().speak('Would you like to upload a certificate or supporting document?');
    const uploadAnswer = await hear({
      allowInterim: true,
      validate: (c) => isYes(c) || isNo(c) || /upload|certificate|document|file/i.test(c),
    });
    if (isYes(uploadAnswer) || /upload|certificate|document|file/i.test(uploadAnswer)) {
      await askForUpload();
      return;
    }
    await VE().speak('Should I submit this form now?');
    const submit = await hear({ allowInterim: true, validate: (c) => isYes(c) || isNo(c) });
    if (isYes(submit)) D.click(['.btn-submit', 'button[type="submit"]']);
  }

  async function askForUpload() {
    const name = await askConfirmed({
      say: 'What name have you saved your file with?',
      parse: (t) => cleanPrefix(t, ['file name is', 'name is', 'it is', 'saved as']),
      valid: (v) => v.length >= 1,
      retry: 'Please tell the file name.',
      confirm: (v) => `Your file name is ${v}. Is it right?`,
    });
    await VE().speak(
      `I will open the file picker. Please choose ${name}. PDF, JPG, JPEG, and PNG are accepted.`
    );
    window.SAAMSUpload?.openPicker?.();
  }

  function achievementConfig() {
    return {
      intro: 'Let us add your achievement. I will ask each field one by one.',
      steps: [
        {
          say: 'Tell the achievement title.',
          field: 'title',
          parse: exactText,
          valid: (v) => v.length >= 2,
          retry: 'Please tell the title again.',
          confirm: (v) => `The title is ${v}. Is it right?`,
        },
        {
          say: 'Tell the category. For example technical, sports, academic, research, certification, cultural, or leadership.',
          field: 'category',
          parse: (t) => chooseOption(['Academic', 'Technical', 'Sports', 'Cultural', 'Research', 'Certification', 'Leadership'].find((x) => norm(t).includes(norm(x))), 'Technical'),
          valid: (v) => !!v,
          confirm: (v) => `The category is ${v}. Is it right?`,
        },
        {
          say: 'Tell the level. College, state, national, or international.',
          field: 'level',
          parse: (t) => chooseOption(['College', 'State', 'National', 'International'].find((x) => norm(t).includes(norm(x))), 'College'),
          valid: (v) => !!v,
          confirm: (v) => `The level is ${v}. Is it right?`,
        },
        {
          say: 'Tell the event name.',
          field: 'event_name',
          parse: exactText,
          valid: (v) => v.length >= 1,
          confirm: (v) => `The event name is ${v}. Is it right?`,
        },
        {
          say: 'Tell the organizer.',
          field: 'organizer',
          parse: exactText,
          valid: (v) => v.length >= 1,
          confirm: (v) => `The organizer is ${v}. Is it right?`,
        },
        {
          say: 'Tell the event date. For example, 12 May 2026.',
          field: 'event_date',
          parse: (t) => D.normalizeDate(t),
          valid: (v) => v.length >= 8,
          confirm: (v) => `The date is ${v}. Is it right?`,
        },
        {
          say: 'Tell your rank or position.',
          field: 'rank',
          parse: exactText,
          valid: (v) => v.length >= 1,
          confirm: (v) => `The rank is ${v}. Is it right?`,
        },
        {
          say: 'Tell a short description.',
          field: 'description',
          parse: exactText,
          valid: (v) => v.length >= 1,
          confirm: (v) => `The description is ${v}. Is it right?`,
        },
      ],
    };
  }

  function activityConfig() {
    return {
      intro: 'Let us add your activity. I will ask each field one by one.',
      steps: [
        {
          say: 'Tell the activity name.',
          field: 'activity_name',
          parse: exactText,
          valid: (v) => v.length >= 2,
          confirm: (v) => `The activity name is ${v}. Is it right?`,
        },
        {
          say: 'Tell the activity type. Workshop, seminar, volunteering, club, internship, or other.',
          field: 'activity_type',
          parse: (t) => chooseOption(['Workshop', 'Seminar', 'Volunteering', 'Club', 'Internship', 'Other'].find((x) => norm(t).includes(norm(x))), 'Other'),
          valid: (v) => !!v,
          confirm: (v) => `The activity type is ${v}. Is it right?`,
        },
        {
          say: 'Tell your role.',
          field: 'role',
          parse: exactText,
          valid: (v) => v.length >= 1,
          confirm: (v) => `Your role is ${v}. Is it right?`,
        },
        {
          say: 'Tell the date. For example, 12 May 2026.',
          field: 'date',
          parse: (t) => D.normalizeDate(t),
          valid: (v) => v.length >= 8,
          confirm: (v) => `The date is ${v}. Is it right?`,
        },
        {
          say: 'Tell the duration.',
          field: 'duration',
          parse: exactText,
          valid: (v) => v.length >= 1,
          confirm: (v) => `The duration is ${v}. Is it right?`,
        },
        {
          say: 'Tell the organizer.',
          field: 'organizer',
          parse: exactText,
          valid: (v) => v.length >= 1,
          confirm: (v) => `The organizer is ${v}. Is it right?`,
        },
        {
          say: 'Tell a short description.',
          field: 'description',
          parse: exactText,
          valid: (v) => v.length >= 1,
          confirm: (v) => `The description is ${v}. Is it right?`,
        },
      ],
    };
  }

  function destinationFor(command) {
    const c = norm(command);
    const k = compact(command);
    const urls = window.SAAMS?.urls || {};
    if (!window.SAAMS?.isAuthenticated) {
      if (matchLogin(c)) return urls.login || '/auth/login';
      if (matchRegister(c)) return urls.register || '/auth/register';
    }
    if (/add.*achievement|new.*achievement|achievement form/.test(c) || /addachievement|newachievement|achievementform/.test(k)) return urls.achievementAdd;
    if (/add.*activity|new.*activity|activity form/.test(c) || /addactivity|newactivity|activityform/.test(k)) return urls.activityAdd;
    if (/achievement/.test(c)) return urls.achievements;
    if (/activit/.test(c)) return urls.activities;
    if (/report/.test(c)) return urls.reports;
    if (/notification/.test(c) || /notify|notice/.test(k)) return urls.notificationsPage || '/student/notifications';
    if (/analytics/.test(c)) return urls.analytics || urls.studentDashboard;
    if (/mentor chat|message|chat/.test(c) || /mentorchat|openchat|messages/.test(k)) return urls.messages;
    if (/portfolio/.test(c)) return urls.portfolio;
    if (/dashboard|home/.test(c) || /opendashboard|gotodashboard|gohome|openhome/.test(k)) return urls.studentDashboard || urls.mentorDashboard;
    if (/logout|log out/.test(c) || /logout|signout/.test(k)) return urls.logout;
    return '';
  }

  async function commandMode() {
    if (running || !window.ToggleController?.isMasterOn?.()) return false;
    running = true;
    const hint = document.getElementById('voiceGuideStep');
    if (hint) hint.textContent = 'Listening now. Say login, sign me in, add achievement, dashboard, or help.';

    try {
      if (isLogin()) {
        running = false;
        await loginEmailFlow();
        return true;
      }
      if (isVerify()) {
        running = false;
        await otpFlow();
        return true;
      }
      if (isRegister()) {
        running = false;
        await registerFlow();
        return true;
      }

      const transcript = await hear({
        allowInterim: true,
        attempts: 1,
        timeoutMs: 30000,
        validate: (c) => matchLogin(c) || matchRegister(c) || !!destinationFor(c) || /help|what can i say/i.test(c),
      });
      if (/help|what can i say/i.test(transcript)) {
        await VE().speak('Say login, register, add achievement, add activity, dashboard, reports, portfolio, mentor chat, notifications, or logout.');
        return true;
      }
      const url = destinationFor(transcript);
      if (url) return goNow(url);
      return false;
    } catch (err) {
      if (String(err.message || err).includes('not-allowed')) {
        if (hint) hint.textContent = 'Microphone is blocked. Allow microphone permission in the browser.';
      } else if (hint) {
        hint.textContent = 'I could not hear a command. Please click the mic and say login in one breath.';
      }
      return false;
    } finally {
      running = false;
    }
  }

  async function dashboardFlow() {
    if (!sessionStorage.getItem('saams_welcomed_back')) {
      sessionStorage.setItem('saams_welcomed_back', '1');
      await VE().speak(
        `Welcome ${window.SAAMS?.userName || 'back'} to SAAMS. Say add achievement, add activity, reports, notifications, analytics, mentor chat, portfolio, or stop guide.`
      );
    } else {
      await VE().speak('Voice assistant is ready. What would you like to open?');
    }
    const transcript = await hear({
      allowInterim: true,
      validate: (c) => !!destinationFor(c) || /male voice|female voice|upload certificate|stop guide|turn off/i.test(c),
    });
    if (/female voice|male voice/i.test(transcript)) {
      VE().setVoice(transcript);
      await VE().speak('Voice changed.');
      return;
    }
    if (await window.UploadFlow?.handle?.(transcript)) return;
    const url = destinationFor(transcript);
    if (url) {
      speakThenGo('Opening now.', url);
    }
  }

  async function start() {
    if (running || !window.ToggleController?.isMasterOn?.()) return;
    if (!window.ToggleController?.isPageGuideOn?.()) return;
    if (window.SAAMS && window.SAAMS.voiceEnabled === false) return;
    running = true;

    try {
      if (isLanding()) await homeFlow();
      else if (isLogin()) await loginEmailFlow();
      else if (isVerify()) await otpFlow();
      else if (isRegister()) await registerFlow();
      else if (isAchievementForm()) await guidedFormFlow(achievementConfig());
      else if (isActivityForm()) await guidedFormFlow(activityConfig());
      else if (isDashboardLike()) await dashboardFlow();
    } catch (err) {
      console.error('Voice sequencer:', err);
      if (String(err.message).includes('not-allowed')) {
        console.log('Allow microphone in the browser, click the page, then tap the mic.');
      }
    } finally {
      running = false;
    }
  }

  return {
    start,
    commandMode,
    isLanding,
    isLogin,
    isRegister,
    isVerify,
    isAchievementForm,
    isActivityForm,
  };
})();
