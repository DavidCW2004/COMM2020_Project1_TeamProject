from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

class UserProfile(models.Model):
    ROLE_CHOICES = [
        ("learner", "Learner"),
        ("facilitator", "Facilitator"),
        ("maintainer", "Maintainer"),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="learner")

    def __str__(self):
        return f"{self.user.username} - {self.role}"

class Room(models.Model):
    code = models.CharField(max_length=12, unique=True)
    name = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_rooms",
    )

    is_private = models.BooleanField(default=False)
    password_hash = models.CharField(max_length=128, blank=True, default="") 

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
    agent_settings = models.JSONField(default=dict, blank=True)
    
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

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="received_interventions",
        null=True,
        blank=True,
        db_index=True,
    )

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


class SessionSummary(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='summaries')
    activity_run_id = models.UUIDField(db_index=True)
    activity = models.ForeignKey(Activity, on_delete=models.SET_NULL, null=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    activity_started_at = models.DateTimeField(null=True, blank=True)
    activity_ended_at = models.DateTimeField(null=True, blank=True)

    # Computed summary data stored as JSON for flexibility
    participation_data = models.JSONField(default=dict)  # Per-user stats
    process_data = models.JSONField(default=dict)        # Phase timing, interventions
    quality_data = models.JSONField(default=dict)        # Rubric flags
    extracted_content = models.JSONField(default=dict)   # Decisions, action items, questions

    class Meta:
        unique_together = ('room', 'activity_run_id')
        ordering = ['-created_at']

    def __str__(self):
        return f'Summary for {self.room.code} - {self.activity_run_id}'


class FinalAnswerSelection(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="final_answer_selections")
    activity_run_id = models.UUIDField(db_index=True)
    post = models.ForeignKey("Post", on_delete=models.CASCADE)
    finalized_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("room", "activity_run_id")

    def __str__(self):
        return f'FinalAnswerSelection: {self.room.code} - {self.activity_run_id}'


class FinalAnswerVote(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE)
    activity_run_id = models.UUIDField(db_index=True)
    post = models.ForeignKey("Post", on_delete=models.CASCADE, related_name="final_answer_votes")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("room", "activity_run_id", "user")

    def __str__(self):
        return f'FinalAnswerVote: {self.post_id} - {self.user_id}'
    

User = get_user_model()

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if hasattr(instance, "profile"):
        instance.profile.save()