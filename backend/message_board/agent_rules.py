from datetime import timedelta
from django.utils import timezone
from django.db.models import Count
from .models import Room, Post, Agent, Intervention


def check_inactivity_rule(room):
    """
    Rule: No messages in the last 2 minutes
    Agent: Facilitator
    Trigger: Prompt participation
    """
    two_minutes_ago = timezone.now() - timedelta(minutes=2)
    # If the room has no posts yet, don't prompt immediately
    last_post = Post.objects.filter(room=room).order_by('-created_at').first()
    if not last_post:
        return False

    # Only prompt if the last post is older than 2 minutes
    if last_post.created_at <= two_minutes_ago:
        agent = Agent.objects.get(name="Facilitator Agent")
        explanation = "No one has posted in the last 2 minutes. The Facilitator is encouraging participation."
        message = "It's been quiet—let's hear from someone who hasn't shared yet!"

        # Check if we already triggered this rule recently to avoid spam
        recent_intervention = Intervention.objects.filter(
            agent=agent,
            room=room,
            rule_name="inactivity_2min",
            created_at__gte=two_minutes_ago
        ).exists()

        if not recent_intervention:
            Intervention.objects.create(
                agent=agent,
                room=room,
                rule_name="inactivity_2min",
                message=message,
                explanation=explanation
            )
            return True
    return False


def check_individual_inactivity_rule(room):
    """
    Rule: Specific users haven't participated in the last 3 minutes
    Agent: Facilitator
    Trigger: Personalized prompt to inactive users
    """
    three_minutes_ago = timezone.now() - timedelta(minutes=3)
    
    # Get all room members
    room_members = room.members.all()
    
    # Get users who posted in the last 3 minutes
    active_users = Post.objects.filter(
        room=room,
        created_at__gte=three_minutes_ago
    ).values_list('author', flat=True).distinct()
    
    # Find inactive users
    inactive_users = room_members.exclude(id__in=active_users)
    
    if not inactive_users.exists():
        return False
    
    # Create interventions for each inactive user
    try:
        agent = Agent.objects.get(name="Facilitator Agent")
    except Agent.DoesNotExist:
        return False
    
    triggered = False
    
    for user in inactive_users:
        # Check if we already triggered this rule recently for this user
        recent_intervention = Intervention.objects.filter(
            agent=agent,
            room=room,
            rule_name="individual_inactivity",
            created_at__gte=three_minutes_ago
        ).exists()
        
        if not recent_intervention:
            explanation = f"User {user.username} hasn't posted in the last 3 minutes."
            message = f"Hi {user.first_name or user.username}, we'd love to hear your thoughts!"
            
            Intervention.objects.create(
                agent=agent,
                room=room,
                rule_name="individual_inactivity",
                message=message,
                explanation=explanation
            )
            triggered = True
    
    return triggered


def check_equity_rule(room):
    """
    Rule: Unequal participation between users in current phase
    Agent: Equity
    Trigger: Encourage participation from underrepresented voices
    """
    posts = Post.objects.filter(room=room)
    
    if posts.count() < 3:
        return False
    
    # Count messages per user in this room
    user_message_counts = posts.values('author__username', 'author__first_name', 'author__id').annotate(
        count=Count('id')
    ).order_by('-count')
    
    # Calculate average messages per user
    total_messages = posts.count()
    total_users = room.members.count()
    
    if total_users < 2:
        return False
    
    expected_average = total_messages / total_users
    
    # Find users with significantly fewer messages (less than 50% of average)
    participation_threshold = expected_average * 0.5
    
    try:
        agent = Agent.objects.get(name="Equity Agent")
    except Agent.DoesNotExist:
        return False
    
    triggered = False
    posted_users_ids = set(user_message_counts.values_list('author__id', flat=True))
    
    # Check all room members
    for member in room.members.all():
        member_post_count = posts.filter(author=member).count()
        
        # Trigger if user hasn't posted or has posted significantly less
        if member_post_count < participation_threshold:
            # Check if we recently triggered this for this user to avoid spam
            recent_intervention = Intervention.objects.filter(
                agent=agent,
                room=room,
                rule_name="unequal_participation",
                created_at__gte=timezone.now() - timedelta(minutes=5)
            ).filter(message__contains=member.username).exists()
            
            if not recent_intervention:
                # Calculate their percentage of total messages
                percentage = (member_post_count / total_messages * 100) if total_messages > 0 else 0
                expected_percentage = (100 / total_users)
                
                explanation = f"{member.username} has posted {member_post_count} messages ({percentage:.0f}% of total), below the expected {expected_percentage:.0f}% for equal participation."
                message = f"{member.first_name or member.username}, we notice you've been quiet. Your perspective is important—please share your thoughts!"
                
                Intervention.objects.create(
                    agent=agent,
                    room=room,
                    rule_name="unequal_participation",
                    message=message,
                    explanation=explanation
                )
                triggered = True
    
    return triggered


def check_evidence_rule(room, post):
    """
    Rule: User posts a claim without evidence keywords
    Agent: Socratic
    Trigger: Ask for supporting evidence
    """
    evidence_keywords = ['because', 'research', 'study', 'data', 'evidence', 'shows', 'according to']
    has_evidence = any(keyword in post.content.lower() for keyword in evidence_keywords)
    
    # Simple heuristic: if message is >= 20 chars and has no evidence keywords, flag it
    if len(post.content) >= 20 and not has_evidence:
        try:
            agent = Agent.objects.get(name="Socratic Agent")
        except Agent.DoesNotExist:
            return False
            
        explanation = f"This message appears to make a claim without supporting evidence. The Socratic Agent is asking for clarification."
        message = f"Interesting point, {post.author.first_name}! Can you share what evidence or reasoning supports that idea?"
        
        Intervention.objects.create(
            agent=agent,
            room=room,
            rule_name="missing_evidence",
            message=message,
            explanation=explanation
        )
        return True
    return False


def check_all_rules(room, new_post=None):
    """
    Check all agent rules for a given room.
    Call this after a new message is posted or periodically.
    """
    triggered = []
    
    # Inactivity rule (checks room state)
    if check_inactivity_rule(room):
        triggered.append("inactivity_2min")
    
    # Individual inactivity rule (checks per-user participation)
    if check_individual_inactivity_rule(room):
        triggered.append("individual_inactivity")
    
    # Equity rule (checks participation balance across users)
    if check_equity_rule(room):
        triggered.append("unequal_participation")
    
    # Evidence rule (checks specific post)
    if new_post and check_evidence_rule(room, new_post):
        triggered.append("missing_evidence")
    
    return triggered