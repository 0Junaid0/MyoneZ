from django.conf import settings
from django.core.mail import get_connection

from apps.accounts.models import EmailAccount


def mail_connection_for(user):
    account = EmailAccount.objects.filter(user=user).first()
    if account is None or not account.host or not account.from_email:
        return None, settings.DEFAULT_FROM_EMAIL
    return (
        get_connection(
            backend="django.core.mail.backends.smtp.EmailBackend",
            host=account.host,
            port=account.port,
            username=account.username,
            password=account.password,
            use_tls=account.security == account.Security.TLS,
            use_ssl=account.security == account.Security.SSL,
        ),
        account.from_email,
    )
