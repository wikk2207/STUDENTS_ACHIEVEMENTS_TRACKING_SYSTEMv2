"""
SARA Voice Assistant API Routes
Provides backend support for voice commands and settings
"""

from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user

from app import db
from app.services.sara_voice import SARAVoiceAssistant, VoiceCommandHandler, VoiceSession

bp = Blueprint('sara', __name__, url_prefix='/api/sara')


@bp.route('/start-session', methods=['POST'])
@login_required
def start_voice_session():
    """Start a new voice session"""
    data = request.get_json()
    
    session = VoiceSession(
        user_id=current_user.id,
        voice_preference=data.get('voice_preference', 'professional_female'),
        blind_mode_enabled=data.get('blind_mode', False)
    )
    
    db.session.add(session)
    db.session.commit()
    
    return jsonify({
        'status': 'success',
        'session_id': session.id,
        'message': 'Voice session started'
    })


@bp.route('/end-session/<int:session_id>', methods=['POST'])
@login_required
def end_voice_session(session_id):
    """End current voice session"""
    session = VoiceSession.query.filter_by(
        id=session_id,
        user_id=current_user.id
    ).first_or_404()
    
    session.session_ended = datetime.utcnow()
    db.session.commit()
    
    return jsonify({
        'status': 'success',
        'message': 'Voice session ended',
        'total_commands': session.total_commands
    })


@bp.route('/process-command', methods=['POST'])
@login_required
def process_voice_command():
    """Process transcribed voice command"""
    data = request.get_json()
    transcript = data.get('transcript', '')
    context = data.get('context', 'general')
    
    # Process the voice input
    processed = SARAVoiceAssistant.process_voice_input(transcript, context)
    
    # Parse into command
    command = VoiceCommandHandler.parse_command(transcript, {'user_id': current_user.id})
    
    # Get response
    response_text = SARAVoiceAssistant.get_voice_response(
        transcript,
        user=current_user,
        context=context
    )
    
    # Log command
    if data.get('session_id'):
        session = VoiceSession.query.get(data.get('session_id'))
        if session:
            session.total_commands += 1
            db.session.commit()
    
    return jsonify({
        'status': 'success',
        'original': transcript,
        'processed': processed['processed'],
        'command': command,
        'response': response_text,
        'confidence': 85
    })


@bp.route('/get-dashboard-summary', methods=['GET'])
@login_required
def get_dashboard_summary():
    """Get dashboard summary for greeting"""
    summary = SARAVoiceAssistant.get_dashboard_summary(current_user)
    
    greeting = SARAVoiceAssistant.WELCOME_MESSAGES['dashboard'].format(
        name=summary['name'],
        approved=summary['approved'],
        pending=summary['pending'],
        notifications=summary['notifications']
    )
    
    return jsonify({
        'status': 'success',
        'summary': summary,
        'greeting': greeting,
        'available_commands': SARAVoiceAssistant.get_command_options('dashboard')
    })


@bp.route('/announce-page/<page_name>', methods=['GET'])
@login_required
def announce_page(page_name):
    """Get announcement for page (for blind mode)"""
    blind_mode = request.args.get('blind_mode', 'false') == 'true'
    
    announcement = SARAVoiceAssistant.get_context_announcement(page_name, blind_mode)
    commands = SARAVoiceAssistant.get_command_options(page_name)
    
    return jsonify({
        'status': 'success',
        'page': page_name,
        'announcement': announcement,
        'available_commands': commands
    })


@bp.route('/get-commands/<page_name>', methods=['GET'])
@login_required
def get_page_commands(page_name):
    """Get available voice commands for a page"""
    commands = SARAVoiceAssistant.get_command_options(page_name)
    
    return jsonify({
        'status': 'success',
        'page': page_name,
        'commands': commands
    })


@bp.route('/set-voice-preference', methods=['POST'])
@login_required
def set_voice_preference():
    """Set user's voice preference"""
    data = request.get_json()
    preference = data.get('preference')
    
    if preference not in SARAVoiceAssistant.VOICE_OPTIONS:
        return jsonify({'status': 'error', 'message': 'Invalid voice preference'}), 400
    
    # Store in user preferences (if you add a preferences column)
    # For now, it's stored in localStorage on frontend
    
    return jsonify({
        'status': 'success',
        'voice_preference': preference,
        'message': f'Voice set to {SARAVoiceAssistant.VOICE_OPTIONS[preference]["name"]}'
    })


