from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("message_board", "0020_final_answer_proposals"),
    ]

    operations = [
        migrations.DeleteModel(
            name="FinalAnswerVote",
        ),
        migrations.DeleteModel(
            name="FinalAnswerProposal",
        ),
        migrations.CreateModel(
            name="FinalAnswerSelection",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("activity_run_id", models.UUIDField(db_index=True)),
                ("finalized_at", models.DateTimeField(auto_now_add=True)),
                ("post", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="message_board.post")),
                ("room", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="final_answer_selections", to="message_board.room")),
            ],
            options={
                "unique_together": {("room", "activity_run_id")},
            },
        ),
        migrations.CreateModel(
            name="FinalAnswerVote",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("activity_run_id", models.UUIDField(db_index=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("post", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="final_answer_votes", to="message_board.post")),
                ("room", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="message_board.room")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "unique_together": {("room", "activity_run_id", "user")},
            },
        ),
    ]
