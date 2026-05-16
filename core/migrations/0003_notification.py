from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0002_userprofile_avatar_preset"),
    ]

    operations = [
        migrations.CreateModel(
            name="Notification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("kind", models.CharField(choices=[("comment_reply", "评论回复"), ("comment_like", "评论点赞"), ("system", "系统通知")], default="system", max_length=40)),
                ("title", models.CharField(max_length=160)),
                ("body", models.TextField(blank=True)),
                ("target_url", models.CharField(blank=True, max_length=300)),
                ("is_read", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("actor", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="sent_notifications", to=settings.AUTH_USER_MODEL)),
                ("recipient", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="notifications", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["is_read", "-created_at"],
                "indexes": [
                    models.Index(fields=["recipient", "is_read", "-created_at"], name="core_notifi_recipie_1d5476_idx"),
                ],
            },
        ),
    ]
