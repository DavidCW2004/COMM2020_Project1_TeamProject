from datetime import timedelta
from django.utils import timezone
from django.db.models import Count
from .models import Post, Agent, Intervention, RoomMember, EvidenceNudgeState
import re
from urllib.parse import urlparse

INDIVIDUAL_INACTIVITY_THRESHOLD = timedelta(minutes=2)
INDIVIDUAL_INACTIVITY_COOLDOWN = timedelta(minutes=2)
JOIN_GRACE_PERIOD = timedelta(minutes=2)
DOMAIN_DIVERSITY_THRESHOLD = 2
DOMAIN_DIVERSITY_COOLDOWN = timedelta(minutes=3)


EQUITY_COOLDOWN = timedelta(minutes=5)

# if these are in a message then theres is evidence
EVIDENCE_KEYWORDS = [
    "because", "research", "study", "data", "evidence", "shows", "according to",
    "http://", "https://", "for example", "for instance", "e.g."
]


CITATION_PATTERNS = [
    r"\[\d+\]",
    r"\(\s*\d{4}\s*\)",  
    r"\bdoi:\s*\S+",     
]

def _agent(name: str, description: str) -> Agent:
    # create the agent if it doessnt't exist yet
    a, _ = Agent.objects.get_or_create(
        name=name,
        defaults={"description": description, "is_active": True},
    )
    return a


def _recent(room, agent: Agent, rule_name: str, since, phase_index, recipient=None):
    # don't nudge if user has been nudged recently
    qs = Intervention.objects.filter(
        room=room,
        agent=agent,
        rule_name=rule_name,
        created_at__gte=since,
        activity_run_id=room.activity_run_id,
    )

    if recipient is None:
        qs = qs.filter(recipient__isnull=True)
    else:
        qs = qs.filter(recipient=recipient)

    if phase_index is None:
        qs = qs.filter(phase_index__isnull=True)
    else:
        qs = qs.filter(phase_index=phase_index)

    return qs.exists()



def _create(room, agent: Agent, rule_name: str, message: str, explanation: str, phase_index, recipient=None):
    # save intervention agent, rule, message, room phase
    if not agent.is_active:
        return

    Intervention.objects.create(
        agent=agent,
        room=room,
        rule_name=rule_name,
        message=message,
        explanation=explanation or "",
        phase_index=phase_index,
        activity_run_id=room.activity_run_id,
        recipient=recipient, 
    )
    
def check_individual_inactivity_rule(room, phase_index=None):
    # if they have not posted within inactivity window nudge them, theres a cooldown if they were nudged recently
    now = timezone.now()

    members_qs = room.members.all()
    if not members_qs.exists():
        return False

    threshold_time = now - INDIVIDUAL_INACTIVITY_THRESHOLD
    active_user_ids = set(
        Post.objects.filter(
            room=room,
            phase_index=phase_index,
            created_at__gte=threshold_time,
        ).values_list("author_id", flat=True).distinct()
    )

    agent = _agent(
        "Facilitator Agent",
        "Encourages quieter members to participate."
    )

    cooldown_since = now - INDIVIDUAL_INACTIVITY_COOLDOWN
    triggered = False

    for user in members_qs:
        if user.id in active_user_ids:
            continue

        membership, _ = RoomMember.objects.get_or_create(room=room, user=user)
        if now - membership.joined_at < JOIN_GRACE_PERIOD:
            continue

        rule_name = f"individual_inactivity:user={user.id}"

        if _recent(room, agent, rule_name, cooldown_since, phase_index, recipient=user):
            continue

        _create(
            room=room,
            agent=agent,
            rule_name=rule_name,
            message=f"Hi {user.first_name or user.username} — we’d love your thoughts when you’re ready.",
            explanation=f"{user.username} hasn’t posted in the last {INDIVIDUAL_INACTIVITY_THRESHOLD.seconds // 60} minutes (this phase).",
            phase_index=phase_index,
            recipient=user,
        )
        triggered = True

    return triggered


def check_equity_rule(room, phase_index=None) -> bool:
    # compare each member post count to threshold that is based on the average message in that phase, nudge members below
    posts = Post.objects.filter(room=room, phase_index=phase_index)
    if posts.count() < 3:
        return False

    total_users = room.members.count()
    if total_users < 2:
        return False

    total_messages = posts.count()
    expected_average = total_messages / total_users
    threshold = expected_average * 0.5

    agent = _agent("Equity Agent", "Encourages balanced participation and underrepresented voices.")

    cooldown_since = timezone.now() - EQUITY_COOLDOWN
    triggered = False

    for member in room.members.all():
        member_count = posts.filter(author=member).count()
        if member_count >= threshold:
            continue

        rule_name = f"unequal_participation:user={member.id}"
        if _recent(room, agent, rule_name, cooldown_since, phase_index, recipient=member):
            continue

        explanation = (
            f"{member.username} has {member_count} messages this phase; "
            f"below the participation threshold ({threshold:.1f})."
        )
        message = f"{member.first_name or member.username}, your perspective would be really valuable here — want to jump in?"

        _create(room, agent, rule_name, message, explanation, phase_index, recipient=member)
        triggered = True

    return triggered

