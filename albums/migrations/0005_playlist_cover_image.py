from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("albums", "0004_playlist_playlisttrack"),
    ]

    operations = [
        migrations.AddField(
            model_name="playlist",
            name="cover_image",
            field=models.FileField(blank=True, null=True, upload_to="playlists/covers/", verbose_name="封面图片"),
        ),
    ]
