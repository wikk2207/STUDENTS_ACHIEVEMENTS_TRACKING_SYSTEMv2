/**
 * SARA Voice Assistant - FIXED VERSION
 * Fixes:
 * 1. Continuous listening (doesn't stop after first command)
 * 2. Commands recognized on first try
 * 3. Email input works ("dot", "at" conversion)
 * 4. Navigation executes immediately (no need to repeat)
 */

class SARAAssistant {
    constructor() {
        this.isListening = false;
        this.isSpeaking = false;
        
        // Initialize Speech APIs
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const SpeechSynthesis = window.speechSynthesis;
        
        if (!SpeechRecognition) {
            console.error('❌ Speech Recognition not supported');
            this.recognition = null;
            return;
        }
        
        this.recognition = new SpeechRecognition();
        this.synthesis = SpeechSynthesis;
        
        // CRITICAL: Enable continuous listening
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        
        // Load preferences
        this.voicePreference = localStorage.getItem('sara-voice') || 'professional_female';
        this.blindMode = localStorage.getItem('sara-blind-mode') === 'true';
        
        this.setupHandlers();
        this.setupKeyboardShortcut();
    }
    
    setupHandlers() {
        this.recognition.onstart = () => {
            console.log('✅ Listening started');
            this.isListening = true;
            this.updateStatus('🎤 Listening...');
        };
        
        this.recognition.onresult = (event) => {
            let interim = '';
            let final = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript.trim();
                
                if (event.results[i].isFinal) {
                    final += transcript + ' ';
                } else {
                    interim += transcript;
                }
            }
            
            if (interim) {
                this.updateStatus(`Hearing: "${interim}"`);
            }
            
            if (final.trim()) {
                console.log('📍 FINAL:', final.trim());
                this.handleCommand(final.trim());
                this.updateStatus('🎤 Listening for next command...');
            }
        };
        
        this.recognition.onerror = (event) => {
            if (event.error !== 'no-speech' && event.error !== 'network') {
                console.error('Error:', event.error);
            }
        };
        
