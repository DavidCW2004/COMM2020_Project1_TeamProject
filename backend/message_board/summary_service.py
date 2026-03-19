import re
from django.utils import timezone
from .models import Post, Intervention, Room, SessionSummary


# ============ EXTRACTION PATTERNS (Template-based, no AI) ============

DECISION_INDICATORS = [
    r"\bwe\s+decided\b",
    r"\blet's\s+go\s+with\b",
    r"\bagreed\s+(to|that|on)\b",
    r"\bfinal\s+decision\b",
    r"\bconsensus\s+is\b",
    r"\bour\s+choice\s+is\b",
    r"\bwe('ll|'re going to)\b",
    r"\bmoving\s+forward\s+with\b",
    r"\bchosen\s+solution\b",
    r"\bwe\s+will\b",
]

ACTION_ITEM_INDICATORS = [
    r"\bwill\s+do\b",
    r"\baction\s+item\b",
    r"\btodo\b",
    r"\bnext\s+step(s)?\b",
    r"\bshould\s+(start|do|create|build|write|implement)\b",
    r"\bneed(s)?\s+to\b",
    r"\btask(ed)?\b",
    r"\bassigned\s+to\b",
    r"\bfollow\s+up\b",
]

QUESTION_PATTERN = r"\?[\s]*$"


def generate_summary(room: Room, activity_run_id) -> SessionSummary:
    posts = Post.objects.filter(
        room=room,
        activity_run_id=activity_run_id
    ).select_related('author').order_by('created_at')

    interventions = Intervention.objects.filter(
        room=room,
        activity_run_id=activity_run_id
    ).select_related('agent').order_by('created_at')

    activity = room.selected_activity
    phases = activity.phases if activity else []

    # Compute all data
    participation_data = _compute_participation(room, posts, activity_run_id)
    process_data = _compute_process(posts, interventions, phases, room)
    quality_data = _compute_quality(posts, interventions, phases)
    extracted_content = _extract_content(posts, phases)

    # Create or update summary
    summary, _ = SessionSummary.objects.update_or_create(
        room=room,
        activity_run_id=activity_run_id,
        defaults={
            'activity': activity,
            'activity_started_at': room.activity_started_at,
            'activity_ended_at': timezone.now(),
            'participation_data': participation_data,
            'process_data': process_data,
            'quality_data': quality_data,
            'extracted_content': extracted_content,
        }
    )

    return summary


def _compute_participation(room, posts, activity_run_id):
    members = room.members.all()
    member_stats = []
    total_posts = posts.count()

    for member in members:
        user_posts = posts.filter(author=member)
        post_count = user_posts.count()

        # Count posts by phase
        posts_by_phase = {}
        for post in user_posts:
            phase_key = str(post.phase_index) if post.phase_index is not None else "lobby"
            posts_by_phase[phase_key] = posts_by_phase.get(phase_key, 0) + 1

        lacks_evidence_count = user_posts.filter(lacks_evidence=True).count()

        first_post = user_posts.first()
        last_post = user_posts.last()

        member_stats.append({
            "user_id": member.id,
            "username": member.username,
            "display_name": member.first_name or member.username,
            "post_count": post_count,
            "posts_by_phase": posts_by_phase,
            "contribution_percentage": round((post_count / total_posts * 100), 1) if total_posts > 0 else 0,
            "lacks_evidence_count": lacks_evidence_count,
            "first_post_at": first_post.created_at.isoformat() if first_post else None,
            "last_post_at": last_post.created_at.isoformat() if last_post else None,
        })

    # Calculate turn balance using Gini coefficient
    counts = [s["post_count"] for s in member_stats]
    gini = _calculate_gini(counts)
    turn_balance = 1 - gini  # Invert so 1 = perfectly balanced

    total_interventions = Intervention.objects.filter(
        room=room,
        activity_run_id=activity_run_id
    ).count()

    return {
        "total_posts": total_posts,
        "total_interventions": total_interventions,
        "members": member_stats,
        "turn_balance_score": round(turn_balance, 2),
        "gini_coefficient": round(gini, 2),
    }


def _calculate_gini(values):
    if not values or sum(values) == 0:
        return 0
    sorted_values = sorted(values)
    n = len(sorted_values)
    cumsum = 0
    for i, v in enumerate(sorted_values):
        cumsum += (2 * (i + 1) - n - 1) * v
    return cumsum / (n * sum(sorted_values)) if sum(sorted_values) > 0 else 0


def _compute_process(posts, interventions, phases, room):
    phase_stats = []

    for idx, phase in enumerate(phases):
        phase_posts = posts.filter(phase_index=idx)
        phase_interventions = interventions.filter(phase_index=idx)

        duration = phase.get("time_limit_minutes", 0) * 60

        phase_stats.append({
            "index": idx,
            "name": phase.get("name", f"Phase {idx}"),
            "duration_seconds": duration,
            "post_count": phase_posts.count(),
            "intervention_count": phase_interventions.count(),
        })

    # Count interventions by rule type (extract base rule name)
    rule_counts = {}
    for intervention in interventions:
        # Extract base rule name (remove user-specific suffix like ":user=5")
        rule_base = intervention.rule_name.split(":")[0]
        rule_counts[rule_base] = rule_counts.get(rule_base, 0) + 1

    total_duration = sum(p.get("time_limit_minutes", 0) for p in phases) * 60

    return {
        "phases": phase_stats,
        "interventions_by_rule": rule_counts,
        "total_duration_seconds": total_duration,
    }


