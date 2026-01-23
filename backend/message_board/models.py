from django.db import models
from django.contrib.auth.models import User


class Room(models.Model):
    code = models.CharField(max_length=12, unique=True)
    name = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.code

class Post(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="posts")
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.room.code} - {self.author.username}: {self.content[:20]}'