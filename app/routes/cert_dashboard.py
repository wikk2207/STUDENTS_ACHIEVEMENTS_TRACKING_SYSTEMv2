"""
Certificate Verification Dashboard API
Shows mentor verification results with 20-level scanning
"""

from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from app import db
from app.models import Certificate, Achievement, User
from app.services.cert_verification import CertificateScanner

bp = Blueprint('cert_dashboard', __name__, url_prefix='/api/cert-verify')


def mentor_required(f):
    """Check if user is mentor"""
    from functools import wraps
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if not current_user.is_mentor:
            return jsonify({'error': 'Mentor access required'}), 403
        return f(*args, **kwargs)
    return decorated


@bp.route('/pending', methods=['GET'])
@mentor_required
def get_pending_certificates():
    """Get all pending certificates for verification"""
    certs = Certificate.query.filter_by(verification_status='Pending').all()

    results = []
    for cert in certs:
        scanner = CertificateScanner(cert)
        results.append({
            'id': cert.id,
            'file_name': cert.file_name,
            'uploaded_at': cert.uploaded_at.isoformat() if cert.uploaded_at else None,
            'student_name': cert.detected_name,
            'event_name': cert.detected_event,
            'status': cert.verification_status
        })

    return jsonify({
        'total': len(results),
        'pending': results
    })


@bp.route('/scan/<int:cert_id>', methods=['POST'])
@mentor_required
def scan_certificate(cert_id):
    """Run full 20-level scan on certificate"""
    cert = Certificate.query.get_or_404(cert_id)

    # Run scanner
    scanner = CertificateScanner(cert)
    report = scanner.run_full_scan()

    return jsonify(report)


@bp.route('/dashboard/<int:cert_id>', methods=['GET'])
@mentor_required
def verification_dashboard(cert_id):
    """Mentor verification dashboard with all details"""
    cert = Certificate.query.get_or_404(cert_id)

    # Get achievement/activity
    achievement = Achievement.query.get(cert.achievement_id) if cert.achievement_id else None
    student = User.query.get(achievement.student_id) if achievement else None

    # Run full scan
    scanner = CertificateScanner(cert)
    full_report = scanner.run_full_scan()

    # Dashboard data
    dashboard = {
        'certificate': {
            'id': cert.id,
            'file_name': cert.file_name,
            'uploaded_at': cert.uploaded_at.isoformat() if cert.uploaded_at else None,
        },
        'student': {
            'id': student.id if student else None,
            'name': student.full_name if student else 'Unknown',
            'email': student.email if student else 'N/A',
            'roll_number': student.roll_number if student else 'N/A',
            'department': student.department if student else 'N/A',
        },
        'achievement': {
            'title': achievement.title if achievement else 'N/A',
            'category': achievement.category if achievement else 'N/A',
            'status': achievement.status if achievement else 'N/A',
        },
        'verification': {
            # Level 1: OCR
            'ocr_extracted': full_report['all_levels']['level_1_ocr'],

            # Level 2: Identity
            'identity_match': full_report['all_levels']['level_2_identity'],

            # Level 3: Fuzzy
            'fuzzy_match': full_report['all_levels']['level_3_fuzzy_match'],

            # Level 4: Event
            'event_validation': full_report['all_levels']['level_4_event'],

            # Level 5: Cert ID
            'certificate_id': full_report['all_levels']['level_5_cert_id'],

            # Level 6: QR
            'qr_code': full_report['all_levels']['level_6_qr_code'],

            # Level 7: Duplicates
            'duplicates': full_report['all_levels']['level_7_duplicate'],

            # Level 8: Template
            'template': full_report['all_levels']['level_8_template'],

            # Level 9: Signature
            'signature': full_report['all_levels']['level_9_signature'],

            # Level 10: Seal
            'seal_logo': full_report['all_levels']['level_10_seal'],

            # Level 11: Date
            'date_validation': full_report['all_levels']['level_11_date'],

            # Level 12: Consistency
            'achievement_consistency': full_report['all_levels']['level_12_consistency'],

            # Level 13: Manipulation
            'image_manipulation': full_report['all_levels']['level_13_manipulation'],

            # Level 14: Font
            'font_consistency': full_report['all_levels']['level_14_font'],

            # Level 15: Metadata
            'metadata': full_report['all_levels']['level_15_metadata'],

            # Level 16: AI Score
            'ai_risk_score': full_report['all_levels']['level_16_ai_risk'],

            # Level 17: Recommendation
            'recommendation': full_report['all_levels']['level_17_recommendation'],

            # Level 18: Timeline
            'timeline': full_report['all_levels']['level_18_timeline'],

            # Level 19: Approval Chain
            'approval_chain': full_report['all_levels']['level_19_approval'],

            # Level 20: Trust
            'trust_score': full_report['all_levels']['level_20_trust'],
        },
        'final_recommendation': {
            'ai_score': full_report['final_score'],
            'recommendation': full_report['recommendation'],
            'trust_score': full_report['trust_score'],
            'status': full_report['all_levels'].get('level_16_ai_risk', {}).get('status', 'PENDING'),
            'mentor_action': full_report['all_levels'].get('level_17_recommendation', {}).get('action_required', 'MANUAL_REVIEW'),
            'mentor_notes': full_report['all_levels'].get('level_17_recommendation', {}).get('mentor_notes', ''),
        }
    }

    return jsonify(dashboard)