@bp.route('/get-help', methods=['GET'])
@login_required
def get_voice_help():
    """Get voice command help"""
    return jsonify({
        'status': 'success',
        'welcome_message': SARAVoiceAssistant.WELCOME_MESSAGES['help'],
        'command_responses': SARAVoiceAssistant.COMMAND_RESPONSES,
        'confirmations': SARAVoiceAssistant.CONFIRMATIONS,
        'announcements': SARAVoiceAssistant.ANNOUNCEMENTS,
        'available_voices': SARAVoiceAssistant.VOICE_OPTIONS
    })


@bp.route('/test-speech', methods=['POST'])
@login_required
def test_speech():
    """Test speech synthesis"""
    data = request.get_json()
    text = data.get('text', 'Hello, this is a test.')
    voice = data.get('voice', 'professional_female')
    
    instruction = SARAVoiceAssistant.text_to_speech(text, voice)
    
    return jsonify({
        'status': 'success',
        'instruction': instruction,
        'message': f'Testing voice: {voice}'
    })


@bp.route('/get-notifications', methods=['GET'])
@login_required
def get_notifications_for_voice():
    """Get notifications in voice-friendly format"""
    from app.models import Notification
    
    notifications = Notification.query.filter_by(
        user_id=current_user.id,
        is_read=False
    ).order_by(Notification.created_at.desc()).limit(5).all()
    
    notification_text = f"You have {len(notifications)} notifications. "
    
    for i, notif in enumerate(notifications, 1):
        notification_text += f"Notification {i}: {notif.message}. "
    
    return jsonify({
        'status': 'success',
        'count': len(notifications),
        'notifications': [
            {
                'id': n.id,
                'title': n.title,
                'message': n.message,
                'created_at': n.created_at.isoformat()
            }
            for n in notifications
        ],
        'voice_text': notification_text
    })


@bp.route('/read-achievement-summary', methods=['GET'])
@login_required
def read_achievement_summary():
    """Get achievement summary for voice reading"""
    from app.models import Achievement
    
    total = Achievement.query.filter_by(student_id=current_user.id).count()
    approved = Achievement.query.filter_by(student_id=current_user.id, status='Approved').count()
    pending = Achievement.query.filter_by(student_id=current_user.id, status='Draft').count()
    rejected = Achievement.query.filter_by(student_id=current_user.id, status='Rejected').count()
    
    summary_text = f"You have uploaded {total} achievements. {approved} are approved. {pending} are pending review. {rejected} were rejected."
    
    return jsonify({
        'status': 'success',
        'total': total,
        'approved': approved,
        'pending': pending,
        'rejected': rejected,
        'trust_score': (approved * 5) / max(1, total) * 20,  # Simple calculation
        'voice_text': summary_text
    })


@bp.route('/read-portfolio', methods=['GET'])
@login_required
def read_portfolio_voice():
    """Read entire portfolio for voice assistant"""
    from app.models import Achievement, Activity
    
    achievements = Achievement.query.filter_by(student_id=current_user.id).all()
    activities = Activity.query.filter_by(student_id=current_user.id).all()
    
    portfolio_text = f"Your portfolio contains {len(achievements)} achievements and {len(activities)} activities. "
    
    # Read achievements
    if achievements:
        portfolio_text += "Your achievements are: "
        for ach in achievements[:5]:  # Read first 5
            portfolio_text += f"{ach.title} in {ach.category}, status {ach.status}. "
    
    # Read activities
    if activities:
        portfolio_text += "Your activities include: "
        for act in activities[:5]:  # Read first 5
            portfolio_text += f"{act.activity_name}, type {act.activity_type}, status {act.status}. "
    
    return jsonify({
        'status': 'success',
        'achievements_count': len(achievements),
        'activities_count': len(activities),
        'voice_text': portfolio_text
    })


@bp.route('/sessions', methods=['GET'])
@login_required
def get_voice_sessions():
    """Get user's voice sessions"""
    sessions = VoiceSession.query.filter_by(user_id=current_user.id).order_by(
        VoiceSession.created_at.desc()
    ).limit(10).all()
    
    return jsonify({
        'status': 'success',
        'sessions': [
            {
                'id': s.id,
                'started': s.session_started.isoformat(),
                'ended': s.session_ended.isoformat() if s.session_ended else None,
                'total_commands': s.total_commands,
                'voice_preference': s.voice_preference,
                'blind_mode': s.blind_mode_enabled
            }
            for s in sessions
        ]
    })
