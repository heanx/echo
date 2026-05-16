from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("comments", "0002_trackcomment_reply_to_user_name_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="trackcomment",
            name="parent",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="child_comments",
                to="comments.trackcomment",
            ),
        ),
    ]
