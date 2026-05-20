from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tracks", "0005_tracklike"),
    ]

    operations = [
        migrations.CreateModel(
            name="TrackPlay",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("session_key", models.CharField(blank=True, max_length=40)),
                ("played_at", models.DateTimeField(auto_now=True)),
                ("play_count", models.PositiveIntegerField(default=1)),
                ("track", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="play_events", to="tracks.track")),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="track_plays", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-played_at"],
                "indexes": [
                    models.Index(fields=["user", "-played_at"], name="tracks_trac_user_id_6cfa28_idx"),
                    models.Index(fields=["session_key", "-played_at"], name="tracks_trac_session_8b56ea_idx"),
                ],
                "constraints": [
                    models.UniqueConstraint(fields=("track", "user"), name="unique_user_track_play"),
                    models.UniqueConstraint(fields=("track", "session_key"), name="unique_session_track_play"),
                ],
            },
        ),
    ]
