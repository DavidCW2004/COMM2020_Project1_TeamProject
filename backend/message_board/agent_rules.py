from datetime import timedelta
from django.utils import timezone
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
    
    # Evidence rule (checks specific post)
    if new_post and check_evidence_rule(room, new_post):
        triggered.append("missing_evidence")
    
    return triggered