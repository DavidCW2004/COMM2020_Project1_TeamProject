import pytest
import uuid
from django.contrib.auth.models import User
from django.utils import timezone
from message_board import agent_rules
from message_board.models import Activity, Intervention, Post, Room

@pytest.fixture
def users(db):
    return [
        User.objects.create_user(username="alice", first_name="Alice"),
        User.objects.create_user(username="bob", first_name="Bob"),
        User.objects.create_user(username="charlie", first_name="Charlie"),
    ]

@pytest.fixture
def activity(db):
    return Activity.objects.create(
        name="Quick Test Activity",
        activity_type="discussion",
        phases=[
            {"name": "understand", "prompt": "Understand", "time_limit_minutes": 1},
            {"name": "propose", "prompt": "Propose", "time_limit_minutes": 1},
            {"name": "critique", "prompt": "Critique", "time_limit_minutes": 1},
            {"name": "decide", "prompt": "Decide", "time_limit_minutes": 1},
        ],
    )

@pytest.fixture
def room(db, users, activity):
    room = Room.objects.create(
        code="ROOM02",
        name="Agent Test Room",
        created_by=users[0],
        selected_activity=activity,
        is_private=False,
        password_hash="",
        activity_started_at=timezone.now(),
        activity_is_running=True,
        activity_run_id=uuid.uuid4(),
    )
    room.members.set(users)
    return room

def create_post(room, user, content, phase_index, created_at=None):
    post = Post.objects.create(
        room=room,
        author=user,
        content=content,
        phase_index=phase_index,
        activity_run_id=room.activity_run_id,
        lacks_evidence=agent_rules.message_lacks_evidence(content),
    )
    if created_at is not None:
        Post.objects.filter(id=post.id).update(created_at=created_at)
        post.refresh_from_db()
    return post

@pytest.mark.django_db
def test_message_lacks_evidence_detects_unsupported_claim():
    assert agent_rules.message_lacks_evidence(
        "This is definitely the best solution and everyone should use it"
    ) is True

@pytest.mark.django_db
def test_message_lacks_evidence_ignores_supported_claim():
    assert agent_rules.message_lacks_evidence(
        "According to the study, this works because response times improved"
    ) is False

@pytest.mark.django_db
def test_check_evidence_rule_creates_intervention(room, users):
    post = create_post(
        room,
        users[0],
        "This approach is clearly better and everyone should switch to it",
        phase_index=1,
    )
    triggered = agent_rules.check_evidence_rule(room, post)

    assert triggered is True
    intervention = Intervention.objects.latest("id")
    assert intervention.room == room
    assert intervention.activity_run_id == room.activity_run_id
    assert intervention.rule_name.startswith("missing_evidence")
    assert intervention.recipient == users[0]

@pytest.mark.django_db
def test_check_evidence_rule_does_not_create_intervention_for_supported_message(room, users):
    post = create_post(
        room,
        users[0],
        "According to the data, this is better because latency dropped by 30%",
        phase_index=1,
    )
    triggered = agent_rules.check_evidence_rule(room, post)

    assert triggered is False
    assert Intervention.objects.count() == 0

@pytest.mark.django_db
def test_check_dominant_speaker_rule_creates_intervention(room, users):
    create_post(room, users[0], "First point for discussion", phase_index=1)
    create_post(room, users[0], "Second point for discussion", phase_index=1)
    create_post(room, users[0], "Third point for discussion", phase_index=1)

    triggered = agent_rules.check_dominant_speaker_rule(room, phase_index=1)

    assert triggered is True
    intervention = Intervention.objects.latest("id")
    assert intervention.rule_name.startswith("dominant_speaker")
    assert intervention.recipient == users[0]

@pytest.mark.django_db
def test_check_unanswered_question_rule_creates_intervention(room, users):
    old_time = timezone.now() - agent_rules.UNANSWERED_QUESTION_TIMEOUT - timezone.timedelta(seconds=5)

    create_post(
        room,
        users[0],
        "How should we handle authentication?",
        phase_index=0,
        created_at=old_time,
    )

    triggered = agent_rules.check_unanswered_question_rule(room, phase_index=0)

    assert triggered is True
    intervention = Intervention.objects.latest("id")
    assert intervention.rule_name.startswith("unanswered_question")

@pytest.mark.django_db
def test_check_unanswered_question_rule_does_not_trigger_when_answered(room, users):
    old_time = timezone.now() - agent_rules.UNANSWERED_QUESTION_TIMEOUT - timezone.timedelta(seconds=5)

    create_post(
        room,
        users[0],
        "How should we handle authentication?",
        phase_index=0,
        created_at=old_time,
    )
    create_post(
        room,
        users[1],
        "We should use OAuth.",
        phase_index=0,
    )
    triggered = agent_rules.check_unanswered_question_rule(room, phase_index=0)

    assert triggered is False
    assert Intervention.objects.count() == 0

@pytest.mark.django_db
def test_check_short_message_rule_creates_intervention(room, users):
    post = create_post(room, users[1], "ok", phase_index=1)

    triggered = agent_rules.check_short_message_rule(room, post)

    assert triggered is True
    intervention = Intervention.objects.latest("id")
    assert intervention.rule_name.startswith("short_message")
    assert intervention.recipient == users[1]

@pytest.mark.django_db
def test_check_rude_message_rule_creates_intervention(room, users):
    post = create_post(room, users[2], "THIS IS STUPID", phase_index=1)

    triggered = agent_rules.check_rude_message_rule(room, post)

    assert triggered is True
    intervention = Intervention.objects.latest("id")
    assert intervention.rule_name.startswith("rude_message")
    assert intervention.recipient == users[2]