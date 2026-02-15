from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("message_board", "0019_room_created_by_room_is_private_room_password_hash"),
    ]

    operations = [
        migrations.CreateModel(
            name="FinalAnswerProposal",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("activity_run_id", models.UUIDField(db_index=True)),
                ("content", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("is_final", models.BooleanField(default=False)),
                ("finalized_at", models.DateTimeField(blank=True, null=True)),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
                ("room", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="final_answer_proposals", to="message_board.room")),
            ],
            options={
                "ordering": ["-is_final", "-created_at"],
            },
        ),
        migrations.CreateModel(
            name="FinalAnswerVote",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("proposal", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="votes", to="message_board.finalanswerproposal")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "unique_together": {("proposal", "user")},
            },
        ),
    ]