def _compute_quality(posts, interventions, phases):
    flags = []
    total_posts = posts.count()

    # Flag 1: Claims without evidence
    lacks_evidence_posts = posts.filter(lacks_evidence=True)
    lacks_evidence_count = lacks_evidence_posts.count()
    evidence_ratio = lacks_evidence_count / total_posts if total_posts > 0 else 0

    flags.append({
        "code": "claims_without_evidence",
        "label": "Claims without evidence",
        "triggered": evidence_ratio > 0.3,  # >30% of posts lack evidence
        "count": lacks_evidence_count,
        "details": f"{lacks_evidence_count} of {total_posts} posts lack supporting evidence"
    })

    # Flag 2: No critique phase used
    critique_phase_idx = None
    for idx, phase in enumerate(phases):
        if phase.get("name", "").lower() == "critique":
            critique_phase_idx = idx
            break

    critique_post_count = 0
    if critique_phase_idx is not None:
        critique_post_count = posts.filter(phase_index=critique_phase_idx).count()

    no_critique = critique_phase_idx is not None and critique_post_count == 0

    flags.append({
        "code": "no_critique_phase",
        "label": "Critique phase underutilized",
        "triggered": no_critique,
        "count": critique_post_count,
        "details": "No messages were posted during the critique phase" if no_critique else f"{critique_post_count} messages in critique phase"
    })

    # Flag 3: Unbalanced participation (based on equity interventions)
    equity_interventions = interventions.filter(rule_name__startswith="unequal_participation")

    flags.append({
        "code": "unbalanced_participation",
        "label": "Unbalanced participation",
        "triggered": equity_interventions.count() >= 2,
        "count": equity_interventions.count(),
        "details": f"{equity_interventions.count()} equity interventions were triggered"
    })

    # Flag 4: Dominant speaker warnings
    dominant_interventions = interventions.filter(rule_name__startswith="dominant_speaker")

    flags.append({
        "code": "dominant_speaker",
        "label": "Dominant speaker patterns",
        "triggered": dominant_interventions.count() >= 1,
        "count": dominant_interventions.count(),
        "details": f"{dominant_interventions.count()} dominant speaker warnings"
    })

    # Flag 5: Unanswered questions remain
    unanswered_interventions = interventions.filter(rule_name__startswith="unanswered_question")

    flags.append({
        "code": "unanswered_questions",
        "label": "Questions left unanswered",
        "triggered": unanswered_interventions.count() >= 2,
        "count": unanswered_interventions.count(),
        "details": f"{unanswered_interventions.count()} unanswered question reminders"
    })

    # Calculate overall score based on triggered flags
    triggered_count = sum(1 for f in flags if f["triggered"])
    if triggered_count == 0:
        overall = "good"
    elif triggered_count <= 2:
        overall = "needs_attention"
    else:
        overall = "concerning"

    return {
        "flags": flags,
        "overall_score": overall
    }


def _extract_content(posts, phases):
    decisions = []
    action_items = []
    unanswered_questions = []
    proposals = []

    # Build phase name mapping
    phase_names = {idx: p.get("name", f"Phase {idx}") for idx, p in enumerate(phases)}

    # Track which posts are questions for answer detection
    question_posts = []

    for post in posts:
        content = post.content
        phase_name = phase_names.get(post.phase_index, "Unknown")
        author_name = post.author.first_name or post.author.username

        # Check for proposals (in "propose" phase)
        if phase_name.lower() == "propose":
            proposals.append({
                "content": content,
                "author": author_name,
                "phase": phase_name,
                "timestamp": post.created_at.isoformat()
            })

        # Check for decisions (especially valuable in "decide" phase)
        for pattern in DECISION_INDICATORS:
            if re.search(pattern, content, re.IGNORECASE):
                decisions.append({
                    "content": content,
                    "author": author_name,
                    "phase": phase_name,
                    "timestamp": post.created_at.isoformat()
                })
                break

        # Check for action items
        for pattern in ACTION_ITEM_INDICATORS:
            if re.search(pattern, content, re.IGNORECASE):
                action_items.append({
                    "content": content,
                    "author": author_name,
                    "timestamp": post.created_at.isoformat()
                })
                break

        # Track questions for unanswered detection
        if re.search(QUESTION_PATTERN, content):
            question_posts.append({
                "post": post,
                "content": content,
                "author": author_name,
                "phase": phase_name
            })

    # Determine unanswered questions (no response from different author after)
    posts_list = list(posts)
    for q in question_posts:
        q_post = q["post"]
        q_idx = posts_list.index(q_post)

        # Check if any later post by a different author exists
        answered = False
        for later_post in posts_list[q_idx + 1:]:
            if later_post.author != q_post.author:
                answered = True
                break

        if not answered:
            unanswered_questions.append({
                "content": q["content"],
                "author": q["author"],
                "timestamp": q_post.created_at.isoformat(),
                "phase": q["phase"]
            })

    # Get final outcome (last substantive message in decide phase)
    decide_phase_idx = None
    for idx, phase in enumerate(phases):
        if phase.get("name", "").lower() == "decide":
            decide_phase_idx = idx
            break

    final_outcome = None
    if decide_phase_idx is not None:
        decide_posts = posts.filter(phase_index=decide_phase_idx).order_by('-created_at')
        if decide_posts.exists():
            last_post = decide_posts.first()
            final_outcome = {
                "content": last_post.content,
                "author": last_post.author.first_name or last_post.author.username,
                "timestamp": last_post.created_at.isoformat()
            }

    return {
        "decisions": decisions,
        "action_items": action_items,
        "unanswered_questions": unanswered_questions,
        "proposals": proposals,
        "final_outcome": final_outcome
    }
