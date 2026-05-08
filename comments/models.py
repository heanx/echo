from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class TrackCommentQuerySet(models.QuerySet):
    def for_track(self, track):
        return self.filter(track=track)

    def visible(self):
        return self.filter(status=TrackComment.STATUS_PUBLISHED)

    def top_level(self):
        return self.filter(parent__isnull=True)

    def sorted(self, sort="hot"):
        if sort == "new":
            return self.order_by("-is_pinned", "-created_at")
        if sort == "questions":
            return self.filter(is_question=True).order_by("-is_pinned", "-created_at")
        return self.order_by("-is_pinned", "-like_count", "-reply_count", "-created_at")


class TrackComment(models.Model):
    STATUS_PUBLISHED = "published"
    STATUS_PENDING = "pending"
    STATUS_HIDDEN = "hidden"
    STATUS_DELETED = "deleted"
    STATUS_CHOICES = [
        (STATUS_PUBLISHED, "已发布"),
        (STATUS_PENDING, "待审核"),
        (STATUS_HIDDEN, "已隐藏"),
        (STATUS_DELETED, "已删除"),
    ]

    track = models.ForeignKey("tracks.Track", on_delete=models.CASCADE, related_name="comments")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    parent = models.ForeignKey("self", on_delete=models.CASCADE, null=True, blank=True, related_name="replies")
    reply_to_user_name = models.CharField(max_length=120, blank=True)
    author_name = models.CharField(max_length=120, blank=True)
    body = models.TextField()
    timestamp_ms = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PUBLISHED)
    is_pinned = models.BooleanField(default=False)
    is_question = models.BooleanField(default=False)
    is_creator_reply = models.BooleanField(default=False)
    like_count = models.PositiveIntegerField(default=0)
    reply_count = models.PositiveIntegerField(default=0)
    report_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = TrackCommentQuerySet.as_manager()

    class Meta:
        ordering = ["-is_pinned", "-created_at"]
        indexes = [
            models.Index(fields=["track", "-is_pinned", "-like_count", "-created_at"]),
            models.Index(fields=["track", "status", "-created_at"]),
            models.Index(fields=["track", "is_question", "-created_at"]),
            models.Index(fields=["parent", "created_at"]),
            models.Index(fields=["track", "parent", "status", "created_at"]),
        ]

    def clean(self):
        if self.parent and self.parent.track_id != self.track_id:
            raise ValidationError({"parent": "Reply parent must belong to the same track."})

    def save(self, *args, **kwargs):
        if self.parent and self.parent.parent_id:
            if not self.reply_to_user_name:
                self.reply_to_user_name = self.parent.author
            self.parent = self.parent.parent
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.author}: {self.body[:24]}"

    @property
    def author(self):
        if self.user:
            return self.user.get_full_name() or self.user.get_username()
        return self.author_name or "Echo 用户"

    @property
    def badge(self):
        if self.is_pinned:
            return "置顶"
        if self.is_creator_reply:
            return "创作者"
        return ""

    @property
    def question(self):
        return self.is_question

    @property
    def likes(self):
        return self.like_count

    @property
    def replies_count(self):
        return self.reply_count

    @property
    def replies(self):
        return self.reply_count

    @property
    def tone(self):
        return "brand" if self.is_pinned else ""

    @property
    def time(self):
        delta = timezone.now() - self.created_at
        seconds = int(delta.total_seconds())
        if seconds < 60:
            return "刚刚"
        if seconds < 3600:
            return f"{seconds // 60} 分钟前"
        if seconds < 86400:
            return f"{seconds // 3600} 小时前"
        return f"{seconds // 86400} 天前"


class TrackCommentReaction(models.Model):
    comment = models.ForeignKey(TrackComment, on_delete=models.CASCADE, related_name="reactions")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    reaction = models.CharField(max_length=20, default="like")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["comment", "user", "reaction"], name="unique_comment_user_reaction")
        ]

    def __str__(self):
        return f"{self.user} {self.reaction} {self.comment_id}"
