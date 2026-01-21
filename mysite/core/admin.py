from django.contrib import admin

from .models import Message, Reply


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
	list_display = ("title", "display_author", "created_at")
	search_fields = ("title", "body", "author_name", "user__username")
	ordering = ("-created_at",)


@admin.register(Reply)
class ReplyAdmin(admin.ModelAdmin):
	list_display = ("message", "display_author", "created_at")
	search_fields = ("body", "author_name", "user__username")
	ordering = ("-created_at",)
