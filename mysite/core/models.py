from django.conf import settings
from django.db import models


class Message(models.Model):
	user = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name="messages",
	)
	author_name = models.CharField(max_length=100, blank=True)
	title = models.CharField(max_length=200)
	body = models.TextField()
	created_at = models.DateTimeField(auto_now_add=True)

	def display_author(self):
		if self.user:
			return self.user.username
		return self.author_name or "Anonymous"

	def __str__(self):
		return self.title


class Reply(models.Model):
	message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name="replies")
	user = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name="replies",
	)
	author_name = models.CharField(max_length=100, blank=True)
	body = models.TextField()
	created_at = models.DateTimeField(auto_now_add=True)

	def display_author(self):
		if self.user:
			return self.user.username
		return self.author_name or "Anonymous"

	def __str__(self):
		return f"Reply to {self.message_id}"
