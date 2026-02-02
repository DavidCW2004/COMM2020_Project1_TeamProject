import json
import uuid
from django.http import JsonResponse
from django.utils.crypto import get_random_string
from django.views.decorators.csrf import csrf_exempt
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
from .models import Post, Room, Intervention, Activity, RoomMember, SessionSummary
from .serializers import PostSerializer, ActivitySerializer
from .agent_rules import check_all_rules, check_individual_inactivity_rule, check_unanswered_question_rule, message_lacks_evidence
from django.utils import timezone




class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all().order_by('-created_at')
    serializer_class = PostSerializer

class ActivityViewSet(viewsets.ModelViewSet):
    queryset = Activity.objects.all()
    serializer_class = ActivitySerializer
    permission_classes = [IsAuthenticated]


@csrf_exempt
def rooms(request):
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON"}, status=400)

    action = (payload.get("action") or "").strip().lower()

    if action == "create":
        name = (payload.get("name") or "").strip()
        if not name:
            return JsonResponse({"detail": "name is required"}, status=400)

        # Ensure unique code (rare collision, but easy to guard)
        code = get_random_string(6).upper()
        while Room.objects.filter(code=code).exists():
            code = get_random_string(6).upper()

        room = Room.objects.create(code=code, name=name)
        room.members.add(request.user)  
        RoomMember.objects.get_or_create(room=room, user=request.user)

        return JsonResponse({
            "code": room.code,
            "name": room.name,
            "members_count": room.members.count(),
        }, status=201)

    if action == "join":
        code = (payload.get("code") or "").strip().upper()
        if not code:
            return JsonResponse({"detail": "code is required"}, status=400)

        try:
            room = Room.objects.get(code=code)
        except Room.DoesNotExist:
            return JsonResponse({"detail": "Room not found"}, status=404)

        already_member = room.members.filter(id=request.user.id).exists()
        room.members.add(request.user)
        RoomMember.objects.get_or_create(room=room, user=request.user)  

        return JsonResponse({
            "code": room.code,
            "name": room.name,
            "joined": not already_member,
            "members_count": room.members.count(),
        }, status=200)

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
    elif state.get("is_running") and not state.get("finished", False):
        phase_index = state.get("phase_index")
    else:
        
        phase_index = None

    if request.method == "GET":
        check_individual_inactivity_rule(room, phase_index=phase_index)
        check_unanswered_question_rule(room, phase_index=phase_index)

        posts_qs = Post.objects.filter(room=room, phase_index=phase_index, activity_run_id=room.activity_run_id).order_by("created_at")
        interventions_qs = Intervention.objects.filter(room=room, phase_index=phase_index, activity_run_id=room.activity_run_id).order_by("created_at")

        messages_data = []

        for post in posts_qs:
            messages_data.append({
                "type": "post",
                "id": post.id,
                "content": post.content,
                "author": post.author.first_name or post.author.username,
                "created_at": post.created_at.isoformat(),
                "phase_index": post.phase_index,
                "lacks_evidence": post.lacks_evidence,

            })

        for intervention in interventions_qs:
            messages_data.append({
                "type": "intervention",
                "id": intervention.id,
                "content": intervention.message,
                "author": intervention.agent.name,
                "explanation": intervention.explanation,
                "rule_name": intervention.rule_name,
                "created_at": intervention.created_at.isoformat(),
                "phase_index": intervention.phase_index,
            })

        messages_data.sort(key=lambda x: x["created_at"])

        
        return JsonResponse({
            "room": room.code,
            "phase_index": phase_index,
            "activity": {
                "is_running": state.get("is_running", False),
                "finished": state.get("finished", False),
                "activity_id": state.get("activity_id"),
                "activity_name": state.get("activity_name"),
                "activity_run_id": str(room.activity_run_id) if room.activity_run_id else None,
                "phase_name": state.get("phase_name"),
                "phase_prompt": state.get("phase_prompt"),
                "phase_ends_at": state.get("phase_ends_at"),
                "total_phases": state.get("total_phases"),
            },
            "messages": messages_data,
        })

    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)

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

    
    check_all_rules(room, post)

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

    return JsonResponse({
        "code": room.code,
        "name": room.name,

        "selected_activity": (
            {"id": room.selected_activity.id, "name": room.selected_activity.name}
            if room.selected_activity else None
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
        }
    }, status=200)



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

    # Start (or restart) the activity
    room.activity_is_running = True
    room.activity_started_at = timezone.now()
    room.activity_run_id = uuid.uuid4()
    room.save(update_fields=["activity_is_running", "activity_started_at", "activity_run_id"])

    return JsonResponse({
        "detail": "Activity started",
        "activity_id": room.selected_activity.id,
        "activity_name": room.selected_activity.name,
        "started_at": room.activity_started_at.isoformat(),
    }, status=200)

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

    return JsonResponse({
        "detail": "Activity selected",
        "activity_id": activity.id,
        "activity_name": activity.name,
    }, status=200)

