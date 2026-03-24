from datetime import timedelta
from django.utils import timezone
from django.db.models import Count
from .models import Post, Agent, Intervention, RoomMember, EvidenceNudgeState
import re
from urllib.parse import urlparse

from copy import deepcopy

DEFAULT_AGENT_SETTINGS = {
    "equity": {
        "enabled": True,
        "participation_gap": 2,
        "cooldown_seconds": 300,
        "minimum_phase_posts": 3,
    },
    "inactivity": {
        "enabled": True,
        "idle_seconds": 120,
        "cooldown_seconds": 120,
        "join_grace_seconds": 120,
    },
    "evidence": {
        "enabled": True,
        "unsupported_claims_before_nudge": 3,
        "min_interval_seconds": 90,
    },
    "rapid_fire": {
        "enabled": True,
        "threshold": 10,
        "window_seconds": 60,
        "cooldown_seconds": 180,
    },
    "dominant_speaker": {
        "enabled": True,
        "threshold": 3,
        "cooldown_seconds": 300,
    },
    "source_diversity": {
        "enabled": True,
        "threshold": 2,
        "cooldown_seconds": 180,
    },
    "echo_chamber": {
        "enabled": True,
        "window_size": 6,
        "cooldown_seconds": 180,
        "agreement_ratio": 0.75,
    },
    "inclusivity": {
        "enabled": True,
        "window_size": 6,
        "cooldown_seconds": 180,
    },
    "short_message": {
        "enabled": True,
        "min_length": 10,
        "cooldown_seconds": 300,
    },
    "unanswered_question": {
        "enabled": True,
        "timeout_seconds": 60,
        "cooldown_seconds": 600,
    },
    "link_context": {
        "enabled": True,
        "min_length": 30,
        "cooldown_seconds": 60,
    },
}

def get_activity_agent_settings(room):
    activity = getattr(room, "selected_activity", None) or getattr(room, "activity", None)
    raw = getattr(activity, "agent_settings", {}) or {}

    merged = deepcopy(DEFAULT_AGENT_SETTINGS)

    for key, defaults in merged.items():
        raw_value = raw.get(key, {})
        if isinstance(raw_value, dict):
            defaults.update(raw_value)

    return merged

def get_agent_config(room, key: str) -> dict:
    return get_activity_agent_settings(room).get(key, {})

def phase_posts(room, phase_index=None):
    qs = Post.objects.filter(room=room, activity_run_id=room.activity_run_id)
    if phase_index is None:
        qs = qs.filter(phase_index__isnull=True)
    else:
        qs = qs.filter(phase_index=phase_index)
    return qs

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

#echo chamber thresholds
DEBATE_WINDOW_SIZE = 6 #number of messages to look back on for echo chamber rule
DEBATE_COOLDOWN = timedelta(minutes=3)
AGREEMENT_KEYWORDS = [ #keywords for agreement/good debate
    "agree", "yes", "exactly", "definitely", "correct", 
    "right", "totally", "i think so too", "same here"
]
DEBATE_KEYWORDS = [
    "but", "however", "disagree", "although", "unless", "alternative", "counter",
    "on the other hand", "i see it differently", "i dont think so",
    "not necessarily"
]

#rapid fire thresholds
RAPID_FIRE_THRESHOLD = 10
RAPID_FIRE_WINDOW = timedelta(seconds=60)
RAPID_FIRE_COOLDOWN = timedelta(minutes=3)

#inclusivity thresholds
TURN_TAKING_WINDOW = 6
TURN_TAKING_COOLDOWN = timedelta(minutes=3)

#link context thresholds
LINK_CONTECT_MIN_LENGTH = 30
LINK_CONTEXT_COOLDOWN = timedelta(minutes=1)

