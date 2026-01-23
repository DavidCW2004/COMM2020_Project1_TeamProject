import json

from django.http import JsonResponse
from django.utils.crypto import get_random_string
from django.views.decorators.csrf import csrf_exempt
from rest_framework import viewsets

from .models import Post, Room
from .serializers import PostSerializer # You would create this file to convert data to JSON

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
        posts = Post.objects.filter(room=room).order_by("created_at")
        data = PostSerializer(posts, many=True).data
        return JsonResponse(data, safe=False)

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
    return JsonResponse(PostSerializer(post).data, status=201)