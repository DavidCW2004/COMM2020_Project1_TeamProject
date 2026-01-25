import json

from django.http import JsonResponse
from django.utils.crypto import get_random_string
from django.views.decorators.csrf import csrf_exempt
from rest_framework import viewsets

from .models import Post, Room, Intervention
from .serializers import PostSerializer
from .agent_rules import check_all_rules, check_inactivity_rule

class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all().order_by('-created_at')
    serializer_class = PostSerializer


@csrf_exempt
def rooms(request):
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON"}, status=400)

    action = (payload.get("action") or "").strip()
    if action == "create":
        name = (payload.get("name") or "").strip()
        code = get_random_string(6).upper()
        room = Room.objects.create(code=code, name=name)
        return JsonResponse({"code": room.code, "name": room.name})

    if action == "join":
        code = (payload.get("code") or "").strip().upper()
        if not code:
            return JsonResponse({"detail": "code is required"}, status=400)
        try:
            room = Room.objects.get(code=code)
        except Room.DoesNotExist:
            return JsonResponse({"detail": "Room not found"}, status=404)
        return JsonResponse({"code": room.code, "name": room.name})

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

    if request.method == "GET":
        # Run inactivity rule on fetch to allow time-based prompts even without new posts
        check_inactivity_rule(room)

        posts = Post.objects.filter(room=room).order_by("created_at")
        interventions = Intervention.objects.filter(room=room).order_by("created_at")
        
        # Combine posts and interventions
        messages_data = []
        for post in posts:
            messages_data.append({
                "type": "post",
                "id": post.id,
                "content": post.content,
                "author": post.author.first_name or post.author.username,
                "created_at": post.created_at.isoformat(),
            })
        
        for intervention in interventions:
            messages_data.append({
                "type": "intervention",
                "id": intervention.id,
                "content": intervention.message,
                "author": intervention.agent.name,
                "explanation": intervention.explanation,
                "rule_name": intervention.rule_name,
                "created_at": intervention.created_at.isoformat(),
            })
        
        # Sort by timestamp
        messages_data.sort(key=lambda x: x["created_at"])
        
        return JsonResponse(messages_data, safe=False)

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

    post = Post.objects.create(room=room, author=request.user, content=content)
    check_all_rules(room, post)
    return JsonResponse(PostSerializer(post).data, status=201)