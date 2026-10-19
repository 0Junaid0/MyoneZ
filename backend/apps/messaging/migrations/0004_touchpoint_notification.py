import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("messaging", "0003_send_notification"),
        ("schedules", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="sendnotification",
            name="message",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="notification",
                to="messaging.message",
            ),
        ),
        migrations.AddField(
            model_name="sendnotification",
            name="touchpoint",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="notification",
                to="schedules.touchpoint",
            ),
        ),
        migrations.AddConstraint(
            model_name="sendnotification",
            constraint=models.CheckConstraint(
                condition=(
                    models.Q(message__isnull=False, touchpoint__isnull=True)
                    | models.Q(message__isnull=True, touchpoint__isnull=False)
                ),
                name="notification_has_one_subject",
            ),
        ),
    ]
