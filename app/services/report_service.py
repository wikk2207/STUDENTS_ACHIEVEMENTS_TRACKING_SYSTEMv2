import io
import json
from datetime import datetime

import pandas as pd
from flask import current_app
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models import Achievement, Activity, Certificate, User
from app.utils.helpers import calculate_achievement_points


def achievements_to_dataframe(achievements, include_student=False):
    rows = []
    for a in achievements:
        student = a.student if include_student else None
        cert = a.certificate
        row = {
            "Achievement Title": a.title,
            "Category": a.category,
            "Event Name": a.event_name or "",
            "Organizer": a.organizer or "",
            "Date": a.event_date.isoformat() if a.event_date else "",
            "Rank": a.rank or "",
            "Level": a.level or "",
            "Approval Status": a.status,
            "Verification Status": cert.verification_status if cert else "N/A",
            "Fraud Risk": cert.fraud_risk if cert else "N/A",
            "Name Match %": round((cert.match_score or 0) * 100, 1) if cert else "",
            "Authenticity %": round((cert.authenticity_score or 0) * 100, 1) if cert else "",
            "Certificate File": cert.file_name if cert else "",
            "Uploaded At": cert.uploaded_at.strftime("%Y-%m-%d %H:%M") if cert and cert.uploaded_at else "",
            "Mentor Remarks": a.mentor_comment or "",
        }
        if include_student and student:
            row = {
                "Student Name": student.full_name,
                "Email": student.email,
                "Roll Number": student.roll_number or "",
                "Department": student.department or "",
                "Year": student.year or "",
                **row,
            }
        rows.append(row)
    return pd.DataFrame(rows)


def certificates_to_dataframe():
    rows = []
    for c in Certificate.query.order_by(Certificate.uploaded_at.desc()).all():
        student = None
        title = ""
        if c.achievement:
            student = c.achievement.student
            title = c.achievement.title
        elif c.activity:
            student = c.activity.student
            title = c.activity.activity_name
        notes = []
        if c.fraud_notes:
            try:
                notes = json.loads(c.fraud_notes)
            except json.JSONDecodeError:
                notes = [c.fraud_notes]
        rows.append({
            "Student Name": student.full_name if student else "",
            "Email": student.email if student else "",
            "Department": student.department if student else "",
            "Linked To": title,
            "File Name": c.file_name or "",
            "Verification Status": c.verification_status or "",
            "Fraud Risk": c.fraud_risk or "",
            "Name Match %": round((c.match_score or 0) * 100, 1),
            "Confidence %": round((c.confidence_score or 0) * 100, 1),
            "Authenticity %": round((c.authenticity_score or 0) * 100, 1),
            "Detected Name": c.detected_name or "",
            "Detected Event": c.detected_event or "",
            "Scanner Notes": "; ".join(notes) if notes else "",
            "Uploaded At": c.uploaded_at.strftime("%Y-%m-%d %H:%M") if c.uploaded_at else "",
        })
    return pd.DataFrame(rows)


def students_summary_dataframe():
    rows = []
    for s in User.query.filter_by(role="student").order_by(User.full_name).all():
        achievements = Achievement.query.filter_by(student_id=s.id).all()
        activities = Activity.query.filter_by(student_id=s.id).all()
        certs = []
        seen = set()
        for a in achievements:
            if a.certificate and a.certificate.id not in seen:
                certs.append(a.certificate)
                seen.add(a.certificate.id)
        for act in activities:
            if act.certificate and act.certificate.id not in seen:
                certs.append(act.certificate)
                seen.add(act.certificate.id)
        rows.append({
            "Full Name": s.full_name,
            "Email": s.email,
            "Mobile": s.mobile or "",
            "Department": s.department or "",
            "Year": s.year or "",
            "Roll Number": s.roll_number or "",
            "Total Achievements": len(achievements),
            "Approved": len([a for a in achievements if a.status == "Approved"]),
            "Pending": len([a for a in achievements if a.status in ("Submitted", "Under Review")]),
            "Rejected": len([a for a in achievements if a.status == "Rejected"]),
            "Total Activities": len(activities),
            "Certificates Uploaded": len(certs),
            "Verified Certs": len([c for c in certs if c.verification_status == "Verified"]),
            "Suspected Fake": len([c for c in certs if c.verification_status == "Suspected Fake"]),
            "Achievement Points": calculate_achievement_points(achievements),
            "Registered": s.created_at.strftime("%Y-%m-%d") if s.created_at else "",
        })
    return pd.DataFrame(rows)


def export_excel(achievements, sheet_name="Achievements", include_student=False):
    df = achievements_to_dataframe(achievements, include_student=include_student)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name=sheet_name)
    output.seek(0)
    return output