        this.recognition.onend = () => {
            console.log('Recognition ended');
            this.isListening = false;
            
            // Auto-restart if still enabled
            if (this.shouldKeepListening) {
                setTimeout(() => {
                    try {
                        this.recognition.start();
                    } catch (e) {
                        console.log('Restart:', e.message);
                    }
                }, 500);
            }
        };
    }
    
    setupKeyboardShortcut() {
        document.addEventListener('keydown', (e) => {
            if (e.altKey && e.code === 'Space') {
                e.preventDefault();
                this.toggleListening();
            }
        });
    }
    
    handleCommand(text) {
        console.log('🔍 Processing:', text);
        
        const converted = this.convertText(text);
        const lower = converted.toLowerCase();
        
        console.log('✨ Converted:', converted);
        console.log('📝 Lower:', lower);
        
        // Check for action commands
        if (this.isActionCommand(lower)) {
            console.log('✅ ACTION COMMAND DETECTED');
            this.executeAction(lower);
            return;
        }
        
        // Otherwise form input
        console.log('📋 FORM INPUT DETECTED');
        this.fillForm(text);
    }
    
    convertText(text) {
        let result = text;
        
        // EMAIL: "ashwini dot ingole at gmail dot com" → "ashwini.ingole@gmail.com"
        result = result.replace(/\s+dot\s+/gi, '.');
        result = result.replace(/\s+at\s+/gi, '@');
        
        // NUMBERS
        const numMap = {
            'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
            'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9'
        };
        
        for (const [word, num] of Object.entries(numMap)) {
            result = result.replace(new RegExp(`\\b${word}\\b`, 'gi'), num);
        }
        
        return result;
    }
    
    isActionCommand(text) {
        const actions = [
            'login', 'log in', 'sign in', 'signin', 'sign me in', 'log me in',
            'register', 'add achievement', 'add activity',
            'open profile', 'profile', 'portfolio', 'reports', 'notifications',
            'mentor', 'chat', 'dashboard', 'home', 'back', 'go back',
            'dark mode', 'light mode', 'executive', 'submit', 'save',
            'logout', 'exit', 'help', 'stop'
        ];
        
        return actions.some(action => text.includes(action));
    }
    
    executeAction(text) {
        console.log('⚡ EXECUTING:', text);
        
        // LOGIN
        if (this.isLoginCommand(text)) {
            console.log('🔓 Going to login');
            this.speak('Opening login page');
            setTimeout(() => { window.location.href = '/auth/login'; }, 500);
            return;
        }
        
        // REGISTER
        if (text.includes('register')) {
            this.speak('Opening registration');
            setTimeout(() => { window.location.href = '/auth/register'; }, 500);
            return;
        }
        
        // ADD ACHIEVEMENT
        if (text.includes('add achievement')) {
            this.navigate('/student/achievement', 'achievement form');
            return;
        }
        
        // ADD ACTIVITY
        if (text.includes('add activity')) {
            this.navigate('/student/activity', 'activity form');
            return;
        }
        
        // PORTFOLIO
        if (text.includes('portfolio')) {
            this.navigate('/student/portfolio', 'portfolio');
            return;
        }
        
        // REPORTS
        if (text.includes('reports')) {
            this.navigate('/student/reports', 'reports');
            return;
        }
        
        // MENTOR/CHAT
        if (text.includes('mentor') || text.includes('chat')) {
            this.navigate('/student/messages', 'mentor chat');
            return;
        }
        
        // NOTIFICATIONS
        if (text.includes('notifications')) {
            this.navigate('/student/notifications', 'notifications');
            return;
        }
        
        // PROFILE
        if (text.includes('profile')) {
            this.navigate('/student/profile', 'profile');
            return;
        }
        
        // HOME/DASHBOARD
        if (text.includes('home') || text.includes('dashboard')) {
            this.navigate('/student/dashboard', 'dashboard');
            return;
        }
        
        // GO BACK
        if (text.includes('go back') || (text.includes('back') && !text.includes('dark'))) {
            this.speak('Going back');
            window.history.back();
            return;
        }
        
        // DARK MODE
        if (text.includes('dark')) {
            document.body.classList.remove('light-theme', 'executive-theme');
            document.body.classList.add('dark-theme');
            localStorage.setItem('theme', 'dark');
            this.speak('Dark mode enabled');
            return;
        }
        
        // LIGHT MODE
        if (text.includes('light')) {
            document.body.classList.remove('dark-theme', 'executive-theme');
            document.body.classList.add('light-theme');
            localStorage.setItem('theme', 'light');
            this.speak('Light mode enabled');
            return;
        }
        
        // SUBMIT
        if (text.includes('submit')) {
            const btn = document.querySelector('button[type="submit"]');
            if (btn) {
                this.speak('Submitting');
                btn.click();
            }
            return;
        }
        
        // SAVE
        if (text.includes('save')) {
            const btn = document.querySelector('button.save-btn, button[name="save"]');
            if (btn) {
                this.speak('Saving');
                btn.click();
            }
            return;
        }
        
        // LOGOUT
        if (text.includes('logout') || text.includes('exit')) {
            this.speak('Logging out');
            setTimeout(() => { window.location.href = '/auth/logout'; }, 1000);
            return;
        }
        
        // HELP
        if (text.includes('help')) {
            this.showHelp();
            return;
        }
        
        // STOP
        if (text.includes('stop')) {
            this.stopListening();
            return;
        }
    }

    isLoginCommand(text) {
        return /\b(login|log in|logon|log on|sign in|signin|sign me in|log me in|let me in|open login|open sign in|go to login|go to sign in)\b/i.test(text);
    }
    
    navigate(url, name) {
        this.speak(`Opening ${name}`);
        setTimeout(() => { window.location.href = url; }, 500);
    }
    
    fillForm(text) {
        const active = document.activeElement;
        const value = this.valueForField(active, text);
        
        // If input is focused, use it
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
            active.value = value;
            active.dispatchEvent(new Event('input', { bubbles: true }));
            active.dispatchEvent(new Event('change', { bubbles: true }));
            this.speak(`Set to: ${value}`);
            return;
        }
        
        // Find first empty input
        const inputs = document.querySelectorAll(
            'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea'
        );
        
        for (let input of inputs) {
            if (!input.value || input.value.trim() === '') {
                const fieldValue = this.valueForField(input, text);
                input.focus();
                input.value = fieldValue;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                
                const label = input.placeholder || input.name || 'field';
                this.speak(`Filled ${label}`);
                return;
            }
        }
        
        if (inputs.length > 0) {
            const fieldValue = this.valueForField(inputs[0], text);
            inputs[0].focus();
            inputs[0].value = fieldValue;
            inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
            inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
            this.speak(`Updated field`);
        }
    }

    valueForField(field, text) {
        const raw = String(text || '').trim().replace(/\s+/g, ' ');
        if (!field) return raw;
        const fieldName = `${field.type || ''} ${field.name || ''} ${field.id || ''} ${field.placeholder || ''}`;
        if (/email|e-mail/i.test(fieldName)) return this.convertText(raw).toLowerCase().replace(/\s+/g, '');
        if (/otp|code|pin|mobile|phone|number/i.test(fieldName)) return this.convertText(raw).replace(/\D/g, '');
        return raw;
    }
    
    speak(text) {
        if (!this.synthesis) return;
        
        if (this.isSpeaking) {
            this.synthesis.cancel();
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        
        const settings = {
            'professional_female': { rate: 1.0, pitch: 1.2 },
            'professional_male': { rate: 1.0, pitch: 0.8 },
            'warm_assistant': { rate: 0.95, pitch: 1.0 },
            'accessibility': { rate: 0.8, pitch: 1.0 }
        }[this.voicePreference] || { rate: 1.0, pitch: 1.0 };
        
        utterance.rate = settings.rate;
        utterance.pitch = settings.pitch;
        utterance.lang = 'en-US';
        
        utterance.onstart = () => { this.isSpeaking = true; };
        utterance.onend = () => { this.isSpeaking = false; };
        
        this.synthesis.speak(utterance);
    }
    
    toggleListening() {
        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }
    
    startListening() {
        if (!this.recognition) {
            alert('Speech not supported. Use Chrome, Edge, Safari, or Firefox.');
            return;
        }
        
        try {
            console.log('🎤 Starting');
            this.shouldKeepListening = true;
            if (this.isSpeaking) {
                this.synthesis.cancel();
            }
            this.recognition.start();
            this.updateStatus('🎤 Listening... (Say "login" or your email)');
        } catch (e) {
            console.error('Start error:', e);
        }
    }
    
    stopListening() {
        console.log('🛑 Stopping');
        this.shouldKeepListening = false;
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
        this.updateStatus('🎤 Stopped');
    }
    
    updateStatus(message) {
        const status = document.getElementById('sara-status');
        if (status) {
            status.textContent = message;
            status.style.display = 'block';
        }
        console.log('[SARA]', message);
    }
    
    showHelp() {
        const help = `SARA Voice Commands:

LOGIN: "login" or "register"

NAVIGATION:
- "Add Achievement"
- "Add Activity"
- "Open Profile"
- "Portfolio"
- "Reports"
- "Mentor" or "Chat"
- "Notifications"
- "Go Home"
- "Go Back"

FORMS:
- Say email: "ashwini dot ingole at gmail dot com"
- Or any text to fill fields

THEMES:
- "Dark Mode"
- "Light Mode"

ACTIONS:
- "Submit"
- "Save"
- "Logout"`;
        
        alert(help);
    }
}

// Initialize
let sara = null;

document.addEventListener('DOMContentLoaded', () => {
    sara = new SARAAssistant();
    console.log('✅ SARA Voice Ready');
});

// Global functions for widget
window.toggleSARA = () => sara && sara.toggleListening();
window.changeSARAVoice = (voice) => {
    localStorage.setItem('sara-voice', voice);
    if (sara) sara.voicePreference = voice;
};
window.toggleBlindMode = () => {
    const current = localStorage.getItem('sara-blind-mode') === 'true';
    localStorage.setItem('sara-blind-mode', !current);
    if (sara) sara.blindMode = !current;
};
