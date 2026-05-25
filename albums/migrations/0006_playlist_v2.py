from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def migrate_playlist_state(apps, schema_editor):
    Playlist = apps.get_model("albums", "Playlist")
    PlaylistTrack = apps.get_model("albums", "PlaylistTrack")
    TrackLike = apps.get_model("tracks", "TrackLike")
    user_app_label, user_model_name = settings.AUTH_USER_MODEL.split(".")
    User = apps.get_model(user_app_label, user_model_name)

    for playlist in Playlist.objects.all():
        playlist.visibility = "public" if getattr(playlist, "is_public", True) else "private"
        playlist.playlist_type = "normal"
        playlist.collaboration_mode = "none"
        playlist.track_count = PlaylistTrack.objects.filter(playlist=playlist).count()
        playlist.save(update_fields=["visibility", "playlist_type", "collaboration_mode", "track_count"])

    for user in User.objects.all():
        liked_playlist, _ = Playlist.objects.get_or_create(
            creator=user,
            playlist_type="liked",
            defaults={
                "title": "我喜欢的音乐",
                "visibility": "private",
                "collaboration_mode": "none",
                "cover_theme": "eclipse",
                "track_count": 0,
            },
        )
        for index, like in enumerate(TrackLike.objects.filter(user=user).order_by("created_at")):
            PlaylistTrack.objects.get_or_create(
                playlist=liked_playlist,
                track_id=like.track_id,
                defaults={"added_by": user, "position": index},
            )
        liked_playlist.track_count = PlaylistTrack.objects.filter(playlist=liked_playlist).count()
        liked_playlist.save(update_fields=["track_count"])


def reverse_playlist_state(apps, schema_editor):
    Playlist = apps.get_model("albums", "Playlist")
    for playlist in Playlist.objects.all():
        playlist.is_public = playlist.visibility == "public"
        playlist.save(update_fields=["is_public"])


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("albums", "0005_playlist_cover_image"),
        ("tracks", "0005_tracklike"),
    ]

    operations = [
        migrations.RemoveIndex(
            model_name="playlist",
            name="albums_play_owner_i_4733d8_idx",
        ),
        migrations.RemoveIndex(
            model_name="playlist",
            name="albums_play_is_publ_2f7887_idx",
        ),
        migrations.RenameField(
            model_name="playlist",
            old_name="owner",
            new_name="creator",
        ),
        migrations.AlterField(
            model_name="playlist",
            name="creator",
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="created_playlists", to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name="playlist",
            name="playlist_type",
            field=models.CharField(choices=[("normal", "普通歌单"), ("liked", "我喜欢的音乐")], default="normal", max_length=20, verbose_name="歌单类型"),
        ),
        migrations.AddField(
            model_name="playlist",
            name="visibility",
            field=models.CharField(choices=[("public", "公开"), ("private", "私密")], default="public", max_length=20, verbose_name="可见性"),
        ),
        migrations.AddField(
            model_name="playlist",
            name="collaboration_mode",
            field=models.CharField(choices=[("none", "不协作"), ("invite", "邀请协作")], default="none", max_length=20, verbose_name="协作模式"),
        ),
        migrations.AddField(
            model_name="playlist",
            name="track_count",
            field=models.PositiveIntegerField(default=0, verbose_name="歌曲数"),
        ),
        migrations.AddField(
            model_name="playlist",
            name="play_count",
            field=models.PositiveIntegerField(default=0, verbose_name="播放次数"),
        ),
        migrations.AddField(
            model_name="playlist",
            name="favorite_count",
            field=models.PositiveIntegerField(default=0, verbose_name="收藏数"),
        ),
        migrations.AddField(
            model_name="playlist",
            name="is_deleted",
            field=models.BooleanField(default=False, verbose_name="已删除"),
        ),
        migrations.AddField(
            model_name="playlisttrack",
            name="added_by",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="playlist_track_additions", to=settings.AUTH_USER_MODEL),
        ),
        migrations.RunPython(migrate_playlist_state, reverse_playlist_state),
        migrations.RemoveField(
            model_name="playlist",
            name="is_public",
        ),
        migrations.AddIndex(
            model_name="playlist",
            index=models.Index(fields=["creator", "-updated_at"], name="albums_play_creator_240775_idx"),
        ),
        migrations.AddIndex(
            model_name="playlist",
            index=models.Index(fields=["visibility", "is_deleted", "-updated_at"], name="albums_play_visibil_364646_idx"),
        ),
        migrations.AddIndex(
            model_name="playlist",
            index=models.Index(fields=["creator", "playlist_type", "is_deleted"], name="albums_play_creator_c620ce_idx"),
        ),
        migrations.CreateModel(
            name="PlaylistFavorite",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("playlist", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="favorites", to="albums.playlist")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="favorite_playlists", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["user", "-created_at"], name="albums_play_user_id_145c98_idx"),
                    models.Index(fields=["playlist", "-created_at"], name="albums_play_playlis_43ca4d_idx"),
                ],
                "constraints": [
                    models.UniqueConstraint(fields=("user", "playlist"), name="unique_playlist_favorite"),
                ],
            },
        ),
    ]
