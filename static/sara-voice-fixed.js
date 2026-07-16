/**
 * SARA - Skill Connect Response Assistant (FIXED VERSION)
 * Frontend Voice Handler - Improved for continuous listening
 * 
 * Key fixes:
 * - Continuous listening (doesn't stop after first phrase)
 * - Better email/form input handling
 * - Improved text processing
 * - Auto-restarts listening after command
 */

class SARAVoiceAssistant {
    constructor(options = {}) {
        this.voicePreference = options.voicePreference || 'professional_female';
        this.blindMode = options.blindMode || false;
        this.isListening = false;
        this.isSpeaking = false;
        
        // Initialize Speech APIs
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error('Speech Recognition not supported');
            return;
        }
        
        this.recognition = new SpeechRecognition();
        this.synthesis = window.speechSynthesis;
        
        // Configure recognition
        this.recognition.continuous = true;      // Keep listening
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        
        // Voice settings
        this.voiceSettings = {
            'professional_female': { rate: 1.0, pitch: 1.2, lang: 'en-US' },
            'professional_male': { rate: 1.0, pitch: 0.8, lang: 'en-US' },
            'warm_assistant': { rate: 0.95, pitch: 1.0, lang: 'en-US' },
            'accessibility': { rate: 0.8, pitch: 1.0, lang: 'en-US' }
        };
        
