import json
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt # not used but allows for csrf exemption if needed
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

# Imports the code from message_board so no need to rewrite code
from message_board.models import Activity, Room, SessionSummary, Post
from message_board.serializers import ActivitySerializer
from message_board.summary_service import generate_summary
from message_board.pdf_generator import generate_summary_pdf # Not used yet but may be used for generating pdf's later (maybe in manage session summary)
from .serializers import FacilitatorAgentSerializer
from message_board.models import Agent

PRIVILEGED_ROLES = {"facilitator", "maintainer"} #centralize the privledfge role chceks


def _get_role(user):
    if not user.is_authenticated:
        return None
    profile = getattr(user, "profile", None)
    return getattr(profile, "role", None)

def _is_privileged(user):
    return _get_role(user) in PRIVILEGED_ROLES

def _is_maintainer(user):
    return _get_role(user) == "maintainer"


# Allows the facilitator to create and edit activities
class FacilitatorActivityViewSet(viewsets.ModelViewSet):
    queryset = Activity.objects.all().order_by('-created_at')
    serializer_class = ActivitySerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        if not _is_privileged(request.user):
            return Response({"detail": "Facilitator or maintainer access required."}, status=status.HTTP_403_FORBIDDEN) #leaners cant create activies
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not _is_maintainer(request.user):
            return Response({"detail": "Maintainer access required."}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not _is_maintainer(request.user):
            return Response({"detail": "Maintainer access required."}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class FacilitatorAgentViewSet(viewsets.ModelViewSet):
    queryset = Agent.objects.all().order_by("name")
    serializer_class = FacilitatorAgentSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch"]

    def list(self, request, *args, **kwargs):
        if not _is_privileged(request.user):
            return Response({"detail": "Facilitator or maintainer access required."}, status=status.HTTP_403_FORBIDDEN)
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        if not _is_privileged(request.user):
            return Response({"detail": "Facilitator or maintainer access required."}, status=status.HTTP_403_FORBIDDEN)
        return super().retrieve(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if not _is_maintainer(request.user):
            return Response({"detail": "Maintainer access required."}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs) #toggle if its active orr not

# Where the facilitator can view all rooms
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def facilitator_dashboard_stats(request):
    if not _is_privileged(request.user):
        return JsonResponse({"detail": "Facilitator or maintainer access required"}, status=403)

    rooms = Room.objects.all()
    room_data = []

    for room in rooms: # Loops through all the rooms and returns the data in JSON
        room_data.append({
            "code": room.code,
            "name": room.name,
            "active_participants": room.members.count(),
            "is_running": room.activity_is_running,
            "current_activity": room.selected_activity.name if room.selected_activity else "None",
            "post_count": Post.objects.filter(room=room, activity_run_id=room.activity_run_id).count()
        })

    return JsonResponse({"rooms": room_data}, safe=False)

# Revies and generates session summaries
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def manage_session_summary(request, room_code):
    if not _is_privileged(request.user):
        return JsonResponse({"detail": "Facilitator or maintainer access required"}, status=403)

    try: #checks for rooms existence
        room = Room.objects.get(code=room_code.upper())
    except Room.DoesNotExist:
        return JsonResponse({"detail": "Room not found"}, status=404)

    activity_run_id = request.GET.get("activity_run_id") or room.activity_run_id
    
    if not activity_run_id:
        return JsonResponse({"detail": "No active or past run found"}, status=404)

    # Allows facilitator to edit a summary
    if request.method == 'POST':
        summary = generate_summary(room, activity_run_id)
        return JsonResponse({"detail": "Summary regenerated", "id": summary.id})

    # Allows faciliatior to view a summary
    try:
        summary = SessionSummary.objects.get(room=room, activity_run_id=activity_run_id)
        return JsonResponse({
            "participation": summary.participation_data,
            "quality": summary.quality_data,
            "process": summary.process_data,
            "outcomes": summary.extracted_content
        })
    except SessionSummary.DoesNotExist: # If summary does not yet exist
        return JsonResponse({"detail": "Summary not yet generated"}, status=404)
    

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def export_facilitator_summary_pdf(request, room_code):
    if not _is_privileged(request.user):
        return JsonResponse({"detail": "Facilitator or maintainer access required"}, status=403)

    try:
        room = Room.objects.get(code=room_code.upper())
    except Room.DoesNotExist:
        return JsonResponse({"detail": "Room not found"}, status=404)

    activity_run_id = request.GET.get("activity_run_id") or room.activity_run_id
    if not activity_run_id:
        return JsonResponse({"detail": "No active or past run found"}, status=404)

    summary, created = SessionSummary.objects.get_or_create(
        room=room,
        activity_run_id=activity_run_id,
        defaults={},
    )
    if created:
        generate_summary(room, activity_run_id)
        summary = SessionSummary.objects.get(room=room, activity_run_id=activity_run_id)

    pdf_bytes = generate_summary_pdf(summary, room)

    filename = f"session_summary_{room.code}_{activity_run_id}.pdf"
    resp = HttpResponse(pdf_bytes, content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    return resp
