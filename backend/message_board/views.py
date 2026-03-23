import json
import uuid
from django.http import JsonResponse, HttpResponse
from django.utils.crypto import get_random_string
from django.views.decorators.csrf import csrf_exempt
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import timedelta
from django.db.models import Count
from django.contrib.auth.hashers import make_password, check_password
from django.db import transaction

from .models import (
    Post,
    Room,
    Intervention,
    Activity,
    RoomMember,
    SessionSummary,
    FinalAnswerSelection,
    FinalAnswerVote,
)
from .serializers import PostSerializer, ActivitySerializer
from .agent_rules import (
    check_room_state_rules,
    check_post_rules,
    message_lacks_evidence,
)

PRIVILEGED_ROLES = {"facilitator"}


def _get_role(user):
    if not user.is_authenticated:
        return None
    profile = getattr(user, "profile", None)
    return getattr(profile, "role", None)


def _is_privileged(user):
    return _get_role(user) in PRIVILEGED_ROLES


class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all().order_by("-created_at")
    serializer_class = PostSerializer


class ActivityViewSet(viewsets.ModelViewSet):
    queryset = Activity.objects.all()
    serializer_class = ActivitySerializer
    permission_classes = [IsAuthenticated]


@csrf_exempt
def rooms(request):
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    if request.method == "GET":
        qs = (
            Room.objects.annotate(members_count=Count("members"))
            .filter(members_count__gt=0)
            .order_by("-created_at")
        )

        data = []
        for r in qs:
            state = get_activity_state(r)

            data.append(
                {
                    "code": r.code,
                    "name": r.name,
                    "members_count": r.members_count,
                    "is_running": state.get("is_running", False),
                    "is_paused": state.get("is_paused", False),
                    "finished": state.get("finished", False),
                    "selected_activity": (
                        {
                            "id": r.selected_activity.id,
                            "name": r.selected_activity.name,
                        }
                        if r.selected_activity
                        else None
                    ),
                    "created_at": r.created_at.isoformat(),
                }
            )

        return JsonResponse(data, safe=False, status=200)
    
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON"}, status=400)

    action = (payload.get("action") or "").strip().lower()

    if action == "create":
        name = (payload.get("name") or "").strip()
        if not name:
            return JsonResponse({"detail": "name is required"}, status=400)

        is_private = bool(payload.get("is_private", False))
        password = (payload.get("password") or "").strip()

        if is_private and len(password) < 4:
            return JsonResponse({"detail": "password must be at least 4 characters for private rooms"}, status=400)

        code = get_random_string(6).upper()
        while Room.objects.filter(code=code).exists():
            code = get_random_string(6).upper()

        room = Room.objects.create(
            code=code,
            name=name,
            created_by=request.user,
            is_private=is_private,
            password_hash=make_password(password) if is_private else "",
        )

        room.members.add(request.user)
        RoomMember.objects.get_or_create(room=room, user=request.user)

        return JsonResponse(
            {
                "code": room.code,
                "name": room.name,
                "is_private": room.is_private,
                "members_count": room.members.count(),
            },
            status=201,
        )

    if action == "join":
        code = (payload.get("code") or "").strip().upper()
        if not code:
            return JsonResponse({"detail": "code is required"}, status=400)

        try:
            room = Room.objects.get(code=code)
        except Room.DoesNotExist:
            return JsonResponse({"detail": "Room not found"}, status=404)

        if room.is_private:
            password = (payload.get("password") or "").strip()
            if not password:
                return JsonResponse({"detail": "password is required for this room"}, status=400)

            if not room.password_hash or not check_password(password, room.password_hash):
                return JsonResponse({"detail": "incorrect password"}, status=403)

        already_member = room.members.filter(id=request.user.id).exists()
        room.members.add(request.user)
        RoomMember.objects.get_or_create(room=room, user=request.user)

        return JsonResponse(
            {
                "code": room.code,
                "name": room.name,
                "is_private": room.is_private,
                "joined": not already_member,
                "members_count": room.members.count(),
            },
            status=200,
        )

    return JsonResponse({"detail": "Invalid action"}, status=400)