#Emotive language keywords
TOXICITY_KEYWORDS = [
    "stupid", "dumb", "clueless", "idiot", "shut up", "wrong", 
    "ridiculous", "nonsense", "ignore", "whatever"
]
DISMISSIVE_PHRASES = [
    "you don't know", "you're wrong", "stop talking", "not true"
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
    
def get_phase_started_at(room, phase_index):
    activity = getattr(room, "selected_activity", None) or getattr(room, "activity", None)
    if not activity or room.activity_started_at is None or phase_index is None:
        return None

    phases = activity.phases or []
    if phase_index < 0 or phase_index >= len(phases):
        return room.activity_started_at

    cumulative = 0
    for idx, ph in enumerate(phases):
        if idx == phase_index:
            return room.activity_started_at + timedelta(seconds=cumulative)

        duration_minutes = float(ph.get("time_limit_minutes") or 0)
        duration = int(duration_minutes * 60) or 60
        cumulative += duration

    return room.activity_started_at

def check_individual_inactivity_rule(room, phase_index=None):
    from .views import get_activity_state

    state = get_activity_state(room)
    if state.get("finished", False) or state.get("is_paused", False):
        return False

    cfg = get_agent_config(room, "inactivity")
    if not cfg.get("enabled", True):
        return False

    now = timezone.now()
    threshold = timedelta(seconds=int(cfg.get("idle_seconds", 120)))
    cooldown = timedelta(seconds=int(cfg.get("cooldown_seconds", 120)))
    join_grace = timedelta(seconds=int(cfg.get("join_grace_seconds", 120)))

    members_qs = room.members.all()
    if not members_qs.exists():
        return False

    phase_started_at = get_phase_started_at(room, phase_index)
    if phase_started_at and now - phase_started_at < join_grace:
        return False

    threshold_time = now - threshold
    active_user_ids = set(
        phase_posts(room, phase_index=phase_index)
        .filter(created_at__gte=threshold_time)
        .values_list("author_id", flat=True)
        .distinct()
    )

    agent = _agent(
        "Facilitator Agent",
        "Encourages quieter members to participate."
    )

    cooldown_since = now - cooldown
    triggered = False

    for user in members_qs:
        if user.id in active_user_ids:
            continue

        membership, _ = RoomMember.objects.get_or_create(room=room, user=user)
        if now - membership.joined_at < join_grace:
            continue

        rule_name = f"individual_inactivity:user={user.id}"

        if _recent(room, agent, rule_name, cooldown_since, phase_index, recipient=user):
            continue

        _create(
            room=room,
            agent=agent,
            rule_name=rule_name,
            message=f"Hi {user.first_name or user.username} — we’d love your thoughts when you’re ready.",
            explanation=f"{user.username} hasn’t posted in the last {int(threshold.total_seconds() // 60)} minutes in this phase.",
            phase_index=phase_index,
            recipient=user,
        )
        triggered = True

    return triggered


def check_equity_rule(room, phase_index=None) -> bool:
    cfg = get_agent_config(room, "equity")
    if not cfg.get("enabled", True):
        return False

    posts = phase_posts(room, phase_index=phase_index)
    minimum_phase_posts = int(cfg.get("minimum_phase_posts", 3))
    if posts.count() < minimum_phase_posts:
        return False

    total_users = room.members.count()
    if total_users < 2:
        return False

    participation_gap = int(cfg.get("participation_gap", 2))
    cooldown = timedelta(seconds=int(cfg.get("cooldown_seconds", 300)))

    counts_by_user = {
        member.id: posts.filter(author=member).count()
        for member in room.members.all()
    }

    if not counts_by_user:
        return False

    max_count = max(counts_by_user.values())

    agent = _agent(
        "Equity Agent",
        "Encourages balanced participation and underrepresented voices."
    )

    cooldown_since = timezone.now() - cooldown
    triggered = False

    for member in room.members.all():
        member_count = counts_by_user.get(member.id, 0)
        if (max_count - member_count) < participation_gap:
            continue

        rule_name = f"unequal_participation:user={member.id}"
        if _recent(room, agent, rule_name, cooldown_since, phase_index, recipient=member):
            continue

        explanation = (
            f"{member.username} has {member_count} messages this phase, "
            f"which is {max_count - member_count} behind the most active participant."
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
    cfg = get_agent_config(room, "evidence")
    if not cfg.get("enabled", True):
        return False

    if not message_lacks_evidence(post.content):
        return False

    agent = _agent(
        "Evidence Agent",
        "Encourages evidence-based reasoning and clearer support for claims."
    )

    state, _ = EvidenceNudgeState.objects.get_or_create(
        room=room,
        user=post.author,
        phase_index=post.phase_index,
        defaults={"flagged_count": 0, "last_nudged_at": None},
    )

    state.flagged_count += 1

    now = timezone.now()
    nudge_every = int(cfg.get("unsupported_claims_before_nudge", 3))
    min_interval = timedelta(seconds=int(cfg.get("min_interval_seconds", 90)))

    due_by_count = (state.flagged_count % nudge_every == 0)
    due_by_time = (state.last_nudged_at is None) or (now - state.last_nudged_at >= min_interval)

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
    cfg = get_agent_config(room, "dominant_speaker")
    if not cfg.get("enabled", True):
        return False

    threshold = int(cfg.get("threshold", DOMINANT_SPEAKER_THRESHOLD))
    cooldown = timedelta(seconds=int(cfg.get("cooldown_seconds", int(DOMINANT_SPEAKER_COOLDOWN.total_seconds()))))

    # if the same user posts multiple messages in a row they get a nudge
    posts = phase_posts(room, phase_index=phase_index).order_by('-created_at')
    if posts.count() < threshold:
        return False

    recent_posts = list(posts[:threshold])
    if len(recent_posts) < threshold:
        return False

    first_author = recent_posts[0].author
    if not all(p.author == first_author for p in recent_posts):
        return False

    agent = _agent("Equity Agent", "Encourages balanced participation and underrepresented voices.")
    rule_name = f"dominant_speaker:user={first_author.id}"
    cooldown_since = timezone.now() - cooldown

    if _recent(room, agent, rule_name, cooldown_since, phase_index, recipient=first_author):
        return False

    explanation = f"{first_author.username} has posted {threshold} consecutive messages. Encouraging turn-taking."
    message = "Let's pause and hear from others before continuing — collaborative learning works best when everyone contributes!"

    _create(room, agent, rule_name, message, explanation, phase_index, recipient=first_author)
    return True



def check_unanswered_question_rule(room, phase_index=None) -> bool:
    cfg = get_agent_config(room, "unanswered_question")
    if not cfg.get("enabled", True):
        return False

    now = timezone.now()
    timeout = timedelta(seconds=int(cfg.get("timeout_seconds", int(UNANSWERED_QUESTION_TIMEOUT.total_seconds()))))
    cooldown = timedelta(seconds=int(cfg.get("cooldown_seconds", int(UNANSWERED_QUESTION_COOLDOWN.total_seconds()))))

    threshold_time = now - timeout

    question_posts = phase_posts(room, phase_index=phase_index).filter(
    content__contains='?',
    created_at__lte=threshold_time,
    ).order_by('created_at')

    agent = _agent("Socratic Agent", "Encourages evidence-based reasoning and clearer support for claims.")
    cooldown_since = now - cooldown
    triggered = False

    for question_post in question_posts:
        later_posts = phase_posts(room, phase_index=phase_index).filter(
            created_at__gt=question_post.created_at,
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
    cfg = get_agent_config(room, "short_message")
    if not cfg.get("enabled", True):
        return False

    min_length = int(cfg.get("min_length", SHORT_MESSAGE_LENGTH))
    cooldown = timedelta(seconds=int(cfg.get("cooldown_seconds", int(SHORT_MESSAGE_COOLDOWN.total_seconds()))))

    # send nudge if too short, maybe needs to be fixed
    content = (post.content or "").strip()
    if len(content) >= min_length:
        return False

    agent = _agent("Facilitator Agent", "Encourages quieter members to participate.")
    rule_name = f"short_message:user={post.author.id}"
    cooldown_since = timezone.now() - cooldown

    if _recent(room, agent, rule_name, cooldown_since, post.phase_index, recipient=post.author):
        return False

    explanation = f"Message was very brief ({len(content)} characters). Encouraging more substantive contributions."
    message = "Quick responses are fine, but can you add a bit more detail or reasoning to help the discussion?"

    _create(room, agent, rule_name, message, explanation, post.phase_index, recipient=post.author)
    return True


def check_source_diversity_rule(room, phase_index=None) -> bool:
    cfg = get_agent_config(room, "source_diversity")
    if not cfg.get("enabled", True):
        return False

    threshold = int(cfg.get("threshold", DOMAIN_DIVERSITY_THRESHOLD))
    cooldown = timedelta(seconds=int(cfg.get("cooldown_seconds", int(DOMAIN_DIVERSITY_COOLDOWN.total_seconds()))))

    agent = _agent("Evidence Agent", "Encourages using a variety of source locations to enrich discussions and remove potential bias.")
    rule_name = f"source_diversity_check"

    cooldown_since = timezone.now() - cooldown
    if _recent(room, agent, rule_name, cooldown_since, phase_index): #checks cooldown before going through any more logic
        return False

    posts_with_links = phase_posts(room, phase_index=phase_index).filter(
        content__icontains="http"
    )

    if posts_with_links.count() < threshold: #checks if the amount of posts is less than the threshold
        return False
    
    domain_counts = {}
    url_pattern = r'https?://[^\s]+'

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
        if count >= threshold:
            overused_domains.append(domain)
    
    if not overused_domains:
        return False
    
    if len(overused_domains) == 1: #changes the message based on the amount of overused domains
        domains_text = f"'{overused_domains[0]}'"
    else:
        domains_text = ", ".join(f"'{d}'" for d in overused_domains[:-1]) + f", and '{overused_domains[-1]}'"
    
    explanation = f"The domain(s) {domains_text} have been cited {threshold} or more times in this phase, which may limit the diversity of perspectives."
    message = f"Let's try to include sources from a wider variety of places to enrich our discussion and get different perspectives!"

    _create(room, agent, rule_name, message, explanation, phase_index)
    return True


def check_echo_chamber_rule(room, phase_index=None) -> bool:
    cfg = get_agent_config(room, "echo_chamber")
    if not cfg.get("enabled", True):
        return False

    window_size = int(cfg.get("window_size", DEBATE_WINDOW_SIZE))
    cooldown = timedelta(seconds=int(cfg.get("cooldown_seconds", int(DEBATE_COOLDOWN.total_seconds()))))
    agreement_ratio = float(cfg.get("agreement_ratio", 0.75))

    agent = _agent("Socratic Agent", "Encourages learners to challange each others ideas.")
    rule_name = "check_echo_chamber"

    cooldown_since = timezone.now() - cooldown
    if _recent(room, agent, rule_name, cooldown_since, phase_index): #checks cooldown before going through any more logic
        return False

    recent_posts = phase_posts(room, phase_index=phase_index).order_by('-created_at')[:window_size]

    if recent_posts.count() < window_size: #checks if there are enough posts to check the rule
        return False
    
    posts_text = [p.content.lower() for p in recent_posts] #makes the list of posts all lower case for easier checks against keywords

    has_debate = any(any(k in text for k in DEBATE_KEYWORDS) for text in posts_text) #checks if there is any debate keywords in the posts
    has_questions = any("?" in text for text in posts_text) #checks if there are any questions in the posts, could indicate healthy debate

    if has_debate or has_questions:
        return False
    
    agreement_count = sum(any(k in text for k in AGREEMENT_KEYWORDS) for text in posts_text) #counts how many of the posts have agreement keywords
    if agreement_count < (window_size * agreement_ratio): #if theres not a strong agreement then its likely there isnt an echo chamber
        return False
    
    explanation = f"The last {window_size} messages contain high agreement levels, indicating an echo chamber."
    message = f"There seems to be a lot of agreement here! Lets try to test your ideas, what might be on the other side of this argument?"
    
    _create(room, agent, rule_name, message, explanation, phase_index)
    return True


def check_rapid_fire_rule(room, phase_index=None) -> bool:
    cfg = get_agent_config(room, "rapid_fire")
    if not cfg.get("enabled", True):
        return False

    threshold = int(cfg.get("threshold", RAPID_FIRE_THRESHOLD))
    window = timedelta(seconds=int(cfg.get("window_seconds", int(RAPID_FIRE_WINDOW.total_seconds()))))
    cooldown = timedelta(seconds=int(cfg.get("cooldown_seconds", int(RAPID_FIRE_COOLDOWN.total_seconds()))))

    agent = _agent("Facilitator Agent", "Maintains a steady pace and encourages deeper thinking.")
    rule_name = "check_rapid_fire"

    cooldown_since = timezone.now() - cooldown
    if _recent(room, agent, rule_name, cooldown_since, phase_index):
        return False

    window_start = timezone.now() - window
    recent_count = phase_posts(room, phase_index=phase_index).filter(
        created_at__gte=window_start
    ).count()

    if recent_count < threshold:
        return False
    
    explanation = f"Group posted {recent_count} messages in the last {window.seconds // 60} minutes, this may indicate a rapid pace hindering deeper thinking."
    message = f"Let's slow down a bit to give everyone time to reflect and engage more deeply with the discussion!"
    
    _create(room, agent, rule_name, message, explanation, phase_index)
    return True


def check_inclusivity_rule(room, phase_index=None) -> bool:
    cfg = get_agent_config(room, "inclusivity")
    if not cfg.get("enabled", True):
        return False

    window_size = int(cfg.get("window_size", TURN_TAKING_WINDOW))
    cooldown = timedelta(seconds=int(cfg.get("cooldown_seconds", int(TURN_TAKING_COOLDOWN.total_seconds()))))

    agent = _agent("Equity Agent", "Encourages balanced participation and prevents dominant sub groups forming")
    rule_name = "check_inclusivity"

    cooldown_since = timezone.now() - cooldown
    if _recent(room, agent, rule_name, cooldown_since, phase_index):
        return False

    recent_posts = phase_posts(room, phase_index=phase_index).order_by('-created_at')[:window_size]

    if recent_posts.count() < window_size:
        return False
    
    authors = set(p.author for p in recent_posts)
    if len(authors) != 2: #if more than two people are speaking then the conversation is inclusive, if only one is speaking then dominant speaker rule will intervene 
        return False
    
    all_members = set(room.members.all())
    quiet_members = all_members - authors

    quiet_names = [m.first_name or m.username for m in quiet_members]

    if not quiet_members: #if there is only two people in the room then this rule will not intervene
        return False
    
    if len(quiet_names) == 1:
        invite_text = f"what does {quiet_names[0]} think about this?"
    else:
        invite_text = f"what do {', '.join(quiet_names[:-1])} and {quiet_names[-1]} think about this?"
    
    explanation = f"The last {window_size} posts were only between {list(authors)[0]} and {list(authors)[1]}."
    message = f"This is a great conversation between the two of you, lets get everyone involved, {invite_text}"
    _create(room, agent, rule_name, message, explanation, phase_index)
    return True


def check_source_context_rule(room, post) -> bool:
    cfg = get_agent_config(room, "link_context")
    if not cfg.get("enabled", True):
        return False

    min_length = int(cfg.get("min_length", LINK_CONTECT_MIN_LENGTH))
    cooldown = timedelta(seconds=int(cfg.get("cooldown_seconds", int(LINK_CONTEXT_COOLDOWN.total_seconds()))))

    agent = _agent("Evidence Agent", "Encourages leaners to give context when sharing linke to help others evaluate the source")
    rule_name = f"source_context"

    cool_down_since = timezone.now() - cooldown
    if _recent(room, agent, rule_name, cool_down_since, post.phase_index, recipient=post.author):
        return False
    
    content = (post.content or "").strip() #defines content as an empty string incase somehow an empty message was sent
    urls = re.findall(r'https?[^\s]+', content)
    if not urls:
        return False
    
    for url in urls: #removes all the urls from the post
        content = content.replace(url, "")

    content = content.strip() #second strip to ensure no spaces left after removing the urls remain
    if len(content) >= min_length:
        return False
    
    explanation = f"User provided a link but only {len(content)} characters of context, threshold is {min_length}"
    message = f"Thanks for sharing the link, to help the group could you please add a bit more context to the source."

    _create(room, agent, rule_name, message, explanation, post.phase_index, recipient=post.author)
    return True


def check_rude_message_rule(room, post) -> bool:
    agent = _agent("Equity Agent", "Promotes respectful and constructive communication.")
    rule_name = f"rude_message:user={post.author.id}"

    #no cooldown for this agent since this must be checked with every message and should get flagged everytime even if flags occur in a short time span

    content = (post.content or "").strip()
    is_shouting = content.isupper() and len(content) > 5

    content = content.lower()
    has_toxic_word = any(k in content for k in TOXICITY_KEYWORDS)
    has_dismissive_phrase = any(p in content for p in DISMISSIVE_PHRASES)

    if not (has_toxic_word or has_dismissive_phrase or is_shouting):
        return False
    
    explanation = f"Message contains potentially hostile, dismissive language or excessive capitilisation."
    message = f"Hi {post.author.first_name or post.author.username} lets try keep the conversation constructive"

    _create(room, agent, rule_name, message, explanation, post.phase_index, recipient=post.author)
    return True




#the check rules functions have been split for better performance and to allow regular checks on room/phase rules

def check_room_state_rules(room, phase_index=None):
    from .views import get_activity_state

    state = get_activity_state(room)
    if state.get("finished", False) or state.get("is_paused", False):
        return []

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
    if check_echo_chamber_rule(room, phase_index=phase_index):
        triggered.append("echo_chamber")
    if check_inclusivity_rule(room, phase_index=phase_index):
        triggered.append("inclusivity rule")

    return triggered

def check_post_rules(room, post): #only checks rules that apply to posts
    triggered = []
    
    if check_evidence_rule(room, post):
        triggered.append("missing_evidence")
    if check_short_message_rule(room, post):
        triggered.append("short_message")
    if check_rapid_fire_rule(room, phase_index=post.phase_index):
        triggered.append("rapid_fire")
    if check_source_context_rule(room, post):
        triggered.append("lacking_source_context")
    if check_rude_message_rule(room, post):
        triggered.append("Possible_rude_message")
        
    return triggered

def check_all_rules(room, new_post=None): #checks both post rules and room/phase rules, put in for backwards compatibilty
    phase_index = getattr(new_post, "phase_index", None)
    
    triggered = check_room_state_rules(room, phase_index=phase_index)
    
    if new_post:
        triggered += check_post_rules(room, new_post)
        
    return triggered