        this.setupRecognitionHandlers();
    }
    
    setupRecognitionHandlers() {
        this.recognition.onstart = () => {
            console.log('🎤 Listening started');
            this.isListening = true;
            this.updateUI('🎤 Listening...');
        };
        
        this.recognition.onresult = (event) => {
            let interim = '';
            let final = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                
                if (event.results[i].isFinal) {
                    final += transcript + ' ';
                } else {
                    interim += transcript;
                }
            }
            
            // Show what we're hearing
            if (interim) {
                this.updateUI(`Hearing: "${interim}"`);
            }
            
            // Process final transcript
            if (final.trim()) {
                console.log('Final:', final);
                this.processCommand(final.trim());
            }
        };
        
        this.recognition.onerror = (event) => {
            console.error('Recognition error:', event.error);
            if (event.error !== 'no-speech') {
                this.speak(`Error: ${event.error}`);
            }
        };
        
        this.recognition.onend = () => {
            console.log('Recognition ended');
            this.isListening = false;
            // Auto-restart if still wanted
            if (this.wantsContinuousListening) {
                setTimeout(() => this.startListening(), 1000);
            }
        };
    }
    
    startListening() {
        if (!this.recognition) {
            alert('Voice not supported. Use Chrome, Edge, or Safari.');
            return;
        }
        
        try {
            if (this.isSpeaking) {
                this.synthesis.cancel();
            }
            
            this.wantsContinuousListening = true;
            this.recognition.start();
            this.updateUI('🎤 Listening... (Say email as: "ashwini dot ingole at gmail dot com")');
            
        } catch (e) {
            console.error('Start error:', e);
        }
    }
    
    stopListening() {
        this.wantsContinuousListening = false;
        if (this.recognition && this.isListening) {
            this.recognition.stop();
            this.updateUI('🎤 Stopped');
        }
    }
    
    processCommand(text) {
        console.log('Processing:', text);
        const processed = this.parseText(text);
        
        // Check if it's a form field fill (email, text, etc)
        if (!this.isNavigationCommand(processed.lower)) {
            this.fillFormField(processed.original);
            return;
        }
        
        // Handle navigation/action commands
        this.executeCommand(processed);
    }
    
    parseText(text) {
        const lower = text.toLowerCase().trim();
        
        let converted = text;
        // Convert "dot" to "." and "at" to "@"
        converted = converted.replace(/\s+dot\s+/gi, '.');
        converted = converted.replace(/\s+at\s+/gi, '@');
        
        // Convert number words
        const nums = {
            'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
            'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9'
        };
        
        for (const [word, digit] of Object.entries(nums)) {
            converted = converted.replace(new RegExp(`\\b${word}\\b`, 'gi'), digit);
        }
        
        return { original: converted, lower };
    }
    
    isNavigationCommand(text) {
        const navCommands = [
            'add achievement', 'add activity', 'open profile', 'view profile',
            'portfolio', 'reports', 'mentor', 'notifications', 'dashboard',
            'go home', 'go back', 'dark mode', 'light mode', 'executive',
            'logout', 'submit', 'save', 'help', 'stop'
        ];
        
        return navCommands.some(cmd => text.includes(cmd));
    }
    
    fillFormField(text) {
        const active = document.activeElement;
        
        // If input is focused, use it
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
            active.value = text;
            active.dispatchEvent(new Event('input', { bubbles: true }));
            active.dispatchEvent(new Event('change', { bubbles: true }));
            active.dispatchEvent(new Event('blur', { bubbles: true }));
            
            console.log('Filled focused field with:', text);
            this.speak(`Set field to: ${text}`);
            return;
        }
        
        // Find first empty input field
        const allInputs = document.querySelectorAll(
            'input[type="text"], input[type="email"], input[type="password"], ' +
            'input[type="number"], textarea, input[type="date"], input[type="url"]'
        );
        
        for (let input of allInputs) {
            if (!input.value || input.value.trim() === '') {
                input.focus();
                input.value = text;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                
                console.log('Auto-filled first empty field with:', text);
                this.speak(`Filled: ${text}`);
                return;
            }
        }
        
        this.speak('No empty input field found.');
    }
    
    executeCommand(cmd) {
        const text = cmd.lower;
        
        // Navigation
        if (text.includes('add achievement')) {
            this.navigate('/student/achievement');
            return;
        }
        if (text.includes('add activity')) {
            this.navigate('/student/activity');
            return;
        }
        if (text.includes('portfolio')) {
            this.navigate('/student/portfolio');
            return;
        }
        if (text.includes('reports')) {
            this.navigate('/student/reports');
            return;
        }
        if (text.includes('mentor') || text.includes('chat')) {
            this.navigate('/student/messages');
            return;
        }
        if (text.includes('notifications')) {
            this.navigate('/student/notifications');
            return;
        }
        if (text.includes('profile')) {
            this.navigate('/student/profile');
            return;
        }
        if (text.includes('go home') || text.includes('dashboard')) {
            this.navigate('/student/dashboard');
            return;
        }
        if (text.includes('go back')) {
            window.history.back();
            this.speak('Going back');
            return;
        }
        
        // Theme
        if (text.includes('dark')) {
            document.body.classList.remove('light-theme', 'executive-theme');
            document.body.classList.add('dark-theme');
            localStorage.setItem('theme', 'dark');
            this.speak('Dark mode enabled');
            return;
        }
        if (text.includes('light')) {
            document.body.classList.remove('dark-theme', 'executive-theme');
            document.body.classList.add('light-theme');
            localStorage.setItem('theme', 'light');
            this.speak('Light mode enabled');
            return;
        }
        
        // Actions
        if (text.includes('submit')) {
            const btn = document.querySelector('button[type="submit"]');
            if (btn) {
                this.speak('Submitting');
                btn.click();
            }
            return;
        }
        if (text.includes('save')) {
            const btn = document.querySelector('button.save-btn, button[name="save"]');
            if (btn) {
                this.speak('Saving');
                btn.click();
            }
            return;
        }
        if (text.includes('logout')) {
            this.speak('Logging out');
            setTimeout(() => { window.location.href = '/auth/logout'; }, 1500);
            return;
        }
        if (text.includes('stop')) {
            this.stopListening();
            return;
        }
        if (text.includes('help')) {
            this.showHelp();
            return;
        }
    }
    
    navigate(url) {
        const page = url.split('/').pop();
        this.speak(`Opening ${page}`);
        setTimeout(() => { window.location.href = url; }, 1500);
    }
    
    speak(text) {
        if (this.isSpeaking) {
            this.synthesis.cancel();
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        const settings = this.voiceSettings[this.voicePreference] || this.voiceSettings.professional_female;
        
        utterance.rate = settings.rate;
        utterance.pitch = settings.pitch;
        utterance.lang = settings.lang;
        
        // Try to use voices
        const voices = this.synthesis.getVoices();
        if (voices.length > 0) {
            utterance.voice = voices[0];
        }
        
        utterance.onstart = () => {
            this.isSpeaking = true;
            this.updateUI(`Speaking: "${text.substring(0, 60)}..."`);
        };
        
        utterance.onend = () => {
            this.isSpeaking = false;
            this.updateUI('🎤 Listening...');
        };
        
        this.synthesis.speak(utterance);
    }
    
    updateUI(message) {
        const status = document.getElementById('sara-status');
        if (status) {
            status.textContent = message;
            status.style.color = '#2196F3';
            status.style.fontWeight = 'bold';
        }
        console.log('[SARA]', message);
    }
    
    showHelp() {
        const commands = `
Say any of these:
Add Achievement
Add Activity
Open Profile
Open Portfolio
Read Notifications
Mentor Chat
Open Reports
Go Home
Go Back
Enable Dark Mode
Enable Light Mode
Submit
Save
Help
Logout
Or just speak your text!
        `;
        
        this.speak('Here are your voice commands: ' + commands.replace(/\n/g, ' '));
        alert(commands);
    }
}

// Global instance
let saraVoice = null;

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    saraVoice = new SARAVoiceAssistant();
    console.log('✅ SARA Voice Assistant Ready');
});