@csrf_exempt
def messages(request):
    room_code = (request.GET.get("room") or "").strip().upper()
    if not room_code:
        return JsonResponse({"detail": "room is required"}, status=400)

    try:
        room = Room.objects.get(code=room_code)
    except Room.DoesNotExist:
        return JsonResponse({"detail": "Room not found"}, status=404)

    state = get_activity_state(room)

    phase_param = request.GET.get("phase")
    if phase_param is not None and phase_param != "":
        try:
            phase_index = int(phase_param)
        except ValueError:
            return JsonResponse({"detail": "phase must be an integer"}, status=400)
    elif (state.get("is_running") or state.get("is_paused")) and not state.get("finished", False):
        phase_index = state.get("phase_index")
    else:
        phase_index = None

    if request.method == "GET":
        check_room_state_rules(room, phase_index=phase_index)

        posts_qs = Post.objects.filter(
            room=room,
            phase_index=phase_index,
            activity_run_id=room.activity_run_id,
        ).order_by("created_at")

        interventions_qs = Intervention.objects.filter(
            room=room,
            phase_index=phase_index,
            activity_run_id=room.activity_run_id,
            recipient=request.user,
        ).order_by("created_at")

        messages_data = []

        for post in posts_qs:
            messages_data.append(
                {
                    "type": "post",
                    "id": post.id,
                    "content": post.content,
                    "author": post.author.first_name or post.author.username,
                    "created_at": post.created_at.isoformat(),
                    "phase_index": post.phase_index,
                    "lacks_evidence": post.lacks_evidence,
                }
            )

        for intervention in interventions_qs:
            messages_data.append(
                {
                    "type": "intervention",
                    "id": intervention.id,
                    "content": intervention.message,
                    "author": intervention.agent.name,
                    "explanation": intervention.explanation,
                    "rule_name": intervention.rule_name,
                    "created_at": intervention.created_at.isoformat(),
                    "phase_index": intervention.phase_index,
                }
            )

        messages_data.sort(key=lambda x: x["created_at"])

        return JsonResponse(
            {
                "room": room.code,
                "phase_index": phase_index,
                "activity": {
                    "is_running": state.get("is_running", False),
                    "finished": state.get("finished", False),
                    "is_paused": state.get("is_paused", False),
                    "activity_id": state.get("activity_id"),
                    "activity_name": state.get("activity_name"),
                    "activity_run_id": str(room.activity_run_id) if room.activity_run_id else None,
                    "phase_name": state.get("phase_name"),
                    "phase_prompt": state.get("phase_prompt"),
                    "phase_ends_at": state.get("phase_ends_at"),
                    "total_phases": state.get("total_phases"),
                },
                "messages": messages_data,
            }
        )

    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    if state.get("is_paused", False):
        return JsonResponse({"detail": "Activity is paused"}, status=403)

    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON"}, status=400)

    content = (payload.get("content") or "").strip()
    if not content:
        return JsonResponse({"detail": "content is required"}, status=400)

    post = Post.objects.create(
        room=room,
        author=request.user,
        content=content,
        phase_index=phase_index,
        activity_run_id=room.activity_run_id,
        lacks_evidence=message_lacks_evidence(content),
    )

    check_post_rules(room, post)
    return JsonResponse(PostSerializer(post).data, status=201)


@csrf_exempt
def room_members(request, code):
    if request.method != "GET":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    try:
        room = Room.objects.get(code=code.strip().upper())
    except Room.DoesNotExist:
        return JsonResponse({"detail": "Room not found"}, status=404)

    members = room.members.all().order_by("first_name", "username")
    data = [{"id": u.id, "name": (u.first_name or u.username)} for u in members]
    return JsonResponse(data, safe=False)