def message_lacks_evidence(text: str) -> bool:
    # flag longer messages that dont have evidence words
    t = (text or "").strip().lower()
    if not t:
        return False
    if "?" in t:
        return False
    if any(ch.isdigit() for ch in t):
        return False

    if any(k in t for k in EVIDENCE_KEYWORDS):
        return False

    if any(re.search(p, t, flags=re.IGNORECASE) for p in CITATION_PATTERNS):
        return False

    return len(t) >= 20

EVIDENCE_NUDGE_EVERY_N_FLAGGED = 3
EVIDENCE_NUDGE_MIN_INTERVAL = timedelta(seconds=90)

DOMINANT_SPEAKER_THRESHOLD = 3
DOMINANT_SPEAKER_COOLDOWN = timedelta(minutes=5)

UNANSWERED_QUESTION_TIMEOUT = timedelta(minutes=1)
UNANSWERED_QUESTION_COOLDOWN = timedelta(minutes=10)

SHORT_MESSAGE_LENGTH = 10
SHORT_MESSAGE_COOLDOWN = timedelta(minutes=5)


def check_evidence_rule(room, post) -> bool:
    # if the user keeps posting stuff without evidence they get nudged
    if not message_lacks_evidence(post.content):
        return False

    agent = _agent("Evidence Agent", "Encourages evidence-based reasoning and clearer support for claims.")

    state, _ = EvidenceNudgeState.objects.get_or_create(
        room=room,
        user=post.author,
        phase_index=post.phase_index,
        defaults={"flagged_count": 0, "last_nudged_at": None},
    )

    state.flagged_count += 1

    now = timezone.now()
    due_by_count = (state.flagged_count % EVIDENCE_NUDGE_EVERY_N_FLAGGED == 0)
    due_by_time = (state.last_nudged_at is None) or (now - state.last_nudged_at >= EVIDENCE_NUDGE_MIN_INTERVAL)

    if not (due_by_count or due_by_time):
        state.save(update_fields=["flagged_count"])
        return False

    state.last_nudged_at = now
    state.save(update_fields=["flagged_count", "last_nudged_at"])

    rule_name = f"missing_evidence:user={post.author.id}"
    explanation = "This message appears to make a claim without supporting evidence (source, data, example, or clear reasoning)."
    message = (
        "Quick reminder: please add evidence or reasoning so others can evaluate the claim.\n\n"
        "Good options:\n"
        "• a source/link\n"
        "• a concrete example\n"
        "• numbers/observations\n"
        "• a clear ‘because…’ explanation"
    )

    _create(
        room=room,
        agent=agent,
        rule_name=rule_name,
        message=message,
        explanation=explanation,
        phase_index=post.phase_index,
        recipient=post.author,
    )

    return True

def check_dominant_speaker_rule(room, phase_index=None) -> bool:
    # if the same user posts multiple messages in a row they get a nudge
    posts = Post.objects.filter(room=room, phase_index=phase_index).order_by('-created_at')
    if posts.count() < DOMINANT_SPEAKER_THRESHOLD:
        return False

    recent_posts = list(posts[:DOMINANT_SPEAKER_THRESHOLD])
    if len(recent_posts) < DOMINANT_SPEAKER_THRESHOLD:
        return False

    first_author = recent_posts[0].author
    if not all(p.author == first_author for p in recent_posts):
        return False

    agent = _agent("Equity Agent", "Encourages balanced participation and underrepresented voices.")
    rule_name = f"dominant_speaker:user={first_author.id}"
    cooldown_since = timezone.now() - DOMINANT_SPEAKER_COOLDOWN

    if _recent(room, agent, rule_name, cooldown_since, phase_index, recipient=first_author):
        return False

    explanation = f"{first_author.username} has posted {DOMINANT_SPEAKER_THRESHOLD} consecutive messages. Encouraging turn-taking."
    message = "Let's pause and hear from others before continuing — collaborative learning works best when everyone contributes!"

    _create(room, agent, rule_name, message, explanation, phase_index, recipient=first_author)
    return True

    return True


def check_unanswered_question_rule(room, phase_index=None) -> bool:
    # find questions older than timeout with no reply and send reminder to reply
    now = timezone.now()
    threshold_time = now - UNANSWERED_QUESTION_TIMEOUT

    question_posts = Post.objects.filter(
        room=room,
        phase_index=phase_index,
        content__contains='?',
        created_at__lte=threshold_time
    ).order_by('created_at')

    agent = _agent("Socratic Agent", "Encourages evidence-based reasoning and clearer support for claims.")
    cooldown_since = now - UNANSWERED_QUESTION_COOLDOWN
    triggered = False

    for question_post in question_posts:
        later_posts = Post.objects.filter(
            room=room,
            phase_index=phase_index,
            created_at__gt=question_post.created_at
        ).exclude(author=question_post.author)

        if later_posts.exists():
            continue

        rule_name = f"unanswered_question:post={question_post.id}"
        if _recent(room, agent, rule_name, cooldown_since, phase_index):
            continue

        minutes_ago = int((now - question_post.created_at).total_seconds() / 60)
        explanation = f"A question was asked {minutes_ago} minutes ago with no response yet."
        message = "There's an open question above — can someone address it before moving on?"

        _create(room, agent, rule_name, message, explanation, phase_index)
        triggered = True
        break

    return triggered


