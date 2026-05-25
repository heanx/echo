from django.conf import settings
from django.db import models
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from core.file_cleanup import delete_filefield_file, delete_remembered_replaced_files, remember_replaced_files


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
    VISIBILITY_PUBLIC = "public"
    VISIBILITY_PRIVATE = "private"
    VISIBILITY_CHOICES = [
        (VISIBILITY_PUBLIC, "公开"),
        (VISIBILITY_PRIVATE, "私密"),
    ]

    TYPE_NORMAL = "normal"
    TYPE_LIKED = "liked"
    PLAYLIST_TYPE_CHOICES = [
        (TYPE_NORMAL, "普通歌单"),
        (TYPE_LIKED, "我喜欢的音乐"),
    ]

    COLLABORATION_NONE = "none"
    COLLABORATION_INVITE = "invite"
    COLLABORATION_CHOICES = [
        (COLLABORATION_NONE, "不协作"),
        (COLLABORATION_INVITE, "邀请协作"),
    ]

    title = models.CharField("歌单名", max_length=200)
    creator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="created_playlists")
    description = models.TextField("简介", blank=True)
    cover_image = models.FileField("封面图片", upload_to="playlists/covers/", blank=True, null=True)
    cover_theme = models.CharField("封面主题", max_length=40, default="eclipse")
    playlist_type = models.CharField("歌单类型", max_length=20, choices=PLAYLIST_TYPE_CHOICES, default=TYPE_NORMAL)
    visibility = models.CharField("可见性", max_length=20, choices=VISIBILITY_CHOICES, default=VISIBILITY_PUBLIC)
    collaboration_mode = models.CharField("协作模式", max_length=20, choices=COLLABORATION_CHOICES, default=COLLABORATION_NONE)
    tracks = models.ManyToManyField("tracks.Track", through="PlaylistTrack", related_name="playlists", blank=True)
    track_count = models.PositiveIntegerField("歌曲数", default=0)
    play_count = models.PositiveIntegerField("播放次数", default=0)
    favorite_count = models.PositiveIntegerField("收藏数", default=0)
    is_deleted = models.BooleanField("已删除", default=False)
    created_at = models.DateTimeField("创建时间", auto_now_add=True)
    updated_at = models.DateTimeField("更新时间", auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-created_at"]
        indexes = [
            models.Index(fields=["creator", "-updated_at"], name="albums_play_creator_240775_idx"),
            models.Index(fields=["visibility", "is_deleted", "-updated_at"], name="albums_play_visibil_364646_idx"),
            models.Index(fields=["creator", "playlist_type", "is_deleted"], name="albums_play_creator_c620ce_idx"),
        ]
        verbose_name = "歌单"
        verbose_name_plural = "歌单"

    def __str__(self):
        return self.title

    @property
    def creator_name(self):
        return self.creator.profile.name if hasattr(self.creator, "profile") else self.creator.get_username()

    @property
    def is_liked_playlist(self):
        return self.playlist_type == self.TYPE_LIKED

    @property
    def cover_url(self):
        if self.cover_image:
            return self.cover_image.url
        return ""


class PlaylistTrack(models.Model):
    playlist = models.ForeignKey(Playlist, on_delete=models.CASCADE, related_name="playlist_tracks")
    track = models.ForeignKey("tracks.Track", on_delete=models.CASCADE, related_name="playlist_tracks")
    added_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="playlist_track_additions")
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


class PlaylistFavorite(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorite_playlists")
    playlist = models.ForeignKey(Playlist, on_delete=models.CASCADE, related_name="favorites")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "playlist"], name="unique_playlist_favorite"),
        ]
        indexes = [
            models.Index(fields=["user", "-created_at"], name="albums_play_user_id_145c98_idx"),
            models.Index(fields=["playlist", "-created_at"], name="albums_play_playlis_43ca4d_idx"),
        ]

    def __str__(self):
        return f"{self.user} favorites {self.playlist}"


def ensure_liked_playlist(user):
    if not user or not getattr(user, "is_authenticated", False):
        return None
    playlist, _ = Playlist.objects.get_or_create(
        creator=user,
        playlist_type=Playlist.TYPE_LIKED,
        defaults={
            "title": "我喜欢的音乐",
            "visibility": Playlist.VISIBILITY_PRIVATE,
            "collaboration_mode": Playlist.COLLABORATION_NONE,
            "cover_theme": "eclipse",
        },
    )
    return playlist


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def ensure_default_liked_playlist(sender, instance, created, **kwargs):
    if created:
        ensure_liked_playlist(instance)


@receiver(post_delete, sender=Album)
def delete_album_cover(sender, instance, **kwargs):
    delete_filefield_file(instance, "cover_image")


@receiver(pre_save, sender=Album)
def remember_album_replaced_files(sender, instance, **kwargs):
    remember_replaced_files(instance, ["cover_image"])


@receiver(post_save, sender=Album)
def delete_album_replaced_files(sender, instance, **kwargs):
    delete_remembered_replaced_files(instance)


@receiver(post_delete, sender=Playlist)
def delete_playlist_cover(sender, instance, **kwargs):
    delete_filefield_file(instance, "cover_image")


@receiver(pre_save, sender=Playlist)
def remember_playlist_replaced_files(sender, instance, **kwargs):
    remember_replaced_files(instance, ["cover_image"])


@receiver(post_save, sender=Playlist)
def delete_playlist_replaced_files(sender, instance, **kwargs):
    delete_remembered_replaced_files(instance)
