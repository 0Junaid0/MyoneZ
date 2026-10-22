from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("messaging", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="message",
            name="channel",
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name="message",
            name="scheduled_for",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="deliveryattempt",
            name="handoff_url",
            field=models.TextField(blank=True),
        ),
        migrations.AddIndex(
            model_name="message",
            index=models.Index(fields=["status", "scheduled_for"], name="messaging_m_status_sched_idx"),
        ),
    ]
