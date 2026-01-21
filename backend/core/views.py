from django.contrib.auth.models import User
from django.shortcuts import render


def home(request):
	context = {
		"user_count": User.objects.count(),
	}
	return render(request, "core/home.html", context)
