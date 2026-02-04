import json
from django.http import JsonResponse
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

# Allows the facilitator to create and edit activities
class FacilitatorActivityViewSet(viewsets.ModelViewSet):
    queryset = Activity.objects.all().order_by('-created_at')
    serializer_class = ActivitySerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        if request.user.last_name != "facilitator": # Checks if the user is a facilitator
            return Response({"detail": "Only facilitators can create activities."}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if request.user.last_name != "facilitator":
            return Response({"detail": "Only facilitators can edit activities."}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

# Where the facilitator can view all rooms
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def facilitator_dashboard_stats(request):
    if request.user.last_name != "facilitator":
        return JsonResponse({"detail": "Facilitator access required"}, status=403)

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
    if request.user.last_name != "facilitator":
        return JsonResponse({"detail": "Facilitator access required"}, status=403)

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