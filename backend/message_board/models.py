from django.db import models
from django.contrib.auth.models import User


class Room(models.Model):
    code = models.CharField(max_length=12, unique=True)
    name = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    activity = models.ForeignKey('Activity', on_delete=models.CASCADE, null=True, blank=True, related_name='rooms')
    current_phase = models.CharField(max_length=50, default='understand', choices=[
        ("understand", "Understand"),
        ("propose", "Propose"),
        ("critique", "Critique"),
        ("decide", "Decide"),
    ])

    members = models.ManyToManyField(User, related_name="rooms", blank=True)  # ✅ add this

    def __str__(self):
        return self.code

class Post(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="posts")
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.room.code} - {self.author.username}: {self.content[:20]}'
    
class Activity(models.Model):
    ACTIVITY_TYPES = [
        ('problem-solving', 'Problem-Solving'),
        ('discussion', 'Discussion'),
        ('design critique', 'Design Critique'),
    ]
    
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    activity_type = models.CharField(max_length=50, choices=ACTIVITY_TYPES)
    phases = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.name
    
class Agent(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return self.name

class Intervention(models.Model):
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name='interventions')
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='interventions')
    rule_name = models.CharField(max_length=100)
    message = models.TextField()
    explanation = models.TextField(blank=True)  # "Why am I seeing this?"
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f'{self.agent.name} in {self.room.code}: {self.rule_name}'
    

