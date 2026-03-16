import json
from urllib import request

from django.contrib.auth import login, authenticate
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.shortcuts import render
from django.utils.crypto import get_random_string
from django.utils.text import slugify
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.csrf import ensure_csrf_cookie
from django.middleware.csrf import get_token
from message_board.models import UserProfile

@ensure_csrf_cookie
def csrf(request):
    return JsonResponse({"csrfToken": get_token(request)})


def home(request):
	context = {
		"user_count": User.objects.count(),
	}
	return render(request, "core/home.html", context)


@csrf_exempt
def temp_login(request):
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON"}, status=400)

    display_name = (payload.get("display_name") or "").strip()
    role = (payload.get("role") or "").strip().lower()

    if not display_name:
        return JsonResponse({"detail": "display_name is required"}, status=400)

    if role not in {"learner", "facilitator"}:
        return JsonResponse({"detail": "role is invalid"}, status=400)

    base = slugify(display_name) or "user"
    username = f"{base}-{get_random_string(6)}"

    user = User(username=username, first_name=display_name)
    user.set_unusable_password()
    user.save()

    user.profile.role = role
    user.profile.save()

    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    request.session["temp_user_id"] = user.id
    request.session.modified = True

    return JsonResponse(
        {
            "id": user.id,
            "username": user.username,
            "display_name": user.first_name,
            "role": user.profile.role,
        }
    )