def export_comprehensive_excel():
    """Full dataset: students, achievements, certificates, summary stats."""
    achievements = Achievement.query.filter(Achievement.status != "Draft").all()
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        students_summary_dataframe().to_excel(writer, index=False, sheet_name="All Students")
        achievements_to_dataframe(achievements, include_student=True).to_excel(
            writer, index=False, sheet_name="Achievements History"
        )
        cert_df = certificates_to_dataframe()
        cert_df.to_excel(writer, index=False, sheet_name="Certificate Uploads")
        summary = pd.DataFrame([{
            "Total Students": User.query.filter_by(role="student").count(),
            "Total Certificates Uploaded": Certificate.query.count(),
            "Verified": Certificate.query.filter_by(verification_status="Verified").count(),
            "Suspected Fake": Certificate.query.filter_by(verification_status="Suspected Fake").count(),
            "Name Mismatch": Certificate.query.filter_by(verification_status="Name Mismatch").count(),
            "Manual Review": Certificate.query.filter_by(verification_status="Manual Review Required").count(),
            "Exported At": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
        }])
        summary.to_excel(writer, index=False, sheet_name="Summary")
    output.seek(0)
    return output


def export_csv(achievements, include_student=False):
    df = achievements_to_dataframe(achievements, include_student=include_student)
    return io.BytesIO(df.to_csv(index=False).encode("utf-8"))


def student_portfolio_pdf(student, achievements, activities, points, badges):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=50, leftMargin=50, topMargin=50)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "Title",
        parent=styles["Heading1"],
        fontSize=22,
        textColor=colors.HexColor("#7C3AED"),
        spaceAfter=20,
    )
    story = [
        Paragraph("Student Achievement Portfolio", title_style),
        Paragraph(f"<b>{student.full_name}</b>", styles["Normal"]),
        Paragraph(f"Email: {student.email}", styles["Normal"]),
        Paragraph(f"Department: {student.department or 'N/A'} | Year: {student.year or 'N/A'}", styles["Normal"]),
        Paragraph(f"Achievement Points: {points} | Badges: {', '.join(badges) or 'None'}", styles["Normal"]),
        Spacer(1, 0.3 * inch),
        Paragraph("<b>Approved Achievements</b>", styles["Heading2"]),
    ]

    approved = [a for a in achievements if a.status == "Approved"]
    if approved:
        data = [["Title", "Category", "Event", "Date", "Rank", "Level"]]
        for a in approved:
            data.append([
                a.title[:40],
                a.category,
                (a.event_name or "")[:30],
                a.event_date.strftime("%Y-%m-%d") if a.event_date else "",
                (a.rank or "")[:20],
                a.level or "",
            ])
        t = Table(data, colWidths=[1.4 * inch, 0.9 * inch, 1.2 * inch, 0.8 * inch, 0.8 * inch, 0.8 * inch])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#7C3AED")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        story.append(t)
    else:
        story.append(Paragraph("No approved achievements yet.", styles["Normal"]))

    story.append(Spacer(1, 0.3 * inch))
    story.append(Paragraph("<b>Activities</b>", styles["Heading2"]))
    act_rows = [["Name", "Type", "Date", "Status"]]
    for act in activities[:20]:
        act_rows.append([
            act.activity_name[:40],
            act.activity_type or "",
            act.date.strftime("%Y-%m-%d") if act.date else "",
            act.status,
        ])
    if len(act_rows) > 1:
        t2 = Table(act_rows, colWidths=[2 * inch, 1.2 * inch, 1 * inch, 1 * inch])
        t2.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.grey), ("FONTSIZE", (0, 0), (-1, -1), 8)]))
        story.append(t2)

    story.append(Spacer(1, 0.5 * inch))
    story.append(
        Paragraph(
            f"Generated by SAAMS on {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
            styles["Italic"],
        )
    )
    doc.build(story)
    buffer.seek(0)
    return buffer


def department_report_pdf(department, stats, top_students):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    story = [
        Paragraph(f"Department Report — {department}", styles["Title"]),
        Paragraph(f"Total Achievements: {stats.get('total', 0)}", styles["Normal"]),
        Paragraph(f"Approved: {stats.get('approved', 0)} | Pending: {stats.get('pending', 0)}", styles["Normal"]),
        Spacer(1, 0.3 * inch),
        Paragraph("<b>Top Students</b>", styles["Heading2"]),
    ]
    if top_students:
        data = [["Rank", "Name", "Points", "Approved"]]
        for i, s in enumerate(top_students, 1):
            data.append([str(i), s["name"], str(s["points"]), str(s["approved"])])
        t = Table(data)
        t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.grey)]))
        story.append(t)
    doc.build(story)
    buffer.seek(0)
    return buffer
