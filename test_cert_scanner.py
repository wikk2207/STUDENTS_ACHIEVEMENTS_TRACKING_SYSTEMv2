"""
Certificate Scanner Test & Demo Script
Run to test all 20 levels of certificate verification
"""

from app import create_app, db
from app.models import Certificate, User, Achievement
from app.services.cert_verification import CertificateScanner
from datetime import datetime


def demo_certificate_scan():
    """Demo the full certificate scanning system"""
    
    app = create_app()
    
    with app.app_context():
        print("\n" + "="*80)
        print("SAAMS CERTIFICATE SCANNER - 20 LEVEL VERIFICATION DEMO")
        print("="*80 + "\n")
        
        # Get a sample certificate
        cert = Certificate.query.first()
        
        if not cert:
            print("⚠️  No certificates found in database. Run seed first.")
            print("   python app.py seed")
            return
        
        print(f"📄 Certificate: {cert.file_name}")
        print(f"   Uploaded: {cert.uploaded_at}")
        print(f"   Current Status: {cert.verification_status}\n")
        
        # Initialize scanner
        print("🔍 Running 20-level verification scan...\n")
        scanner = CertificateScanner(cert)
        
        # Run each level individually
        print("─" * 80)
        print("LEVEL 1: OCR EXTRACTION")
        print("─" * 80)
        result = scanner.level_1_ocr_extraction()
        print(f"✓ Student Name: {result.get('student_name', 'N/A')}")
        print(f"✓ Event Name: {result.get('event_name', 'N/A')}")
        print(f"✓ Certificate Date: {result.get('date', 'N/A')}")
        print(f"✓ Organization: {result.get('organization', 'N/A')}")
        print(f"✓ Has QR Code: {result.get('has_qr', False)}")
        print(f"✓ Has Signature: {result.get('has_signature', False)}")
        print(f"✓ Confidence: {result.get('confidence', 0)}%\n")
        
        print("─" * 80)
        print("LEVEL 2: STUDENT IDENTITY MATCHING")
        print("─" * 80)
        result = scanner.level_2_student_identity_matching()
        if result.get('status') != 'ERROR':
            print(f"✓ Student ID: {result.get('student_id', 'N/A')}")
            print(f"✓ Student Name: {result.get('student_name', 'N/A')}")
            print(f"✓ Match Percentage: {result.get('match_percentage', 0):.1f}%")
            print(f"✓ Status: {result.get('status', 'N/A')}\n")
        else:
            print("❌ Could not match student\n")
        
        print("─" * 80)
        print("LEVEL 3: FUZZY NAME DETECTION")
        print("─" * 80)
        result = scanner.level_3_fuzzy_name_detection()
        if result.get('status') != 'ERROR':
            print(f"✓ Original Name: {result.get('original', 'N/A')}")
            print(f"✓ Certificate Name: {result.get('certificate', 'N/A')}")
            print(f"✓ Similarity: {result.get('similarity_percentage', 0):.1f}%")
            print(f"✓ Status: {result.get('status', 'N/A')}")
            print(f"✓ Risk Level: {result.get('risk_level', 'N/A')}\n")
        else:
            print("❌ Could not match names\n")
        
        print("─" * 80)
        print("LEVEL 4: EVENT VALIDATION")
        print("─" * 80)
        result = scanner.level_4_event_validation()
        print(f"✓ Event Name: {result.get('event_name', 'N/A')}")
        print(f"✓ Event Found: {result.get('event_found', False)}")
        print(f"✓ Organizer Valid: {result.get('organizer_valid', False)}")
        print(f"✓ Date Realistic: {result.get('date_realistic', False)}")
        print(f"✓ Risk Level: {result.get('risk_level', 'N/A')}\n")
        
        print("─" * 80)
        print("LEVEL 5: CERTIFICATE ID VERIFICATION")
        print("─" * 80)
        result = scanner.level_5_certificate_id()
        print(f"✓ Certificate ID: {result.get('certificate_id', 'None')}")
        print(f"✓ Has ID: {result.get('has_id', False)}")
        print(f"✓ Duplicate by Others: {result.get('duplicate_by_others', False)}")
        print(f"✓ Status: {result.get('status', 'N/A')}\n")
        
        print("─" * 80)
        print("LEVEL 6: QR CODE VERIFICATION")
        print("─" * 80)
        result = scanner.level_6_qr_code()
        print(f"✓ Has QR Code: {result.get('has_qr_code', False)}")
        print(f"✓ QR Scannable: {result.get('qr_scannable', False)}")
        print(f"✓ Verification URL: {result.get('verification_url', 'N/A')}")
        print(f"✓ Status: {result.get('status', 'N/A')}")
        print(f"✓ Risk Level: {result.get('risk_level', 'N/A')}\n")
        
        print("─" * 80)
        print("LEVEL 7: DUPLICATE DETECTION")
        print("─" * 80)
        result = scanner.level_7_duplicate_detection()
        print(f"✓ Same Student Duplicates: {result.get('same_student_duplicates', 0)}")
        print(f"✓ Other Student Duplicates: {result.get('other_student_duplicates', 0)}")
        print(f"✓ Total Duplicates: {result.get('total_duplicates', 0)}")
        print(f"✓ Status: {result.get('status', 'N/A')}")
        print(f"✓ Risk Level: {result.get('risk_level', 'N/A')}\n")
        
        print("─" * 80)
        print("LEVEL 8: TEMPLATE VERIFICATION")
        print("─" * 80)
        result = scanner.level_8_template_verification()
        print(f"✓ Template Detected: {result.get('template_detected', 'None')}")
        print(f"✓ Known Template: {result.get('known_template', False)}")
        print(f"✓ Status: {result.get('status', 'N/A')}")
        print(f"✓ Risk Level: {result.get('risk_level', 'N/A')}\n")
        
        print("─" * 80)
        print("LEVEL 9: SIGNATURE DETECTION")
        print("─" * 80)
        result = scanner.level_9_signature_detection()
        print(f"✓ Has Signature: {result.get('has_signature', False)}")
        print(f"✓ Authorized Signatory: {result.get('authorized_signatory', 'N/A')}")
        print(f"✓ Status: {result.get('status', 'N/A')}")
        print(f"✓ Risk Level: {result.get('risk_level', 'N/A')}\n")
        
        print("─" * 80)
        print("LEVEL 10: SEAL/LOGO DETECTION")
        print("─" * 80)
        result = scanner.level_10_seal_logo()
        print(f"✓ Has Event Logo: {result.get('has_event_logo', False)}")
        print(f"✓ Has College Logo: {result.get('has_college_logo', False)}")
        print(f"✓ Has Org Logo: {result.get('has_org_logo', False)}")
        print(f"✓ Status: {result.get('status', 'N/A')}\n")
        
        print("─" * 80)
        print("LEVEL 11: DATE VALIDATION")
        print("─" * 80)
        result = scanner.level_11_date_validation()
        print(f"✓ Certificate Date: {result.get('certificate_date', 'N/A')}")
        print(f"✓ Current Date: {result.get('current_date', 'N/A')}")
        print(f"✓ Date In Future: {result.get('date_in_future', False)}")
        print(f"✓ Date Realistic: {result.get('date_realistic', False)}")
        print(f"✓ Status: {result.get('status', 'N/A')}\n")
        
        print("─" * 80)
        print("LEVEL 12: ACHIEVEMENT CONSISTENCY")
        print("─" * 80)
        result = scanner.level_12_achievement_consistency()
        print(f"✓ Claimed Type: {result.get('claimed_type', 'N/A')}")
        print(f"✓ Certificate Type: {result.get('certificate_type', 'N/A')}")
        print(f"✓ Match: {result.get('match', False)}")
        print(f"✓ Status: {result.get('status', 'N/A')}")
        print(f"✓ Risk Level: {result.get('risk_level', 'N/A')}\n")
        
        print("─" * 80)
        print("LEVEL 13-15: IMAGE & METADATA ANALYSIS")
        print("─" * 80)
        result13 = scanner.level_13_image_manipulation()
        result14 = scanner.level_14_font_consistency()
        result15 = scanner.level_15_metadata_analysis()
        print(f"✓ L13 Manipulation Score: {result13.get('manipulation_score', 0)}%")
        print(f"✓ L14 Font Consistency: {result14.get('status', 'N/A')}")
        print(f"✓ L15 Metadata Clean: {result15.get('status', 'N/A')}\n")
        
        print("─" * 80)
        print("LEVEL 16: AI RISK SCORE (FINAL)")
        print("─" * 80)
        result = scanner.level_16_ai_risk_score()
        score = result.get('ai_risk_score', 0)
        print(f"✓ AI Risk Score: {score:.2f}/100")
        print(f"✓ Score Range: {result.get('score_range', 'N/A')}")
        print(f"✓ Status: {result.get('status', 'N/A')}")
        print(f"✓ Recommendation: {result.get('recommendation', 'N/A')}\n")
        
        print("─" * 80)
        print("LEVEL 17: MENTOR RECOMMENDATION")
        print("─" * 80)
        result = scanner.level_17_mentor_recommendation()
        print(f"✓ Recommendation: {result.get('recommendation', 'N/A')}")
        print(f"✓ Confidence Level: {result.get('confidence_level', 'N/A')}")
        print(f"✓ Action Required: {result.get('action_required', 'N/A')}")
        print(f"✓ Mentor Notes: {result.get('mentor_notes', 'N/A')}\n")
        
        print("─" * 80)
        print("LEVEL 18-20: TIMELINE, APPROVAL, TRUST SCORE")
        print("─" * 80)
        result18 = scanner.level_18_portfolio_timeline()
        result19 = scanner.level_19_approval_chain()
        result20 = scanner.level_20_trust_score()
        print(f"✓ L18 Timeline Valid: {result18.get('status', 'N/A')}")
        print(f"✓ L19 Current Stage: {result19.get('current_stage', 'N/A')}")
        print(f"✓ L20 Trust Score: {result20.get('trust_score', 0):.1f}/100\n")
        
        print("="*80)
        print("✅ FULL SCAN COMPLETE")
        print("="*80 + "\n")
        
        # Get final report
        full_report = scanner.get_final_report()
        print(f"Final AI Score: {full_report['final_score']:.2f}/100")
        print(f"Recommendation: {full_report['recommendation']}")
        print(f"Trust Score: {full_report['trust_score']:.1f}/100")
        print(f"Generated: {full_report['generated_at']}\n")