@bp.route('/summary', methods=['GET'])
@mentor_required
def verification_summary():
    """Get summary of all certificates with verification status"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)

    certs = Certificate.query.paginate(page=page, per_page=per_page)

    results = []
    for cert in certs.items:
        scanner = CertificateScanner(cert)
        report = scanner.run_full_scan()

        results.append({
            'id': cert.id,
            'file_name': cert.file_name,
            'student_name': cert.detected_name,
            'event_name': cert.detected_event,
            'status': cert.verification_status,
            'ai_score': report['final_score'],
            'recommendation': report['recommendation'],
            'uploaded_at': cert.uploaded_at.isoformat() if cert.uploaded_at else None,
        })

    return jsonify({
        'total': certs.total,
        'pages': certs.pages,
        'current_page': page,
        'certificates': results
    })


@bp.route('/approve/<int:cert_id>', methods=['POST'])
@mentor_required
def approve_certificate(cert_id):
    """Mentor approves certificate"""
    cert = Certificate.query.get_or_404(cert_id)
    cert.verification_status = 'Approved'
    db.session.commit()

    # Log action
    from app.utils.helpers import log_action
    log_action(current_user.id, f'Approved Certificate {cert_id}', f'File: {cert.file_name}')

    return jsonify({'status': 'APPROVED', 'certificate_id': cert_id})


@bp.route('/reject/<int:cert_id>', methods=['POST'])
@mentor_required
def reject_certificate(cert_id):
    """Mentor rejects certificate"""
    data = request.get_json()
    reason = data.get('reason', 'Not specified')

    cert = Certificate.query.get_or_404(cert_id)
    cert.verification_status = 'Rejected'
    cert.fraud_notes = reason
    db.session.commit()

    # Log action
    from app.utils.helpers import log_action
    log_action(current_user.id, f'Rejected Certificate {cert_id}', f'Reason: {reason}')

    return jsonify({'status': 'REJECTED', 'certificate_id': cert_id})


@bp.route('/trust-score/<int:student_id>', methods=['GET'])
@mentor_required
def student_trust_score(student_id):
    """Get overall trust score for a student"""
    student = User.query.get_or_404(student_id)

    # Get all certificates for this student
    achievements = db.session.query(Achievement).filter_by(student_id=student_id).all()
    cert_ids = [ach.id for ach in achievements]
    certs = Certificate.query.filter(Certificate.achievement_id.in_(cert_ids)).all()

    verified = len([c for c in certs if c.verification_status == 'Approved'])
    rejected = len([c for c in certs if c.verification_status == 'Rejected'])
    duplicates = 0

    trust_score = (verified * 5 - rejected * 10 - duplicates * 15) / max(1, len(certs))
    trust_score = max(0, min(100, trust_score))

    return jsonify({
        'student_id': student_id,
        'student_name': student.full_name,
        'trust_score': trust_score,
        'verified_certificates': verified,
        'rejected_certificates': rejected,
        'duplicate_attempts': duplicates,
        'total_certificates': len(certs),
        'status': 'TRUSTED' if trust_score >= 80 else 'MONITORED' if trust_score >= 50 else 'FLAGGED'
    })


@bp.route('/stats', methods=['GET'])
@mentor_required
def verification_stats():
    """Get statistics on certificate verification"""
    total_certs = Certificate.query.count()
    approved = Certificate.query.filter_by(verification_status='Approved').count()
    rejected = Certificate.query.filter_by(verification_status='Rejected').count()
    pending = Certificate.query.filter_by(verification_status='Pending').count()

    return jsonify({
        'total_certificates': total_certs,
        'approved': approved,
        'rejected': rejected,
        'pending': pending,
        'approval_rate': f"{(approved / max(1, total_certs)) * 100:.2f}%",
        'rejection_rate': f"{(rejected / max(1, total_certs)) * 100:.2f}%",
    })