def check_short_message_rule(room, post) -> bool:
    # send nudge if too short, maybe needs to be fixed
    content = (post.content or "").strip()
    if len(content) >= SHORT_MESSAGE_LENGTH:
        return False

    agent = _agent("Facilitator Agent", "Encourages quieter members to participate.")
    rule_name = f"short_message:user={post.author.id}"
    cooldown_since = timezone.now() - SHORT_MESSAGE_COOLDOWN

    if _recent(room, agent, rule_name, cooldown_since, post.phase_index, recipient=post.author):
        return False

    explanation = f"Message was very brief ({len(content)} characters). Encouraging more substantive contributions."
    message = "Quick responses are fine, but can you add a bit more detail or reasoning to help the discussion?"

    _create(room, agent, rule_name, message, explanation, post.phase_index, recipient=post.author)
    return True

def check_source_diversity_rule(room, phase_index=None) -> bool:
    agent = _agent("Evidence Agent", "Encourages using a variety of source locations to enrich discussions and remove potential bias.")
    rule_name = f"source_diversity_check"

    cooldown_since = timezone.now() - DOMAIN_DIVERSITY_COOLDOWN
    if _recent(room, agent, rule_name, cooldown_since, phase_index): #checks cooldown before going through any more logic
        return False

    posts_with_links = Post.objects.filter( #gets all the posts containing a link in the current phase
        room = room,
        phase_index = phase_index,
        content__icontains = "http"
    )

    if posts_with_links.count() < DOMAIN_DIVERSITY_THRESHOLD: #checks if the amount of posts is less than the threshold
        return False
    
    domain_counts = {}
    url_pattern = r'https?://[^\s]+)'

    for post in posts_with_links: #for loop extracts and counts all the domains
        urls = re.findall(url_pattern, post.content)
        for url in urls:
            try:
                domain = urlparse(urls).netloc.lower() #filters the urls to be only the site and makes it all lower case, to diversify source location
                if domain: #checks we aren't getting empty strings
                    domain = domain.replace("www.", "") #gets rid of www. as some links may not have added this
                    domain_counts[domain] = domain_counts.get(domain, 0) + 1 #adds one to the count of the found domain, or add it to the list
            except Exception:
                continue

    overused_domains = [] #create a list to handle two or more overused domains although this is unlikely
    for domain, count in domain_counts.items():
        if count >= DOMAIN_DIVERSITY_THRESHOLD:
            overused_domains.append(domain)
    
    if not overused_domains:
        return False
    
    if len(overused_domains) == 1: #changes the message based on the amount of overused domains
        domains_text = f"'{overused_domains[0]}'"
    else:
        domains_text = ", ".join(f"'{d}'" for d in overused_domains[:-1]) + f", and '{overused_domains[-1]}'"
    
    explanation = f"The domain(s) {domains_text} have been cited {DOMAIN_DIVERSITY_THRESHOLD} or more times in this phase, which may limit the diversity of perspectives."
    message = f"Let's try to include sources from a wider variety of places to enrich our discussion and get different perspectives!"

    _create(room, agent, rule_name, message, explanation, phase_index)
    return True

#the check rules functions have been split for better performance and to allow regular checks on room/phase rules

def check_room_state_rules(room, phase_index=None): #only checks the rules that apply to the whole room/phase
    triggered = []
    
    if check_individual_inactivity_rule(room, phase_index=phase_index):
        triggered.append("individual_inactivity")
    if check_equity_rule(room, phase_index=phase_index):
        triggered.append("unequal_participation")
    if check_dominant_speaker_rule(room, phase_index=phase_index):
        triggered.append("dominant_speaker")
    if check_unanswered_question_rule(room, phase_index=phase_index):
        triggered.append("unanswered_question")
    if check_source_diversity_rule(room, phase_index=phase_index):
        triggered.append("source_diversity")
        
    return triggered

def check_post_rules(room, post): #only checks rules that apply to posts
    triggered = []
    
    if check_evidence_rule(room, post):
        triggered.append("missing_evidence")
    if check_short_message_rule(room, post):
        triggered.append("short_message")
        
    return triggered

def check_all_rules(room, new_post=None): #checks both post rules and room/phase rules
    phase_index = getattr(new_post, "phase_index", None)
    
    triggered = check_room_state_rules(room, phase_index=phase_index)
    
    if new_post:
        triggered += check_post_rules(room, new_post)
        
    return triggered

