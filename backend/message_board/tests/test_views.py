import pytest
import json
import uuid
from django.contrib.auth.models import AnonymousUser, User
from django.test import RequestFactory
from django.utils import timezone
from message_board import views
from message_board.models import Activity, Post, Room


@pytest.fixture
def rf():
    return RequestFactory()

@pytest.fixture
def user(db):
    return User.objects.create_user(username="alice", password="testpass123", first_name="Alice",)

@pytest.fixture
def other_user(db):
    return User.objects.create_user(
        username="bob",
        password="testpass123",
        first_name="Bob",
    )

@pytest.fixture
def facilitator(db):
    user = User.objects.create_user(
        username="facilitator",
        password="testpass123",
        first_name="Fac",
    )
    user.profile.role = "facilitator"
    user.profile.save()
    return user

@pytest.fixture
def learner(db):
    user = User.objects.create_user(
        username="learner",
        password="testpass123",
        first_name="Learner",
    )
    user.profile.role = "learner"
    user.profile.save()
    return user

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
def room(db, user):
    room = Room.objects.create(
        code="ROOM01",
        name="Test Room",
        created_by=user,
        is_private=False,
        password_hash="",
    )
    room.members.add(user)
    return room

@pytest.mark.django_db
def test_new_user_gets_default_learner_profile():
    user = User.objects.create_user(username="newuser", password="testpass123")
    assert user.profile.role == "learner"

@pytest.mark.django_db
def test_unauthenticated_user_cannot_create_room(rf):
    request = rf.post(
        "/rooms/",
        data=json.dumps({"action": "create", "name": "My Room"}),
        content_type="application/json",
    )
    request.user = AnonymousUser()
    response = views.rooms(request)
    assert response.status_code == 401

@pytest.mark.django_db
def test_authenticated_user_can_create_room(rf, user):
    request = rf.post(
        "/rooms/",
        data=json.dumps({"action": "create", "name": "My Room"}),
        content_type="application/json",
    )
    request.user = user
    response = views.rooms(request)
    payload = json.loads(response.content)

    assert response.status_code == 201
    assert payload["name"] == "My Room"
    assert payload["code"]
    assert Room.objects.filter(code=payload["code"]).exists()

@pytest.mark.django_db
def test_user_can_join_room_with_valid_code(rf, room, other_user):
    request = rf.post(
        "/rooms/",
        data=json.dumps({"action": "join", "code": room.code}),
        content_type="application/json",
    )
    request.user = other_user
    response = views.rooms(request)
    payload = json.loads(response.content)
    room.refresh_from_db()

    assert response.status_code == 200
    assert payload["joined"] is True
    assert room.members.filter(id=other_user.id).exists()

@pytest.mark.django_db
def test_joining_invalid_room_code_returns_404(rf, user):
    request = rf.post(
        "/rooms/",
        data=json.dumps({"action": "join", "code": "BAD999"}),
        content_type="application/json",
    )
    request.user = user
    response = views.rooms(request)
    assert response.status_code == 404

@pytest.mark.django_db
def test_select_activity_saves_activity_on_room(rf, room, user, activity):
    request = rf.post(
        f"/rooms/{room.code}/select-activity/",
        data=json.dumps({"activity_id": activity.id}),
        content_type="application/json",
    )
    request.user = user

    response = views.select_activity(request, room.code)

    room.refresh_from_db()

    assert response.status_code == 200
    assert room.selected_activity == activity
    assert room.activity_is_running is False

@pytest.mark.django_db
def test_start_activity_sets_run_id_and_started_at(rf, room, user, activity):
    room.selected_activity = activity
    room.activity_is_running = False
    room.activity_started_at = None
    room.activity_run_id = None
    room.save()

    request = rf.post(f"/rooms/{room.code}/start-activity/")
    request.user = user
    response = views.start_activity(request, room.code)
    room.refresh_from_db()

    assert response.status_code == 200
    assert room.activity_is_running is True
    assert room.activity_started_at is not None
    assert room.activity_run_id is not None

@pytest.mark.django_db
def test_unauthenticated_user_cannot_post_message(rf, room):
    request = rf.post(
        f"/messages/?room={room.code}",
        data=json.dumps({"content": "Hello"}),
        content_type="application/json",
    )
    request.user = AnonymousUser()
    response = views.messages(request)
    assert response.status_code == 401

@pytest.mark.django_db
def test_post_message_creates_post_with_current_activity_run_id(rf, room, user, activity, monkeypatch):
    room.selected_activity = activity
    room.activity_is_running = True
    room.activity_started_at = timezone.now()
    room.activity_run_id = uuid.uuid4()
    room.save()

    monkeypatch.setattr(views, "check_post_rules", lambda room_arg, post_arg: [])

    request = rf.post(
        f"/messages/?room={room.code}",
        data=json.dumps({"content": "I think OAuth is best"}),
        content_type="application/json",
    )
    request.user = user
    response = views.messages(request)
    assert response.status_code == 201
    post = Post.objects.latest("id")
    assert post.room == room
    assert post.author == user
    assert post.activity_run_id == room.activity_run_id

@pytest.mark.django_db
def test_empty_message_returns_400(rf, room, user):
    request = rf.post(
        f"/messages/?room={room.code}",
        data=json.dumps({"content": "   "}),
        content_type="application/json",
    )
    request.user = user
    response = views.messages(request)
    assert response.status_code == 400

@pytest.mark.django_db
def test_message_posting_calls_post_rule_checks(rf, room, user, activity, monkeypatch):
    room.selected_activity = activity
    room.activity_is_running = True
    room.activity_started_at = timezone.now()
    room.activity_run_id = uuid.uuid4()
    room.save()
    called = {"value": False}

    def fake_check_post_rules(room_arg, post_arg):
        called["value"] = True
        return []

    monkeypatch.setattr(views, "check_post_rules", fake_check_post_rules)

    request = rf.post(
        f"/messages/?room={room.code}",
        data=json.dumps({"content": "Maybe OAuth is better"}),
        content_type="application/json",
    )
    request.user = user
    response = views.messages(request)
    assert response.status_code == 201
    assert called["value"] is True

@pytest.mark.django_db
def test_non_privileged_user_cannot_export_summary_pdf(rf, room, learner):
    room.members.add(learner)
    request = rf.get(f"/rooms/{room.code}/summary/export/")
    request.user = learner
    response = views.export_summary_pdf(request, room.code)

    assert response.status_code == 403

@pytest.mark.django_db
def test_summary_endpoint_blocks_non_member(rf, room, other_user):
    request = rf.get(f"/rooms/{room.code}/summary/")
    request.user = other_user
    response = views.session_summary(request, room.code)
    assert response.status_code == 403


@pytest.mark.django_db
def test_export_summary_requires_final_answer(rf, room, facilitator):
    room.members.add(facilitator)
    room.activity_run_id = uuid.uuid4()
    room.save()
    request = rf.get(f"/rooms/{room.code}/summary/export/")
    request.user = facilitator
    response = views.export_summary_pdf(request, room.code)

    assert response.status_code == 400