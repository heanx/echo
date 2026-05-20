from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tracks", "0004_track_owner"),
    ]

    operations = [
        migrations.CreateModel(
            name="TrackLike",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("track", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="user_likes", to="tracks.track")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="liked_tracks", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["user", "-created_at"], name="tracks_trac_user_id_b37341_idx"),
                    models.Index(fields=["track", "-created_at"], name="tracks_trac_track_i_a74af9_idx"),
                ],
                "constraints": [
                    models.UniqueConstraint(fields=("track", "user"), name="unique_track_like"),
                ],
            },
        ),
    ]
