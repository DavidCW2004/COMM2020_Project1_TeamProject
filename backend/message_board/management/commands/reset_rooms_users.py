from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from message_board.models import (
    EvidenceNudgeState,
    Intervention,
    Post,
    Room,
    RoomMember,
    SessionSummary,
)


class Command(BaseCommand):
    help = "Delete all rooms and users (optionally keep superusers)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Skip the confirmation prompt.",
        )
        parser.add_argument(
            "--delete-superusers",
            action="store_true",
            help="Also delete superusers (default is to keep them).",
        )

    def handle(self, *args, **options):
        delete_superusers = options["delete_superusers"]
        skip_confirm = options["yes"]

        User = get_user_model()

        rooms_count = Room.objects.count()
        users_qs = User.objects.all()
        if not delete_superusers:
            users_qs = users_qs.filter(is_superuser=False)
        users_count = users_qs.count()

        if rooms_count == 0 and users_count == 0:
            self.stdout.write(self.style.WARNING("Nothing to delete."))
            return

        if not skip_confirm:
            prompt = (
                "This will delete rooms and users.\n"
                f"Rooms: {rooms_count}\n"
                f"Users: {users_count}\n"
                "Type 'yes' to continue: "
            )
            confirmation = input(prompt)
            if confirmation.strip().lower() != "yes":
                self.stdout.write(self.style.WARNING("Aborted."))
                return

        with transaction.atomic():
            EvidenceNudgeState.objects.all().delete()
            Intervention.objects.all().delete()
            SessionSummary.objects.all().delete()
            Post.objects.all().delete()
            RoomMember.objects.all().delete()
            Room.objects.all().delete()

            if users_count:
                users_qs.delete()

        self.stdout.write(self.style.SUCCESS("Rooms and users deleted."))
