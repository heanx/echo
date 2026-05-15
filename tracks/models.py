# -*- coding: utf-8 -*-
from django.conf import settings
from django.db import models


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
            return self.audio_file.url
        return "/static/demo/demo-audio.wav"

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