def get_activity_state(room):
    if not getattr(room, "selected_activity", None) or not getattr(room, "activity_is_running", False) or not getattr(room, "activity_started_at", None):
        return {
            "is_running": False,
            "finished": False,
            "activity_id": room.selected_activity.id if getattr(room, "selected_activity", None) else None,
            "activity_name": room.selected_activity.name if getattr(room, "selected_activity", None) else None,
        }

    activity = room.selected_activity
    phases = activity.phases or []
    now = timezone.now()
    elapsed = (now - room.activity_started_at).total_seconds()

    t = 0
    for idx, ph in enumerate(phases):
        mins = ph.get("time_limit_minutes") or 0
        duration = mins * 60
        if elapsed < t + duration:
            phase_ends_at = room.activity_started_at + timezone.timedelta(seconds=(t + duration))
            return {
                "is_running": True,
                "finished": False,
                "activity_id": activity.id,
                "activity_name": activity.name,
                "phase_index": idx,
                "phase_name": ph.get("name"),
                "phase_prompt": ph.get("prompt"),
                "phase_ends_at": phase_ends_at.isoformat(),
                "total_phases": len(phases),
            }
        t += duration

    return {
        "is_running": True,
        "finished": True,
        "activity_id": activity.id,
        "activity_name": activity.name,
        "phase_index": len(phases) - 1 if phases else 0,
        "phase_name": phases[-1].get("name") if phases else None,
        "phase_prompt": phases[-1].get("prompt") if phases else None,
        "phase_ends_at": None,
        "total_phases": len(phases),
    }


@csrf_exempt
def session_summary(request, code):
    """
    GET /api/rooms/<code>/summary/
    Returns the session summary for the most recent completed activity.

    Query params:
    - activity_run_id: (optional) Specific activity run to get summary for
    - regenerate: (optional) If "true", regenerate the summary
    """
    if request.method != "GET":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    code = (code or "").strip().upper()

    try:
        room = Room.objects.get(code=code)
    except Room.DoesNotExist:
        return JsonResponse({"detail": "Room not found"}, status=404)

    # Check if user is a member
    if not room.members.filter(id=request.user.id).exists():
        return JsonResponse({"detail": "Not a member of this room"}, status=403)

    # Get activity_run_id from query params or use current room's
    activity_run_id = request.GET.get("activity_run_id") or room.activity_run_id

    if not activity_run_id:
        return JsonResponse({"detail": "No activity run found"}, status=404)

    # Check if activity is finished (only enforce for current run)
    state = get_activity_state(room)
    if str(activity_run_id) == str(room.activity_run_id):
        if not state.get("finished", False):
            return JsonResponse({"detail": "Activity not yet finished"}, status=400)

    # Check if regenerate requested
    regenerate = request.GET.get("regenerate", "").lower() == "true"

    # Try to get existing summary
    summary = None
    if not regenerate:
        try:
            summary = SessionSummary.objects.get(room=room, activity_run_id=activity_run_id)
        except SessionSummary.DoesNotExist:
            pass

    # Generate if needed
    if summary is None or regenerate:
        from .summary_service import generate_summary
        summary = generate_summary(room, activity_run_id)

    # Determine user role for view filtering
    user_role = request.user.last_name  # "learner" or "facilitator"
    is_facilitator = user_role == "facilitator"

    # Build response with role-based filtering
    response_data = {
        "room_code": room.code,
        "room_name": room.name,
        "activity_run_id": str(summary.activity_run_id),
        "activity_name": summary.activity.name if summary.activity else None,
        "created_at": summary.created_at.isoformat(),
        "activity_started_at": summary.activity_started_at.isoformat() if summary.activity_started_at else None,
        "activity_ended_at": summary.activity_ended_at.isoformat() if summary.activity_ended_at else None,

        # Content extraction (visible to all)
        "decisions": summary.extracted_content.get("decisions", []),
        "action_items": summary.extracted_content.get("action_items", []),
        "unanswered_questions": summary.extracted_content.get("unanswered_questions", []),
        "final_outcome": summary.extracted_content.get("final_outcome"),

        # Participation view (visible to all)
        "participation": summary.participation_data,

        # Process view (facilitator gets full details including interventions_by_rule)
        "process": summary.process_data if is_facilitator else {
            "phases": summary.process_data.get("phases", []),
            "total_duration_seconds": summary.process_data.get("total_duration_seconds", 0)
        },

        # Quality checks (facilitator only)
        "quality": summary.quality_data if is_facilitator else None,

        # Personal contribution (for learners only)
        "personal_contribution": _get_personal_contribution(
            summary.participation_data,
            request.user.id
        ) if not is_facilitator else None,

        "is_facilitator": is_facilitator,
    }

    return JsonResponse(response_data)


def _get_personal_contribution(participation_data, user_id):
    """Extract personal contribution stats for a specific user."""
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


@csrf_exempt
def export_summary_pdf(request, code):
    """
    GET /api/rooms/<code>/summary/export/
    Generates and returns a PDF of the session summary.
    Facilitator-only endpoint.
    """
    if request.method != "GET":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    # Check facilitator role
    if request.user.last_name != "facilitator":
        return JsonResponse({"detail": "Facilitator access required"}, status=403)

    code = (code or "").strip().upper()

    try:
        room = Room.objects.get(code=code)
    except Room.DoesNotExist:
        return JsonResponse({"detail": "Room not found"}, status=404)

    # Check if user is a member
    if not room.members.filter(id=request.user.id).exists():
        return JsonResponse({"detail": "Not a member of this room"}, status=403)

    activity_run_id = request.GET.get("activity_run_id") or room.activity_run_id

    if not activity_run_id:
        return JsonResponse({"detail": "No activity run found"}, status=404)

    # Get or generate summary
    try:
        summary = SessionSummary.objects.get(room=room, activity_run_id=activity_run_id)
    except SessionSummary.DoesNotExist:
        from .summary_service import generate_summary
        summary = generate_summary(room, activity_run_id)

    # Generate PDF
    from .pdf_generator import generate_summary_pdf
    pdf_content = generate_summary_pdf(summary, room)

    response = HttpResponse(pdf_content, content_type='application/pdf')
    filename = f"session_summary_{room.code}_{summary.created_at.strftime('%Y%m%d')}.pdf"
    response['Content-Disposition'] = f'attachment; filename="{filename}"'

    return response

