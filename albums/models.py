from django.conf import settings
from django.db import models


class Album(models.Model):
    title = models.CharField("专辑名", max_length=200)
    creator = models.CharField("创建者", max_length=120, blank=True)
    description = models.TextField("简介", blank=True)
    cover_image = models.FileField("封面图片", upload_to="albums/covers/", blank=True, null=True)
    cover_theme = models.CharField("封面主题", max_length=40, default="summer")
    tracks = models.ManyToManyField("tracks.Track", through="AlbumTrack", related_name="albums", blank=True)
    created_at = models.DateTimeField("创建时间", auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "专辑"
        verbose_name_plural = "专辑"

    def __str__(self):
        return self.title

    @property
    def artist(self):
        return self.creator or "Echo 用户"

    @property
    def cover_url(self):
        if self.cover_image:
            return self.cover_image.url
        return ""


class AlbumTrack(models.Model):
    album = models.ForeignKey(Album, on_delete=models.CASCADE, related_name="album_tracks")
    track = models.ForeignKey("tracks.Track", on_delete=models.CASCADE, related_name="album_tracks")
    position = models.PositiveIntegerField(default=0)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position", "added_at"]
        constraints = [
            models.UniqueConstraint(fields=["album", "track"], name="unique_album_track"),
        ]
        indexes = [
            models.Index(fields=["album", "position"]),
            models.Index(fields=["track", "added_at"]),
        ]

    def __str__(self):
        return f"{self.album} - {self.track}"


class Playlist(models.Model):
    title = models.CharField("歌单名", max_length=200)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="playlists")
    description = models.TextField("简介", blank=True)
    is_public = models.BooleanField("公开", default=True)
    cover_theme = models.CharField("封面主题", max_length=40, default="eclipse")
    tracks = models.ManyToManyField("tracks.Track", through="PlaylistTrack", related_name="playlists", blank=True)
    created_at = models.DateTimeField("创建时间", auto_now_add=True)
    updated_at = models.DateTimeField("更新时间", auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-created_at"]
        indexes = [
            models.Index(fields=["owner", "-updated_at"]),
            models.Index(fields=["is_public", "-updated_at"]),
        ]
        verbose_name = "歌单"
        verbose_name_plural = "歌单"

    def __str__(self):
        return self.title

    @property
    def creator(self):
        return self.owner.profile.name if hasattr(self.owner, "profile") else self.owner.get_username()


class PlaylistTrack(models.Model):
    playlist = models.ForeignKey(Playlist, on_delete=models.CASCADE, related_name="playlist_tracks")
    track = models.ForeignKey("tracks.Track", on_delete=models.CASCADE, related_name="playlist_tracks")
    position = models.PositiveIntegerField(default=0)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position", "added_at"]
        constraints = [
            models.UniqueConstraint(fields=["playlist", "track"], name="unique_playlist_track"),
        ]
        indexes = [
            models.Index(fields=["playlist", "position"]),
            models.Index(fields=["track", "added_at"]),
        ]

    def __str__(self):
        return f"{self.playlist} - {self.track}"
