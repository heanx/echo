from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="avatar_preset",
            field=models.CharField(
                blank=True,
                choices=[
                    ("pulse", "Pulse"),
                    ("dawn", "Dawn"),
                    ("mint", "Mint"),
                    ("night", "Night"),
                ],
                max_length=24,
            ),
        ),
    ]
