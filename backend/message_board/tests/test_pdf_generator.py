import pytest
from django.utils import timezone
from message_board.pdf_generator import generate_summary_pdf

@pytest.fixture
def fake_summary():
    class FakeSummary:
        activity = type("Activity", (), {"name": "Test Activity"})
        created_at = timezone.now()

        extracted_content = {
            "decisions": [
                {"content": "Use OAuth 2.0", "author": "Alice", "phase": "decide"}
            ],
            "action_items":[
                {"content": "Implement login flow", "author": "Bob"}
            ],
            "unanswered_questions": [
                {"content": "How do we refresh tokens?", "author": "Charlie"}
            ],
            "final_outcome": {
                "content": "OAuth with JWT refresh tokens",
                "author": "Alice"
            }
        }

        participation_data = {
            "members": [
                {"display_name": "Alice", "post_count": 3, 
                 "contribution_percentage": 40.0, "lacks_evidence_count": 0
                }
            ],
            "turn_balance_score": 0.85
        }

        process_data = {
            "phases": [
                {"name": "propose", "duration_seconds": 300,
                 "post_count": 2, "intervention_count": 0
                },
                {"name": "decide", "duration_seconds": 180,
                 "post_count": 3, "intervention_count": 1
                }
            ],
            "interventions_by_rule": {
                "lack_of_evidence": 1
            }
        }
        
        quality_data = {
            "overall_score": "good",
            "flags": [
                {
                    "label": "Evidence Quality",
                    "triggered": False,
                    "details": "0 of 5 posts lack evidence"
                }
            ]
        }    
    return FakeSummary()

@pytest.fixture
def fake_room():
    class FakeRoom:
        name = "Test Room"
        code = "TEST123"
    return FakeRoom()

def test_generate_summary_pdf_returns_bytes(fake_summary, fake_room):
    pdf_bytes = generate_summary_pdf(fake_summary, fake_room)
    
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    
def test_pdf_has_valid_header(fake_summary, fake_room):
    pdf_bytes = generate_summary_pdf(fake_summary, fake_room)
    
    assert pdf_bytes.startswith(b"%PDF")
    
def test_pdf_with_empty_summary(fake_room):
    class EmptySummary:
        activity = None
        created_at = timezone.now()
        extracted_content = {}
        participation_data = {"members": [], "turn_balance_score": 0}
        process_data = {"phases": [], "intervention_by_rule": {}}
        quality_data = {"flags": [], "overall_score": "good"}
        
    pdf_bytes = generate_summary_pdf(EmptySummary(), fake_room)
    assert pdf_bytes.startswith(b"%PDF")
    
def test_pdf_generation_is_deterministic(fake_summary, fake_room):
    pdf1 = generate_summary_pdf(fake_summary, fake_room)
    pdf2 = generate_summary_pdf(fake_summary, fake_room)
    assert len(pdf1) == len(pdf2)