def test_api_endpoints():
    """Test the new API endpoints"""
    
    print("\n" + "="*80)
    print("CERTIFICATE SCANNER API ENDPOINTS")
    print("="*80 + "\n")
    
    print("📍 NEW ENDPOINTS AVAILABLE:\n")
    print("1. GET  /api/cert-verify/pending")
    print("   → List all pending certificates for review\n")
    
    print("2. POST /api/cert-verify/scan/<cert_id>")
    print("   → Run full 20-level scan on certificate\n")
    
    print("3. GET  /api/cert-verify/dashboard/<cert_id>")
    print("   → View complete verification report\n")
    
    print("4. GET  /api/cert-verify/summary")
    print("   → Summary of all certificates\n")
    
    print("5. POST /api/cert-verify/approve/<cert_id>")
    print("   → Mentor approves certificate\n")
    
    print("6. POST /api/cert-verify/reject/<cert_id>")
    print("   → Mentor rejects certificate with reason\n")
    
    print("7. GET  /api/cert-verify/trust-score/<student_id>")
    print("   → Get student's overall trust score\n")
    
    print("8. GET  /api/cert-verify/stats")
    print("   → Overall verification statistics\n")
    
    print("="*80 + "\n")


if __name__ == '__main__':
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == 'demo':
        demo_certificate_scan()
    elif len(sys.argv) > 1 and sys.argv[1] == 'api':
        test_api_endpoints()
    else:
        print("\n" + "="*80)
        print("CERTIFICATE SCANNER TEST SUITE")
        print("="*80 + "\n")
        print("Usage:")
        print("  python test_cert_scanner.py demo  → Run full demo scan")
        print("  python test_cert_scanner.py api   → Show API endpoints")
        print("\n")