@csrf_exempt
def room_detail(request, code):
    if request.method != "GET":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    code = (code or "").strip().upper()

    try:
        room = Room.objects.get(code=code)
    except Room.DoesNotExist:
        return JsonResponse({"detail": "Room not found"}, status=404)

    state = get_activity_state(room)

    return JsonResponse(
        {
            "code": room.code,
            "name": room.name,
            "is_member": room.members.filter(id=request.user.id).exists(),
            "selected_activity": (
                {"id": room.selected_activity.id, "name": room.selected_activity.name}
                if room.selected_activity
                else None
            ),
            "is_private": room.is_private,
            "created_by": (
                {
                    "id": room.created_by.id,
                    "name": room.created_by.first_name or room.created_by.username,
                }
                if room.created_by else None
            ),
            "activity": {
                "is_running": state.get("is_running", False),
                "finished": state.get("finished", False),
                "activity_id": state.get("activity_id"),
                "activity_name": state.get("activity_name"),
                "phase_index": state.get("phase_index"),
                "phase_name": state.get("phase_name"),
                "phase_prompt": state.get("phase_prompt"),
                "phase_ends_at": state.get("phase_ends_at"),
                "total_phases": state.get("total_phases"),
                "is_paused": state.get("is_paused", False),
                "phase_override_active": state.get("phase_override_active", False),
            },
        },
        status=200,
    )


@csrf_exempt
def start_activity(request, code):
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    code = (code or "").strip().upper()

    try:
        room = Room.objects.get(code=code)
    except Room.DoesNotExist:
        return JsonResponse({"detail": "Room not found"}, status=404)

    if not room.selected_activity:
        return JsonResponse({"detail": "No activity selected"}, status=400)

    room.activity_is_running = True
    room.activity_started_at = timezone.now()
    room.activity_run_id = uuid.uuid4()
    room.phase_override_index = None  
    room.activity_paused_at = None
    room.save(update_fields=[
        "activity_is_running", "activity_started_at", 
        "activity_run_id", "phase_override_index", "activity_paused_at"
    ])

    return JsonResponse(
        {
            "detail": "Activity started",
            "activity_id": room.selected_activity.id,
            "activity_name": room.selected_activity.name,
            "started_at": room.activity_started_at.isoformat(),
        },
        status=200,
    )


@csrf_exempt
def select_activity(request, code):
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    code = (code or "").strip().upper()

    try:
        room = Room.objects.get(code=code)
    except Room.DoesNotExist:
        return JsonResponse({"detail": "Room not found"}, status=404)

    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON"}, status=400)

    activity_id = payload.get("activity_id")
    if not activity_id:
        return JsonResponse({"detail": "activity_id is required"}, status=400)

    try:
        activity = Activity.objects.get(id=activity_id)
    except Activity.DoesNotExist:
        return JsonResponse({"detail": "Activity not found"}, status=404)

    room.selected_activity = activity
    room.activity_is_running = False
    room.activity_started_at = None
    room.save(update_fields=["selected_activity", "activity_is_running", "activity_started_at"])

    return JsonResponse(
        {"detail": "Activity selected", "activity_id": activity.id, "activity_name": activity.name},
        status=200,
    )


