/** DOM helpers for voice auto-fill and clicks */
window.VoiceDOM = {
  field(name) {
    let el = document.querySelector(`[data-voice-field="${name}"], [name="${name}"], #${name}`);
    if (!el && name === 'email') el = document.querySelector('input[type="email"]');
    if (!el && name === 'full_name') {
      el =
        document.querySelector('input[name="full_name"]') ||
        document.querySelector('[data-voice-field="full_name"]');
    }
    return el;
  },

  setValue(el, value) {
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : el instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype;
    const ownSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set || setter;
    if (ownSetter) ownSetter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.classList.add('voice-filled');
  },

  fill(name, value) {
    if (!value) return false;
    const el = this.field(name);
    if (!el) return false;
    if (el.tagName === 'SELECT') {
      const v = String(value).toLowerCase();
      const opt = [...el.options].find(
        (o) => o.value === value || o.value.toLowerCase() === v || o.text.toLowerCase().includes(v)
      );
      el.value = opt ? opt.value : value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      this.setValue(el, value);
    }
    return true;
  },

  normalizeEmail(text) {
    const words = {
      zero: '0',
      one: '1',
      two: '2',
      three: '3',
      four: '4',
      five: '5',
      six: '6',
      seven: '7',
      eight: '8',
      nine: '9',
    };

    return String(text || '')
      .toLowerCase()
      .replace(/[,;:]/g, ' ')
      .replace(/\b(my|the)\s+(email|e mail|mail)\s+(address\s+)?(is|as)\b/gi, ' ')
      .replace(/\b(email|e mail|mail)\s+(is|as)\b/gi, ' ')
      .replace(/\bat\s+the\s+rate\b/gi, ' @ ')
      .replace(/\bat\s+rate\b/gi, ' @ ')
      .replace(/\battherate\b/gi, '@')
      .replace(/\badd\s+the\s+rate\b/gi, ' @ ')
      .replace(/\b(and|ampersand)\s+the\s+rate\b/gi, ' @ ')
      .replace(/\b(g\s*mail|gee\s*mail|gmail)\b/gi, 'gmail')
      .replace(/\b(yahoo\s*mail|yahoomail)\b/gi, 'yahoo')
      .replace(/\b(outlook\s*mail|outlook)\b/gi, 'outlook')
      .replace(/\b(hot\s*mail|hotmail)\b/gi, 'hotmail')
      .replace(/\bdot\s+(com|come|calm|comm)\b/gi, ' .com ')
      .replace(/\bdot\s+(in|inn)\b/gi, ' .in ')
      .replace(/\bdot\s+(org|organisation|organization)\b/gi, ' .org ')
      .replace(/\bdot\s+(edu|education)\b/gi, ' .edu ')
      .replace(/\bcom\b$/gi, '.com')
      .replace(/\bin\b$/gi, '.in')
      .replace(/\b(underscore|under score)\b/gi, '_')
      .replace(/\b(hyphen|dash|minus)\b/gi, '-')
      .replace(/\bplus\b/gi, '+')
      .replace(/\s+@\s+/g, '@')
      .replace(/\s+at\s+gmail\s*/gi, '@gmail')
      .replace(/\s+at\s+yahoo\s*/gi, '@yahoo')
      .replace(/\s+at\s+outlook\s*/gi, '@outlook')
      .replace(/\s+at\s+hotmail\s*/gi, '@hotmail')
      .replace(/\s+at\s+/gi, '@')
      .replace(/\s*@\s*/g, '@')
      .replace(/\s+dot\s+/gi, '.')
      .replace(/\s*\.\s*/g, '.')
      .replace(/\s*\.\s*/g, '.')
      .replace(
        /\b(zero|one|two|three|four|five|six|seven|eight|nine)\b/gi,
        (m) => words[m.toLowerCase()] || m
      )
      .replace(/\s+/g, '')
      .replace(/@(gmail|yahoo|outlook|hotmail)(com|in|org|edu)$/g, '@$1.$2')
      .replace(/@(gmail|yahoo|outlook|hotmail)$/g, '@$1.com')
      .replace(/@(gmail|yahoo|outlook|hotmail)\.$/g, '@$1.com')
      .replace(/\.+/g, '.')
      .replace(/^\./, '')
      .replace(/\.$/, '');
  },

  extractEmail(text) {
    const m = text.match(/[\w.+-]+@[\w.-]+\.\w+/i);
    if (m) return m[0].toLowerCase();
    if (/\bat\b|\bdot\b|@/i.test(text)) return this.normalizeEmail(text);
    return '';
  },

  click(selectors) {
    const list = Array.isArray(selectors) ? selectors : [selectors];
    for (const sel of list) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const form = el.closest('form');
      if (form && typeof form.requestSubmit === 'function') {
        form.requestSubmit(el);
      } else {
        el.click();
      }
      return true;
    }
    return false;
  },

  extractOtp(text) {
    const d = text.replace(/\D/g, '');
    return d.length >= 4 ? d.slice(0, 6) : '';
  },

  normalizePhone(text) {
    return text.replace(/\D/g, '').slice(-10);
  },

  normalizeDate(text) {
    const raw = text.toLowerCase().trim();
    const direct = raw.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
    if (direct) {
      const [, y, m, d] = direct;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    const numeric = raw.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/);
    if (numeric) {
      const [, d, m, y] = numeric;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    const months = {
      january: '01',
      february: '02',
      march: '03',
      april: '04',
      may: '05',
      june: '06',
      july: '07',
      august: '08',
      september: '09',
      october: '10',
      november: '11',
      december: '12',
    };
    const spoken = raw.match(
      /\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/
    );
    if (spoken) {
      const [, d, month, y] = spoken;
      return `${y}-${months[month]}-${d.padStart(2, '0')}`;
    }
    return raw;
  },
};
