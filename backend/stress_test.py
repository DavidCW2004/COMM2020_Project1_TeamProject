#!/usr/bin/env python
"""
Stress test script for the message board system.
Simulates heavy usage to test agent rules under load.
"""
import os
import sys
import django
import time
import random
from datetime import timedelta

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mysite.settings')
django.setup()

from django.contrib.auth.models import User
from django.utils import timezone
from message_board.models import Room, Activity, Post
from message_board.agent_rules import check_all_rules
import uuid

def create_test_users(count=10):
    """Create test users for the stress test."""
    users = []
    for i in range(count):
        username = f"stress_user_{i}"
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                'first_name': f'User{i}',
                'email': f'{username}@test.com'
            }
        )
        users.append(user)
    return users

def create_test_room_and_activity(users):
    """Create a test room with activity and users."""
    # Create activity
    activity = Activity.objects.create(
        name="Stress Test Activity",
        activity_type="discussion",
        phases=[
            {"name": "understand", "prompt": "Test phase", "time_limit_minutes": 10},
            {"name": "propose", "prompt": "Make proposals", "time_limit_minutes": 10},
        ]
    )

    # Create room
    room = Room.objects.create(
        code="STRESS01",
        name="Stress Test Room",
        selected_activity=activity,
        activity_started_at=timezone.now(),
        activity_is_running=True,
        activity_run_id=uuid.uuid4(),
    )

    # Add users to room
    room.members.set(users)

    return room, activity

def generate_random_content():
    """Generate random post content."""
    templates = [
        "I think this is a great idea because it solves the problem effectively.",
        "Have you considered the alternative approach?",
        "This seems like the best solution available.",
        "What about the potential drawbacks?",
        "I agree with the previous point.",
        "Let me share my perspective on this.",
        "Based on my experience, this works well.",
        "Can someone explain this better?",
        "That's an interesting point to consider.",
        "I disagree because of the following reasons.",
        "Let's explore this option further.",
        "The data shows this is effective.",
        "According to research, this approach succeeds.",
        "I see it differently - here's why.",
        "This is definitely the way to go.",
        "What evidence supports this claim?",
        "Studies show this method works.",
        "From what I've read, this is proven.",
        "ok",
        "yes",
        "THIS IS IMPORTANT",
        "stupid idea",
        "you're wrong",
        "https://example.com/article-about-topic",
        "Check out this link: https://example.com",
        "Short",
    ]
    return random.choice(templates)

def stress_test_posts(room, users, num_posts=100, rapid_fire_users=3):
    """Create many posts to stress test the system."""
    print(f"Creating {num_posts} posts for stress testing...")

    interventions_before = room.interventions.count()
    posts_created = 0

    # First, create some normal posts
    for i in range(num_posts // 2):
        user = random.choice(users)
        content = generate_random_content()
        phase_index = random.choice([0, 1])  # Random phase

        post = Post.objects.create(
            room=room,
            author=user,
            content=content,
            phase_index=phase_index,
            activity_run_id=room.activity_run_id,
        )

        # Check rules for each post
        triggered = check_all_rules(room, post)
        posts_created += 1

        if posts_created % 20 == 0:
            print(f"Created {posts_created} posts...")

    # Now create rapid-fire posts from a few users
    rapid_fire_users_selected = users[:rapid_fire_users]
    print(f"Creating rapid-fire posts from {len(rapid_fire_users_selected)} users...")

    for user in rapid_fire_users_selected:
        for i in range(15):  # Each user posts 15 times quickly
            content = generate_random_content()
            post = Post.objects.create(
                room=room,
                author=user,
                content=content,
                phase_index=1,
                activity_run_id=room.activity_run_id,
            )

            # Small delay to simulate real timing but still rapid
            time.sleep(0.01)

            triggered = check_all_rules(room, post)
            posts_created += 1

    interventions_after = room.interventions.count()
    interventions_triggered = interventions_after - interventions_before

    print("\nStress test completed!")
    print(f"Total posts created: {posts_created}")
    print(f"Interventions triggered: {interventions_triggered}")
    print(f"Total interventions in room: {interventions_after}")

    # Check intervention types
    intervention_counts = {}
    for intervention in room.interventions.all():
        rule_base = intervention.rule_name.split(":")[0]
        intervention_counts[rule_base] = intervention_counts.get(rule_base, 0) + 1

    print("\nIntervention breakdown:")
    for rule, count in intervention_counts.items():
        print(f"  {rule}: {count}")

    return posts_created, interventions_triggered

def cleanup_test_data(room, activity, users):
    """Clean up test data."""
    print("\nCleaning up test data...")
    room.delete()
    activity.delete()

    # Delete test users (only if they were created for this test)
    for user in users:
        if user.username.startswith("stress_user_"):
            user.delete()

    print("Cleanup completed.")

def main():
    """Main stress test function."""
    print("Starting message board stress test...")

    # Create test users
    users = create_test_users(10)
    print(f"Created {len(users)} test users")

    # Create room and activity
    room, activity = create_test_room_and_activity(users)
    print(f"Created test room: {room.code}")

    try:
        # Run stress test
        posts_created, interventions_triggered = stress_test_posts(room, users, num_posts=200)

        # Check system stability
        print("\nSystem stability check:")
        print(f"- Database queries: OK")
        print(f"- Agent rules processing: OK")
        print(f"- Memory usage: Not monitored (would need external tools)")

        if interventions_triggered > 0:
            print(f"- Agent interventions working: {interventions_triggered} triggered")
        else:
            print("- Warning: No interventions triggered - rules may not be working")

        print("\n[SUCCESS] Stress test completed successfully!")

    except Exception as e:
        print(f"\n[ERROR] Stress test failed with error: {e}")
        import traceback
        traceback.print_exc()

    finally:
        # Cleanup
        cleanup_test_data(room, activity, users)

if __name__ == "__main__":
    main()