def get_activity_state(room):
    activity = getattr(room, "selected_activity", None)

    if not activity or not getattr(room, "activity_started_at", None):
        return {
            "is_running": False,
            "finished": False,
            "activity_id": activity.id if activity else None,
            "activity_name": activity.name if activity else None,
            "phase_index": None,
            "phase_name": None,
            "phase_prompt": None,
            "phase_ends_at": None,
            "total_phases": len(activity.phases or []) if activity else 0,
            "is_paused": False,
            "phase_override_active": False,
        }

    phases = activity.phases or []
    total_phases = len(phases)

    if total_phases == 0:
        return {
            "is_running": False,
            "finished": True,
            "activity_id": activity.id,
            "activity_name": activity.name,
            "phase_index": None,
            "phase_name": None,
            "phase_prompt": None,
            "phase_ends_at": None,
            "total_phases": 0,
            "is_paused": False,
            "phase_override_active": False,
        }

    is_paused = bool(room.activity_paused_at)
    override_index = room.phase_override_index

    if override_index is not None and override_index >= total_phases:
        return {
            "is_running": False,
            "finished": True,
            "activity_id": activity.id,
            "activity_name": activity.name,
            "phase_index": total_phases - 1,
            "phase_name": phases[-1].get("name"),
            "phase_prompt": phases[-1].get("prompt"),
            "phase_ends_at": None,
            "total_phases": total_phases,
            "is_paused": False,
            "phase_override_active": False,
        }

    if not room.activity_is_running and not is_paused:
        return {
            "is_running": False,
            "finished": False,
            "activity_id": activity.id,
            "activity_name": activity.name,
            "phase_index": None,
            "phase_name": None,
            "phase_prompt": None,
            "phase_ends_at": None,
            "total_phases": total_phases,
            "is_paused": False,
            "phase_override_active": False,
        }

    reference_time = room.activity_paused_at if is_paused else timezone.now()
    elapsed = max(0, (reference_time - room.activity_started_at).total_seconds())

    cumulative = 0
    for idx, ph in enumerate(phases):
        duration_minutes = float(ph.get("time_limit_minutes") or 0)
        duration = int(duration_minutes * 60) or 60
        phase_end = cumulative + duration

        is_this_phase = (idx == override_index) if override_index is not None else (elapsed < phase_end)

        if is_this_phase:
            phase_ends_at = room.activity_started_at + timedelta(seconds=phase_end)
            return {
                "is_running": not is_paused,
                "finished": False,
                "activity_id": activity.id,
                "activity_name": activity.name,
                "phase_index": idx,
                "phase_name": ph.get("name"),
                "phase_prompt": ph.get("prompt"),
                "phase_ends_at": None if is_paused else phase_ends_at.isoformat(),
                "total_phases": total_phases,
                "is_paused": is_paused,
                "phase_override_active": override_index is not None,
            }

        cumulative = phase_end

    finished_at = room.activity_started_at + timedelta(seconds=cumulative)
    return {
        "is_running": False,
        "finished": True,
        "activity_id": activity.id,
        "activity_name": activity.name,
        "phase_index": total_phases - 1,
        "phase_name": phases[-1].get("name"),
        "phase_prompt": phases[-1].get("prompt"),
        "phase_ends_at": finished_at.isoformat(),
        "total_phases": total_phases,
        "is_paused": False,
        "phase_override_active": False,
    }

