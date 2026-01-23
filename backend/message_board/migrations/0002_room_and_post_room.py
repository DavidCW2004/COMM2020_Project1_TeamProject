from django.db import migrations, models
import django.db.models.deletion


def assign_default_room(apps, schema_editor):
    Room = apps.get_model('message_board', 'Room')
    Post = apps.get_model('message_board', 'Post')

    room, _ = Room.objects.get_or_create(code='GLOBAL', defaults={'name': 'Global'})
    Post.objects.filter(room__isnull=True).update(room=room)


class Migration(migrations.Migration):

    dependencies = [
        ('message_board', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Room',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=12, unique=True)),
                ('name', models.CharField(blank=True, max_length=100)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.AddField(
            model_name='post',
            name='room',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='posts', to='message_board.room'),
        ),
        migrations.RunPython(assign_default_room, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='post',
            name='room',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='posts', to='message_board.room'),
        ),
    ]
