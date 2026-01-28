import json
import uuid
from django.http import JsonResponse
from django.utils.crypto import get_random_string
from django.views.decorators.csrf import csrf_exempt
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Post, Room, Intervention, Activity, RoomMember
from .serializers import PostSerializer, ActivitySerializer
from .agent_rules import check_all_rules, check_individual_inactivity_rule, message_lacks_evidence
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

        # Optional: enforce a name
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
    room.save(update_fields=["activity_is_running", "activity_started_at"])

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

