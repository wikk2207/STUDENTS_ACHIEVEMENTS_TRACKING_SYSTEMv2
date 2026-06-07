"""
SARA - Student Achievement Response Assistant
Voice Assistant Service for SAAMS (Works with manual & voice commands)
Allows blind students to complete entire workflow without keyboard/mouse
"""

from datetime import datetime
from app import db


class VoiceSession(db.Model):
    """Track voice assistant sessions"""
    __tablename__ = 'voice_sessions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    session_started = db.Column(db.DateTime, default=datetime.utcnow)
    session_ended = db.Column(db.DateTime)
    total_commands = db.Column(db.Integer, default=0)
    voice_preference = db.Column(db.String(50), default='professional_female')
    blind_mode_enabled = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class SARAVoiceAssistant:
    """
    SARA: Student Achievement Response Assistant
    
    Features:
    - Voice navigation without keyboard/mouse
    - 4 voice options (professional female, professional male, warm, accessibility)
    - Blind student mode with auto-announcements
    - Smart context awareness
    - Voice confirmation for critical actions
    - Session memory
    """
    
    VOICE_OPTIONS = {
        'professional_female': {'name': 'Professional Female', 'speed': 1.0},
        'professional_male': {'name': 'Professional Male', 'speed': 1.0},
        'warm_assistant': {'name': 'Warm Assistant', 'speed': 1.0},
        'accessibility': {'name': 'Accessibility Voice', 'speed': 0.8}
    }
    
    WELCOME_MESSAGES = {
        'startup': "Welcome to SAMS. Would you like to login or register?",
        'login_email': "Please tell me your email address.",
        'login_otp': "OTP has been sent. Please tell me your OTP.",
        'dashboard': "Welcome {name}. You currently have {approved} approved achievements, {pending} pending achievements, and {notifications} new notifications.",
        'blind_mode': "Blind Mode enabled. I will automatically announce available options and important messages.",
    }
    
    COMMAND_RESPONSES = {
        'add_achievement': "Opening Achievement Form. Please tell me the achievement title.",
        'add_activity': "Opening Activity Form. Please tell me the activity name.",
        'open_profile': "Opening your profile.",
        'open_portfolio': "Opening your portfolio.",
        'open_reports': "Opening your reports.",
        'open_mentor_chat': "Opening Mentor Chat. What is the subject?",
        'read_notifications': "Reading your notifications.",
        'logout': "Logging out.",
        'help': "Available commands: Add Achievement, Add Activity, Open Profile, Open Portfolio, Read Notifications, Mentor Chat, Open Reports, Change Theme, Help, and Logout.",
    }
    
    CONFIRMATIONS = {
        'save_achievement': "I heard: {value}. Should I save this?",
        'submit_achievement': "Achievement details recorded. Would you like to upload a certificate?",
        'send_message': "Would you like to send this message to your mentor?",
        'confirm_action': "Should I confirm this action?"
    }
    
    ANNOUNCEMENTS = {
        'page_changed': "You are now on the {page} page.",
        'option_available': "Option: {option}",
        'error': "Error: {message}",
        'success': "Success! {message}",
        'notification': "New notification: {message}",
        'file_selected': "File selected: {filename}",
    }
    
    @staticmethod
    def text_to_speech(text, voice_preference='professional_female', speed=1.0):
        """
        Convert text to speech (frontend handles actual TTS)
        Returns speech instruction for JavaScript
        """
        return {
            'type': 'speak',
            'text': text,
            'voice': voice_preference,
            'speed': speed,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def listen_for_command(timeout=10):
        """
        Listen for voice command (frontend handles actual recording)
        Returns listening instruction for JavaScript
        """
        return {
            'type': 'listen',
            'timeout': timeout,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def process_voice_input(transcribed_text, context='general'):
        """
        Process transcribed voice input
        Converts spoken words to actions
        """
        text = transcribed_text.lower().strip()
        
        # Email conversion: "ashwini dot ingole at gmail dot com" -> "ashwini.ingole@gmail.com"
        if 'dot' in text and 'at' in text:
            text = text.replace(' dot ', '.').replace(' at ', '@')
        
        # Number recognition
        number_words = {
            'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
            'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9'
        }
        for word, digit in number_words.items():
            text = text.replace(word, digit)
        
        return {
            'original': transcribed_text,
            'processed': text,
            'context': context,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def get_dashboard_summary(user):
        """Get summary for dashboard greeting"""
        from app.models import Achievement, Notification
        
        approved = Achievement.query.filter_by(
            student_id=user.id,
            status='Approved'
        ).count()
        
        pending = Achievement.query.filter_by(
            student_id=user.id,
            status='Draft'
        ).count()
        
        notifications = Notification.query.filter_by(
            user_id=user.id,
            is_read=False
        ).count()
        
        return {
            'name': user.full_name.split()[0],  # First name
            'approved': approved,
            'pending': pending,
            'notifications': notifications
        }
    
    @staticmethod
    def get_voice_response(command, user=None, context=None):
        """Get voice response for any command"""
        command = command.lower().strip()
        
        responses = {
            'who are you': "I am SARA, your Student Achievement Response Assistant. I help you manage your achievements and activities without using keyboard or mouse.",
            'good morning': "Good morning! I hope your day is going well. What would you like to do in SAMS today?",
            'hello': "Hello! How can I help you today?",
            'thank you': "You're welcome! If you need help with achievements, activities, reports, or mentor communication, I'm here to assist.",
            'how are you': "I'm doing well and ready to help you manage your achievements and activities. How may I assist you today?",
            'stop': "Listening stopped.",
            'repeat': "Please wait while I repeat the previous message.",
            'help': SARAVoiceAssistant.COMMAND_RESPONSES.get('help', ''),
            'speak slower': "Adjusting speech speed to slower.",
            'speak faster': "Adjusting speech speed to faster.",
            'enable dark mode': "Switching to dark mode.",
            'enable light mode': "Switching to light mode.",
        }
        
        # Check exact matches first
        if command in responses:
            return responses[command]
        
        # Check for command keywords
        for key, response in SARAVoiceAssistant.COMMAND_RESPONSES.items():
            if any(word in command for word in key.split('_')):
                return response
        
        return "I didn't quite understand. Could you please repeat that?"
    
    @staticmethod
    def get_context_announcement(page_name, blind_mode=False):
        """Get announcement when page changes (for blind mode)"""
        if not blind_mode:
            return None
        
        page_announcements = {
            'dashboard': "You are currently on the Dashboard. Available options are: Add Achievement, Add Activity, Profile, Portfolio, Reports, Mentor Chat, Notifications, Settings, and Logout.",
            'achievement': "You are on the Achievement form. Available fields are: Title, Category, Level, Organizer, Event Date, Position, and Description.",
            'activity': "You are on the Activity form. Available fields are: Activity Name, Activity Type, Role, Date, Duration, Organizer, and Description.",
            'profile': "You are on your Profile page. You can view or edit your name, email, phone, department, and role.",
            'portfolio': "You are on your Portfolio page. This shows all your achievements and activities.",
            'reports': "You are on the Reports page. You can view and download your achievement report.",
            'mentor_chat': "You are on Mentor Chat. You can send messages to your mentor and read their replies.",
            'notifications': "You are on Notifications. This shows all your recent updates and mentor messages.",
        }
        
        return page_announcements.get(page_name, f"You are currently on the {page_name} page.")
    
    @staticmethod
    def get_command_options(page_name='dashboard'):
        """Get available voice commands for current page"""
        options = {
            'dashboard': [
                'Add Achievement',
                'Add Activity',
                'Open Profile',
                'Open Portfolio',
                'Open Reports',
                'Open Mentor Chat',
                'Read Notifications',
                'Change Theme',
                'Enable Dark Mode',
                'Enable Light Mode',
                'Help',
                'Logout'
            ],
            'achievement_form': [
                'Submit Achievement',
                'Upload Certificate',
                'Save Draft',
                'Go Back',
                'Help'
            ],
            'mentor_chat': [
                'Send Message',
                'Attach File',
                'Read Latest Reply',
                'Go Back',
                'Help'
            ],
            'notifications': [
                'Read All Notifications',
                'Read Latest Notification',
                'Go Back',
                'Help'
            ]
        }
        
        return options.get(page_name, options['dashboard'])


class VoiceCommandHandler:
    """Handle voice commands and convert to actions"""
    
    @staticmethod
    def parse_command(user_input, user_context=None):
        """Parse user voice input into actionable command"""
        text = user_input.lower().strip()
        
        # Navigation commands
        nav_commands = {
            'add achievement': {'action': 'navigate', 'target': '/student/achievement'},
            'add activity': {'action': 'navigate', 'target': '/student/activity'},
            'open profile': {'action': 'navigate', 'target': '/student/profile'},
            'view profile': {'action': 'navigate', 'target': '/student/profile'},
            'open portfolio': {'action': 'navigate', 'target': '/student/portfolio'},
            'view portfolio': {'action': 'navigate', 'target': '/student/portfolio'},
            'open reports': {'action': 'navigate', 'target': '/student/reports'},
            'view reports': {'action': 'navigate', 'target': '/student/reports'},
            'mentor chat': {'action': 'navigate', 'target': '/student/messages'},
            'open mentor chat': {'action': 'navigate', 'target': '/student/messages'},
            'read notifications': {'action': 'navigate', 'target': '/student/notifications'},
            'notifications': {'action': 'navigate', 'target': '/student/notifications'},
            'open dashboard': {'action': 'navigate', 'target': '/student/dashboard'},
            'go home': {'action': 'navigate', 'target': '/student/dashboard'},
            'go back': {'action': 'navigate', 'target': 'back'},
        }
        
        # Theme commands
        theme_commands = {
            'dark mode': {'action': 'set_theme', 'theme': 'dark'},
            'enable dark mode': {'action': 'set_theme', 'theme': 'dark'},
            'light mode': {'action': 'set_theme', 'theme': 'light'},
            'enable light mode': {'action': 'set_theme', 'theme': 'light'},
            'executive theme': {'action': 'set_theme', 'theme': 'executive'},
            'enable executive theme': {'action': 'set_theme', 'theme': 'executive'},
        }
        
        # Action commands
        action_commands = {
            'logout': {'action': 'logout'},
            'submit': {'action': 'submit_form'},
            'save': {'action': 'save_form'},
            'cancel': {'action': 'cancel_form'},
            'help': {'action': 'show_help'},
            'stop': {'action': 'stop_listening'},
        }
        
        # Check all command types
        for cmd_text, cmd_action in nav_commands.items():
            if cmd_text in text:
                return cmd_action
        
        for cmd_text, cmd_action in theme_commands.items():
            if cmd_text in text:
                return cmd_action
        
        for cmd_text, cmd_action in action_commands.items():
            if cmd_text in text:
                return cmd_action
        
        # If no exact match, return as text input for form fields
        return {
            'action': 'form_input',
            'text': user_input,
            'confidence': 0.85
        }


def create_voice_instructions(action_type, **kwargs):
    """Create instructions for frontend JavaScript to execute"""
    instructions = {
        'speak': {
            'type': 'speak',
            'text': kwargs.get('text', ''),
            'voice': kwargs.get('voice', 'professional_female'),
            'speed': kwargs.get('speed', 1.0)
        },
        'listen': {
            'type': 'listen',
            'timeout': kwargs.get('timeout', 10),
            'max_silence': kwargs.get('max_silence', 2)
        },
        'navigate': {
            'type': 'navigate',
            'url': kwargs.get('url', '/')
        },
        'click': {
            'type': 'click',
            'selector': kwargs.get('selector', '')
        },
        'fill_form': {
            'type': 'fill_form',
            'field': kwargs.get('field', ''),
            'value': kwargs.get('value', '')
        },
        'read_page': {
            'type': 'read_page',
            'elements': kwargs.get('elements', [])
        },
        'confirm': {
            'type': 'confirm',
            'message': kwargs.get('message', 'Is this correct?')
        }
    }
    
    return instructions.get(action_type, {'type': 'unknown'})
