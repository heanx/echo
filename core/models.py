from django.conf import settings
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.templatetags.static import static


AVATAR_PRESET_CHOICES = [
    ("pulse", "Pulse"),
    ("dawn", "Dawn"),
    ("mint", "Mint"),
    ("night", "Night"),
]


class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    display_name = models.CharField(max_length=120, blank=True)
    avatar = models.FileField(upload_to="users/avatars/", blank=True, null=True)
    avatar_preset = models.CharField(max_length=24, choices=AVATAR_PRESET_CHOICES, blank=True)
    bio = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["user__username"]

    def __str__(self):
        return self.display_name or self.user.get_username()

    @property
    def name(self):
        return self.display_name or self.user.get_full_name() or self.user.get_username()

    @property
    def avatar_url(self):
        if self.avatar:
            try:
                return self.avatar.url
            except ValueError:
                pass
        if self.avatar_preset:
            return static(f"img/avatar-presets/{self.avatar_preset}.svg")
        return ""


class Notification(models.Model):
    KIND_COMMENT_REPLY = "comment_reply"
    KIND_COMMENT_LIKE = "comment_like"
    KIND_SYSTEM = "system"
    KIND_CHOICES = [
        (KIND_COMMENT_REPLY, "评论回复"),
        (KIND_COMMENT_LIKE, "评论点赞"),
        (KIND_SYSTEM, "系统通知"),
    ]

    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_notifications",
    )
    kind = models.CharField(max_length=40, choices=KIND_CHOICES, default=KIND_SYSTEM)
    title = models.CharField(max_length=160)
    body = models.TextField(blank=True)
    target_url = models.CharField(max_length=300, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["is_read", "-created_at"]
        indexes = [
            models.Index(fields=["recipient", "is_read", "-created_at"]),
        ]

    def __str__(self):
        return self.title


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def ensure_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance, display_name=instance.get_username())
