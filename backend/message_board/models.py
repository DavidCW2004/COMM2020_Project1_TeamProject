from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.conf import settings


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

    members = models.ManyToManyField(User, related_name="rooms", blank=True)

    selected_activity = models.ForeignKey("Activity", null=True, blank=True, on_delete=models.SET_NULL)
    activity_started_at = models.DateTimeField(null=True, blank=True)
    activity_is_running = models.BooleanField(default=False)
    activity_run_id = models.UUIDField(null=True, blank=True, editable=False)


    def __str__(self):
        return self.code
    
class RoomMember(models.Model):
    room = models.ForeignKey("Room", on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("room", "user")

class Post(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="posts")
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    phase_index = models.IntegerField(null=True, blank=True)
    lacks_evidence = models.BooleanField(default=False)
    activity_run_id = models.UUIDField(null=True, blank=True, db_index=True)


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
    activity_type = models.CharField(max_length=50, choices=ACTIVITY_TYPES, default='discussion')
    phases = models.JSONField(default=list)
    created_at = models.DateTimeField(default=timezone.now, blank=True, null=True)
    
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
    explanation = models.TextField(blank=True)  
    created_at = models.DateTimeField(auto_now_add=True)
    phase_index = models.IntegerField(null=True, blank=True)
    activity_run_id = models.UUIDField(null=True, blank=True, db_index=True)

    
    def __str__(self):
        return f'{self.agent.name} in {self.room.code}: {self.rule_name}'



class EvidenceNudgeState(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    phase_index = models.IntegerField(null=True, blank=True)
    flagged_count = models.IntegerField(default=0)
    last_nudged_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("room", "user", "phase_index")
    def __str__(self):
        return f'EvidenceNudgeState: {self.room.code} - {self.user.username} - Phase {self.phase_index}'