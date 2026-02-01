import json

from django.contrib.auth import login
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.shortcuts import render
from django.utils.crypto import get_random_string
from django.utils.text import slugify
from django.views.decorators.csrf import csrf_exempt


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
	role = (payload.get("role") or "").strip()

	if not display_name:
		return JsonResponse({"detail": "display_name is required"}, status=400)
	if role and role not in {"learner", "facilitator"}:
		return JsonResponse({"detail": "role is invalid"}, status=400)

	base = slugify(display_name) or "user"
	username = f"{base}-{get_random_string(6)}"
	user = User(username=username, first_name=display_name, last_name=role)
	user.set_unusable_password()
	user.save()

	login(request, user)

	return JsonResponse(
		{
			"id": user.id,
			"username": user.username,
			"display_name": user.first_name,
			"role": user.last_name,
		}
	)
