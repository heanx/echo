from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("albums", "0003_albumtrack_album_tracks_and_more"),
        ("tracks", "0004_track_owner"),
    ]

    operations = [
        migrations.CreateModel(
            name="Playlist",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=200, verbose_name="歌单名")),
                ("description", models.TextField(blank=True, verbose_name="简介")),
                ("is_public", models.BooleanField(default=True, verbose_name="公开")),
                ("cover_theme", models.CharField(default="eclipse", max_length=40, verbose_name="封面主题")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="创建时间")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="更新时间")),
                ("owner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="playlists", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "verbose_name": "歌单",
                "verbose_name_plural": "歌单",
                "ordering": ["-updated_at", "-created_at"],
                "indexes": [
                    models.Index(fields=["owner", "-updated_at"], name="albums_play_owner_i_4733d8_idx"),
                    models.Index(fields=["is_public", "-updated_at"], name="albums_play_is_publ_2f7887_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="PlaylistTrack",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("position", models.PositiveIntegerField(default=0)),
                ("added_at", models.DateTimeField(auto_now_add=True)),
                ("playlist", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="playlist_tracks", to="albums.playlist")),
                ("track", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="playlist_tracks", to="tracks.track")),
            ],
            options={
                "ordering": ["position", "added_at"],
                "indexes": [
                    models.Index(fields=["playlist", "position"], name="albums_play_playlis_71b239_idx"),
                    models.Index(fields=["track", "added_at"], name="albums_play_track_i_53da32_idx"),
                ],
                "constraints": [
                    models.UniqueConstraint(fields=("playlist", "track"), name="unique_playlist_track"),
                ],
            },
        ),
        migrations.AddField(
            model_name="playlist",
            name="tracks",
            field=models.ManyToManyField(blank=True, related_name="playlists", through="albums.PlaylistTrack", to="tracks.track"),
        ),
    ]