@csrf_exempt
def session_summary(request, code):
    if request.method != "GET":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    code = (code or "").strip().upper()

    try:
        room = Room.objects.get(code=code)
    except Room.DoesNotExist:
        return JsonResponse({"detail": "Room not found"}, status=404)

    if not room.members.filter(id=request.user.id).exists():
        return JsonResponse({"detail": "Not a member of this room"}, status=403)

    activity_run_id = request.GET.get("activity_run_id") or room.activity_run_id
    if not activity_run_id:
        return JsonResponse({"detail": "No activity run found"}, status=404)

    state = get_activity_state(room)
    if str(activity_run_id) == str(room.activity_run_id):
        if not state.get("finished", False):
            return JsonResponse({"detail": "Activity not yet finished"}, status=400)

    regenerate = request.GET.get("regenerate", "").lower() == "true"

    summary = None
    if not regenerate:
        try:
            summary = SessionSummary.objects.get(room=room, activity_run_id=activity_run_id)
        except SessionSummary.DoesNotExist:
            pass

    if summary is None or regenerate:
        from .summary_service import generate_summary
        summary = generate_summary(room, activity_run_id)

    # Facilitator-only view fields
    is_facilitator = _is_privileged(request.user)

    final_answer = _get_final_answer(room, activity_run_id)
    final_answer_votes = 0
    if final_answer:
        final_answer_votes = FinalAnswerVote.objects.filter(
            room=room, activity_run_id=activity_run_id, post=final_answer.post
        ).count()

    final_answer_data = None
    if final_answer:
        final_answer_data = {
            "id": final_answer.post.id,
            "content": final_answer.post.content,
            "author": final_answer.post.author.first_name or final_answer.post.author.username,
            "created_at": final_answer.post.created_at.isoformat(),
            "finalized_at": final_answer.finalized_at.isoformat() if final_answer.finalized_at else None,
            "votes": final_answer_votes,
            "majority_needed": _get_majority_count(room),
            "is_final": True,
        }

    final_outcome = summary.extracted_content.get("final_outcome")
    if final_answer:
        final_outcome = {
            "content": final_answer.post.content,
            "author": final_answer.post.author.first_name or final_answer.post.author.username,
            "timestamp": final_answer.finalized_at.isoformat() if final_answer.finalized_at else None,
        }

    response_data = {
        "room_code": room.code,
        "room_name": room.name,
        "activity_run_id": str(summary.activity_run_id),
        "activity_name": summary.activity.name if summary.activity else None,
        "created_at": summary.created_at.isoformat(),
        "activity_started_at": summary.activity_started_at.isoformat() if summary.activity_started_at else None,
        "activity_ended_at": summary.activity_ended_at.isoformat() if summary.activity_ended_at else None,
        "decisions": summary.extracted_content.get("decisions", []),
        "action_items": summary.extracted_content.get("action_items", []),
        "unanswered_questions": summary.extracted_content.get("unanswered_questions", []),
        "final_outcome": final_outcome,
        "final_answer": final_answer_data,
        "participation": summary.participation_data,
        "process": summary.process_data
        if is_facilitator
        else {
            "phases": summary.process_data.get("phases", []),
            "total_duration_seconds": summary.process_data.get("total_duration_seconds", 0),
        },
        "quality": summary.quality_data if is_facilitator else None,
        "personal_contribution": _get_personal_contribution(summary.participation_data, request.user.id)
        if not is_facilitator
        else None,
        "is_facilitator": is_facilitator,
    }

    return JsonResponse(response_data)


def _get_personal_contribution(participation_data, user_id):
    members = participation_data.get("members", [])
    for member in members:
        if member.get("user_id") == user_id:
            return {
                "post_count": member.get("post_count", 0),
                "contribution_percentage": member.get("contribution_percentage", 0),
                "lacks_evidence_count": member.get("lacks_evidence_count", 0),
                "posts_by_phase": member.get("posts_by_phase", {}),
            }
    return None


