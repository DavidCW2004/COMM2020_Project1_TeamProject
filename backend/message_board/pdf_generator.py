"""
PDF generation for session summaries.
Uses reportlab to create exportable PDF documents for facilitators.
"""

from io import BytesIO
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle


def generate_summary_pdf(summary, room):
    """Generate a PDF document from a SessionSummary."""

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'Title',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=20
    )
    heading_style = ParagraphStyle(
        'Heading',
        parent=styles['Heading2'],
        fontSize=14,
        spaceBefore=15,
        spaceAfter=10
    )
    body_style = styles['Normal']

    elements = []

    # ===== Title Section =====
    elements.append(Paragraph(f"Session Summary: {room.name}", title_style))
    elements.append(Paragraph(f"Room Code: {room.code}", body_style))
    elements.append(Paragraph(
        f"Activity: {summary.activity.name if summary.activity else 'N/A'}",
        body_style
    ))
    elements.append(Paragraph(
        f"Date: {summary.created_at.strftime('%B %d, %Y at %H:%M')}",
        body_style
    ))
    elements.append(Spacer(1, 0.3 * inch))

    # ===== Key Decisions =====
    elements.append(Paragraph("Key Decisions", heading_style))
    decisions = summary.extracted_content.get("decisions", [])
    if decisions:
        for d in decisions[:5]:  # Limit to top 5
            content = _truncate(d['content'], 200)
            elements.append(Paragraph(
                f"&bull; {content} <i>({d['author']}, {d['phase']})</i>",
                body_style
            ))
    else:
        elements.append(Paragraph(
            "<i>No explicit decisions captured.</i>",
            body_style
        ))
    elements.append(Spacer(1, 0.2 * inch))

    # ===== Action Items =====
    elements.append(Paragraph("Action Items", heading_style))
    action_items = summary.extracted_content.get("action_items", [])
    if action_items:
        for item in action_items[:5]:
            content = _truncate(item['content'], 200)
            elements.append(Paragraph(
                f"&bull; {content} <i>({item['author']})</i>",
                body_style
            ))
    else:
        elements.append(Paragraph(
            "<i>No action items identified.</i>",
            body_style
        ))
    elements.append(Spacer(1, 0.2 * inch))

    # ===== Unanswered Questions =====
    elements.append(Paragraph("Unanswered Questions", heading_style))
    questions = summary.extracted_content.get("unanswered_questions", [])
    if questions:
        for q in questions[:5]:
            content = _truncate(q['content'], 200)
            elements.append(Paragraph(
                f"&bull; {content} <i>({q['author']})</i>",
                body_style
            ))
    else:
        elements.append(Paragraph(
            "<i>All questions were addressed.</i>",
            body_style
        ))
    elements.append(Spacer(1, 0.2 * inch))

    # ===== Final Outcome =====
    elements.append(Paragraph("Group Outcome", heading_style))
    outcome = summary.extracted_content.get("final_outcome")
    if outcome:
        content = _truncate(outcome['content'], 300)
        elements.append(Paragraph(
            f'"{content}" &mdash; <i>{outcome["author"]}</i>',
            body_style
        ))
    else:
        elements.append(Paragraph(
            "<i>No final outcome recorded.</i>",
            body_style
        ))
    elements.append(Spacer(1, 0.3 * inch))

    # ===== Participation Statistics =====
    elements.append(Paragraph("Participation Statistics", heading_style))
    participation = summary.participation_data

    # Create participation table
    table_data = [["Participant", "Posts", "Contribution %", "Evidence Issues"]]
    for member in participation.get("members", []):
        table_data.append([
            member["display_name"],
            str(member["post_count"]),
            f"{member['contribution_percentage']:.1f}%",
            str(member["lacks_evidence_count"])
        ])

    if len(table_data) > 1:
        table = Table(
            table_data,
            colWidths=[2 * inch, 1 * inch, 1.5 * inch, 1.5 * inch]
        )
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        elements.append(table)

    elements.append(Spacer(1, 0.2 * inch))
    elements.append(Paragraph(
        f"Turn Balance Score: {participation.get('turn_balance_score', 0):.2f} "
        f"(1.0 = perfectly balanced)",
        body_style
    ))
    elements.append(Spacer(1, 0.3 * inch))

    # ===== Process Analytics =====
    elements.append(Paragraph("Process Analytics", heading_style))
    process = summary.process_data

    for phase in process.get("phases", []):
        mins = phase["duration_seconds"] // 60
        elements.append(Paragraph(
            f"&bull; <b>{phase['name']}</b>: {phase['post_count']} posts, "
            f"{phase['intervention_count']} interventions ({mins} min)",
            body_style
        ))

    elements.append(Spacer(1, 0.2 * inch))
    elements.append(Paragraph("Intervention Breakdown:", body_style))

    for rule, count in process.get("interventions_by_rule", {}).items():
        rule_display = rule.replace('_', ' ').title()
        elements.append(Paragraph(f"&nbsp;&nbsp;&nbsp;- {rule_display}: {count}", body_style))

    elements.append(Spacer(1, 0.3 * inch))

    # ===== Quality Assessment =====
    elements.append(Paragraph("Quality Assessment", heading_style))
    quality = summary.quality_data
    overall = quality.get('overall_score', 'N/A').upper().replace('_', ' ')
    elements.append(Paragraph(f"<b>Overall: {overall}</b>", body_style))
    elements.append(Spacer(1, 0.1 * inch))

    for flag in quality.get("flags", []):
        status = "FLAGGED" if flag["triggered"] else "OK"
        color = "red" if flag["triggered"] else "green"
        elements.append(Paragraph(
            f"&bull; {flag['label']}: <font color='{color}'><b>{status}</b></font> - {flag['details']}",
            body_style
        ))

    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    return buffer.read()


def _truncate(text, max_length):
    """Truncate text and add ellipsis if too long."""
    if len(text) <= max_length:
        return text
    return text[:max_length - 3] + "..."
