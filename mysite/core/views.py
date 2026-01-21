from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404, redirect, render

from .forms import MessageForm, ReplyForm
from .models import Message


def home(request):
	context = {
		"user_count": User.objects.count(),
	}
	return render(request, "core/home.html", context)


def message_list(request):
	if request.method == "POST":
		form = MessageForm(request.POST)
		if form.is_valid():
			message = form.save(commit=False)
			if request.user.is_authenticated:
				message.user = request.user
			message.save()
			return redirect("message_detail", message_id=message.id)
	else:
		form = MessageForm()

	messages = Message.objects.order_by("-created_at")
	return render(
		request,
		"core/message_list.html",
		{
			"messages": messages,
			"form": form,
		},
	)


def message_detail(request, message_id):
	message = get_object_or_404(Message, id=message_id)

	if request.method == "POST":
		form = ReplyForm(request.POST)
		if form.is_valid():
			reply = form.save(commit=False)
			reply.message = message
			if request.user.is_authenticated:
				reply.user = request.user
			reply.save()
			return redirect("message_detail", message_id=message.id)
	else:
		form = ReplyForm()

	replies = message.replies.order_by("created_at")
	return render(
		request,
		"core/message_detail.html",
		{
			"message": message,
			"replies": replies,
			"form": form,
		},
	)