def _get_majority_count(room):
    members_count = room.members.count()
    return (members_count // 2) + 1


def _get_final_answer(room, activity_run_id):
    return (
        FinalAnswerSelection.objects.filter(room=room, activity_run_id=activity_run_id)
        .select_related("post", "post__author")
        .first()
    )


def _get_decide_phase_index(room):
    activity = room.selected_activity
    if not activity or not activity.phases:
        return None
    for idx, phase in enumerate(activity.phases):
        if str(phase.get("name", "")).strip().lower() == "decide":
            return idx
    return None


@csrf_exempt
def export_summary_pdf(request, code):
    if request.method != "GET":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    if not _is_privileged(request.user):
        return JsonResponse({"detail": "Facilitator access required"}, status=403)

    code = (code or "").strip().upper()

    try:
        room = Room.objects.get(code=code)
    except Room.DoesNotExist:
        return JsonResponse({"detail": "Room not found"}, status=404)

    if not room.members.filter(id=request.user.id).exists():
        return JsonResponse({"detail": "Not a member of this room"}, status=403)

    activity_run_id = request.GET.get("activity_run_id") or room.activity_run_id
    if not activity_run_id:
        return JsonResponse({"detail": "No activity run found"}, status=404)

    final_answer = _get_final_answer(room, activity_run_id)
    if not final_answer:
        return JsonResponse(
            {"detail": "Final answer not yet finalized", "majority_needed": _get_majority_count(room)},
            status=400,
        )

    try:
        summary = SessionSummary.objects.get(room=room, activity_run_id=activity_run_id)
    except SessionSummary.DoesNotExist:
        from .summary_service import generate_summary
        summary = generate_summary(room, activity_run_id)

    from .pdf_generator import generate_summary_pdf
    pdf_content = generate_summary_pdf(summary, room, final_answer=final_answer)

    response = HttpResponse(pdf_content, content_type="application/pdf")
    filename = f"session_summary_{room.code}_{summary.created_at.strftime('%Y%m%d')}.pdf"
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


@csrf_exempt
def final_answer(request, code):
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    code = (code or "").strip().upper()
    try:
        room = Room.objects.get(code=code)
    except Room.DoesNotExist:
        return JsonResponse({"detail": "Room not found"}, status=404)

    if not room.members.filter(id=request.user.id).exists():
        return JsonResponse({"detail": "Not a member of this room"}, status=403)

    activity_run_id = request.GET.get("activity_run_id") or room.activity_run_id
    if not activity_run_id:
        return JsonResponse({"detail": "No activity run found"}, status=404)

    state = get_activity_state(room)
    if str(activity_run_id) == str(room.activity_run_id) and not state.get("finished", False):
        return JsonResponse({"detail": "Activity not yet finished"}, status=400)

    decide_phase_index = _get_decide_phase_index(room)
    if decide_phase_index is None:
        return JsonResponse({"detail": "No decide phase configured"}, status=400)

    if request.method == "GET":
        return JsonResponse(_build_final_answer_response(room, activity_run_id, request.user))

    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON"}, status=400)

    action = (payload.get("action") or "").strip().lower()
    if action != "vote":
        return JsonResponse({"detail": "Invalid action"}, status=400)

    post_id = payload.get("post_id")
    if not post_id:
        return JsonResponse({"detail": "post_id is required"}, status=400)

    final_existing = _get_final_answer(room, activity_run_id)
    if final_existing:
        return JsonResponse({"detail": "Final answer already finalized"}, status=400)

    eligible_posts = _get_eligible_final_answer_posts(room, activity_run_id, decide_phase_index)
    post = eligible_posts.filter(id=post_id).first()
    if not post:
        return JsonResponse({"detail": "Post not found"}, status=404)

    with transaction.atomic():
        FinalAnswerVote.objects.update_or_create(
            room=room,
            activity_run_id=activity_run_id,
            user=request.user,
            defaults={"post": post},
        )

        votes_count = FinalAnswerVote.objects.filter(
            room=room,
            activity_run_id=activity_run_id,
            post=post,
        ).count()

        majority_needed = _get_majority_count(room)

        if votes_count >= majority_needed:
            FinalAnswerSelection.objects.get_or_create(
                room=room,
                activity_run_id=activity_run_id,
                defaults={"post": post},
            )

    return JsonResponse(_build_final_answer_response(room, activity_run_id, request.user), status=200)
    
@csrf_exempt
def control_activity(request, code):
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    if not _is_privileged(request.user):
        return JsonResponse({"detail": "Facilitator access required"}, status=403)

    code = (code or "").strip().upper()

    try:
        room = Room.objects.get(code=code)
    except Room.DoesNotExist:
        return JsonResponse({"detail": "Room not found"}, status=404)

    if not room.activity_is_running and not room.activity_paused_at:
        return JsonResponse({"detail": "No activity in progress"}, status=400)

    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON"}, status=400)

    action = (payload.get("action") or "").strip().lower()

    if action == "pause":
        if room.activity_paused_at:
            return JsonResponse({"detail": "Already paused"}, status=400)

        room.activity_paused_at = timezone.now()
        room.save(update_fields=["activity_paused_at"])

    elif action == "resume":
        if not room.activity_paused_at:
            return JsonResponse({"detail": "Not paused"}, status=400)

        pause_duration = timezone.now() - room.activity_paused_at
        room.activity_started_at += pause_duration
        room.activity_paused_at = None
        room.save(update_fields=["activity_started_at", "activity_paused_at"])

    elif action == "advance":
        current_state = get_activity_state(room)
        current_index = current_state.get("phase_index") or 0
        total = current_state.get("total_phases", 0)
        next_index = current_index + 1

        if next_index >= total:
            room.phase_override_index = total
            room.activity_is_running = False
            room.activity_paused_at = None
            room.save(update_fields=["phase_override_index", "activity_is_running", "activity_paused_at"])

            final_state = get_activity_state(room)
            return JsonResponse({
                "detail": "Activity finished",
                "finished": True,
                "state": final_state,
            })

        room.phase_override_index = next_index
        room.save(update_fields=["phase_override_index"])

    elif action == "set_phase":
        phase_index = payload.get("phase_index")
        if phase_index is None:
            return JsonResponse({"detail": "phase_index is required"}, status=400)

        activity = room.selected_activity
        total = len(activity.phases or []) if activity else 0

        try:
            phase_index = int(phase_index)
        except (TypeError, ValueError):
            return JsonResponse({"detail": "phase_index must be an integer"}, status=400)

        if not (0 <= phase_index < total):
            return JsonResponse({"detail": "Invalid phase_index"}, status=400)

        room.phase_override_index = phase_index
        room.save(update_fields=["phase_override_index"])

    else:
        return JsonResponse(
            {"detail": "Invalid action. Use: pause, resume, advance, set_phase"},
            status=400,
        )

    new_state = get_activity_state(room)
    return JsonResponse({"detail": "OK", "state": new_state})

def _get_eligible_final_answer_posts(room, activity_run_id, decide_phase_index):
    eligible_posts = Post.objects.filter(
        room=room,
        activity_run_id=activity_run_id,
        phase_index=decide_phase_index,
    ).select_related("author").order_by("created_at")

    if not eligible_posts.exists():
        eligible_posts = Post.objects.filter(
            room=room,
            activity_run_id=activity_run_id,
            phase_index=max(0, decide_phase_index - 1),
        ).select_related("author").order_by("created_at")

    return eligible_posts


def _build_final_answer_response(room, activity_run_id, request_user):
    final_existing = _get_final_answer(room, activity_run_id)
    decide_phase_index = _get_decide_phase_index(room)

    eligible_posts = _get_eligible_final_answer_posts(room, activity_run_id, decide_phase_index)

    votes = (
        FinalAnswerVote.objects.filter(room=room, activity_run_id=activity_run_id)
        .values("post")
        .annotate(count=Count("id"))
    )
    vote_map = {v["post"]: v["count"] for v in votes}

    user_vote = FinalAnswerVote.objects.filter(
        room=room,
        activity_run_id=activity_run_id,
        user=request_user,
    ).first()

    data = []
    for post in eligible_posts:
        data.append(
            {
                "id": post.id,
                "content": post.content,
                "author": post.author.first_name or post.author.username,
                "created_at": post.created_at.isoformat(),
                "votes": vote_map.get(post.id, 0),
                "is_final": bool(final_existing and final_existing.post_id == post.id),
            }
        )

    return {
        "room_code": room.code,
        "activity_run_id": str(activity_run_id),
        "majority_needed": _get_majority_count(room),
        "final_answer_post_id": final_existing.post_id if final_existing else None,
        "user_vote_post_id": user_vote.post_id if user_vote else None,
        "posts": data,
    }