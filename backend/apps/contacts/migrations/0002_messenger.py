from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("contacts", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="contact",
            name="messenger",
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AlterField(
            model_name="contact",
            name="preferred_channel",
            field=models.CharField(
                blank=True,
                choices=[
                    ("email", "Email"),
                    ("phone", "Phone"),
                    ("whatsapp", "WhatsApp"),
                    ("telegram", "Telegram"),
                    ("messenger", "Messenger"),
                    ("other", "Other"),
                ],
                max_length=20,
            ),
        ),
    ]
