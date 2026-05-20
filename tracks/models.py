from django.conf import settings
from django.db import models
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from core.file_cleanup import delete_filefield_file, delete_remembered_replaced_files, remember_replaced_files


class Track(models.Model):
    STATUS_DRAFT = "draft"
    STATUS_PUBLISHED = "published"
    STATUS_HIDDEN = "hidden"
    STATUS_DELETED = "deleted"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_PUBLISHED, "Published"),
        (STATUS_HIDDEN, "Hidden"),
        (STATUS_DELETED, "Deleted"),
    ]

    title = models.CharField("标题", max_length=200)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="tracks")
    artist = models.CharField("作者", max_length=120, blank=True)
    description = models.TextField("简介", blank=True)
    audio_file = models.FileField("音频文件", upload_to="tracks/audio/", blank=True, null=True)
    cover_image = models.FileField("封面图片", upload_to="tracks/covers/", blank=True, null=True)
    cover_theme = models.CharField("封面主题", max_length=40, default="summer")
    duration_ms = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PUBLISHED)
    created_at = models.DateTimeField("创建时间", auto_now_add=True)
    updated_at = models.DateTimeField("更新时间", auto_now=True)
    likes = models.PositiveIntegerField("点赞数", default=0)
    plays = models.PositiveIntegerField("播放数", default=0)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "音频作品"
        verbose_name_plural = "音频作品"
        indexes = [
            models.Index(fields=["status", "-created_at"]),
        ]

    def __str__(self):
        return self.title

    @property
    def audio_url(self):
        if self.audio_file:
            return f"/stream/{self.audio_file.name}"
        return "/stream/demo/demo-audio.wav"

    @property
    def cover_url(self):
        if self.cover_image:
            return self.cover_image.url
        return ""

    @property
    def play_count(self):
        return self.plays

    @property
    def like_count(self):
        return self.likes

    @property
    def uploader(self):
        if self.owner:
            profile = getattr(self.owner, "profile", None)
            if profile and profile.display_name:
                return profile.display_name
            return self.owner.get_full_name() or self.owner.get_username()
        return self.artist or "Echo 用户"


class TrackLike(models.Model):
    track = models.ForeignKey(Track, on_delete=models.CASCADE, related_name="user_likes")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="liked_tracks")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["track", "user"], name="unique_track_like"),
        ]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["track", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.user} likes {self.track}"


class TrackPlay(models.Model):
    track = models.ForeignKey(Track, on_delete=models.CASCADE, related_name="play_events")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name="track_plays")
    session_key = models.CharField(max_length=40, blank=True)
    played_at = models.DateTimeField(auto_now=True)
    play_count = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["-played_at"]
        constraints = [
            models.UniqueConstraint(fields=["track", "user"], name="unique_user_track_play"),
            models.UniqueConstraint(fields=["track", "session_key"], name="unique_session_track_play"),
        ]
        indexes = [
            models.Index(fields=["user", "-played_at"]),
            models.Index(fields=["session_key", "-played_at"]),
        ]

    def __str__(self):
        listener = self.user or self.session_key or "anonymous"
        return f"{listener} played {self.track}"


@receiver(post_delete, sender=Track)
def delete_track_files(sender, instance, **kwargs):
    delete_filefield_file(instance, "audio_file")
    delete_filefield_file(instance, "cover_image")


@receiver(pre_save, sender=Track)
def remember_track_replaced_files(sender, instance, **kwargs):
    remember_replaced_files(instance, ["audio_file", "cover_image"])


@receiver(post_save, sender=Track)
def delete_track_replaced_files(sender, instance, **kwargs):
    delete_remembered_replaced_files(instance)
