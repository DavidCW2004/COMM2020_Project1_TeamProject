import pytest
import uuid
from django.utils import timezone
from message_board.models import Room, Post, SessionSummary, Activity
from message_board.summary_service import generate_summary
from django.contrib.auth.models import User

@pytest.fixture
def users(db):
    return[
        User.objects.create_user(username = "alice", first_name = "Alice"),
        User.objects.create_user(username = "bob", first_name = "Bob"),
        User.objects.create_user(username = "charlie", first_name = "Charlie"),
    ]

@pytest.fixture
def activity(db):
    return Activity.objects.create(
        name = "Quick Test Activity",
        activity_type = "discussion",
        phases = [
            {"name": "understand", "time_limit_minutes": 0.167},
            {"name": "propose", "time_limit_minutes": 0.167},
            {"name": "critique", "time_limit_minutes": 0.167},
            {"name": "decide", "time_limit_minutes": 0.167},
            ],
            )

@pytest.fixture
def room(db, users, activity):
    room = Room.objects.create(
        code = "TEST123",
        name = "Test Room",
        selected_activity = activity,
        activity_started_at = timezone.now(),
        activity_is_running = True,
    )
    room.members.set(users)
    return room

def create_post(room, user, content, phase_index, activity_run_id, lacks_evidence = False):
    return Post.objects.create(
        room = room,
        author = user,
        content = content,
        phase_index = phase_index,
        activity_run_id = activity_run_id,
        lacks_evidence = lacks_evidence,
    )

@pytest.mark.django_db
def test_generate_summary_creates_summary(room, users):
    run1 = uuid.uuid4()

    create_post(room, users[0], "I think the problem is X", 0, run1)
    summary = generate_summary(room, run1)

    assert isinstance(summary, SessionSummary)
    assert summary.room == room
    assert summary.activity_run_id == run1
    assert summary.participation_data is not None

@pytest.mark.django_db
def test_participation_metrics(room, users):
    run2 = uuid.uuid4()
    
    create_post(room, users[0], "Post 1", 0, run2)
    create_post(room, users[0], "Post 2", 0, run2)
    create_post(room, users[1], "Post 3", 0, run2)
    
    summary = generate_summary(room, run2)
    pdata = summary.participation_data

    assert pdata["total_posts"] == 3
    assert pdata["gini_coefficient"] > 0
    assert pdata["turn_balance_score"] < 1

@pytest.mark.django_db
def test_propose_phase_idea_capture(room, users):
    run_propose = uuid.uuid4()

    create_post(room, users[0], "We could use OAuth", 1, run_propose)
    create_post(room, users[0], "JWT tokens might work better", 1, run_propose)

    summary = generate_summary(room, run_propose)
    ideas = summary.extracted_content.get("proposals", [])

    assert len(ideas) == 2
    assert any("OAuth" in i["content"] for i in ideas)

@pytest.mark.django_db
def test_decision_extraction(room, users):
    run3 = uuid.uuid4()

    create_post(room, users[0], "We decided to go with option B", 3, run3)

    summary = generate_summary(room, run3)
    decisions = summary.extracted_content["decisions"]

    assert len(decisions) == 1
    assert "option B" in decisions[0]["content"]

@pytest.mark.django_db
def test_action_item_extraction(room, users):
    run4 = uuid.uuid4()

    create_post(room, users[1], "Next steps: implement the API", 3, run4)

    summary = generate_summary(room, run4)
    action_items = summary.extracted_content["action_items"]

    assert len(action_items) == 1
    assert "implement the API" in action_items[0]["content"]

@pytest.mark.django_db
def test_unanswered_question_detection(room, users):
    run5 = uuid.uuid4()

    create_post(room, users[0], "How should we handle authentication?", 0, run5)

    summary = generate_summary(room, run5)
    unanswered = summary.extracted_content["unanswered_questions"]

    assert len(unanswered) == 1
    assert "authentication" in unanswered[0]["content"]

@pytest.mark.django_db
def test_claims_without_evidence_flag(room, users):
    run6 = uuid.uuid4()

    create_post(room, users[0], "I think this is correct", 0, run6, lacks_evidence = True)
    create_post(room, users[1], "Probably fine", 0, run6, lacks_evidence = True)
    create_post(room, users[2], "Looks good", 0, run6)


    summary = generate_summary(room, run6)
    flags = summary.quality_data["flags"]

    evidence_flag = next(f for f in flags if f["code"] == "claims_without_evidence")
    assert evidence_flag["triggered"] is True
    
@pytest.mark.django_db
def test_final_outcome_extraction(room, users):
    run7 = uuid.uuid4()

    create_post(room, users[0], "Option A", 3, run7)
    create_post(room, users[1], "Final decision: Option B", 3, run7)

    summary = generate_summary(room, run7)
    final_outcome = summary.extracted_content["final_outcome"]

    assert final_outcome is not None
    assert "Option B" in final_outcome["content"]

@pytest.mark.django_db
def test_activity_run_isolation(room, users):
    run1 = uuid.uuid4()
    run2 = uuid.uuid4()
    
    create_post(room, users[0], "Run 1 post", 3, run1)
    create_post(room, users[0], "Run 2 post", 3, run2)

    summary1 = generate_summary(room, run1)
    summary2 = generate_summary(room, run2)

    assert summary1.participation_data["total_posts"] == 1
    assert summary2.participation_data["total_posts"] == 1
