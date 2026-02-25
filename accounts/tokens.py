import logging
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings
from django.contrib import messages
from .models import EmailVerificationToken

logger = logging.getLogger(__name__)


def generate_token(user):
    """Create or replace a verification token for a user."""
    EmailVerificationToken.objects.filter(user=user).delete()
    token_obj = EmailVerificationToken.objects.create(user=user)
    return token_obj.token


def send_verification_email(request, user, token):
    """
    Send a branded HTML verification email.
    Falls back to a visible flash message + console print when email fails (DEBUG mode).
    """
    verification_url = request.build_absolute_uri(f'/verify/?token={token}')

    subject = 'Verify your AuthApp account'
    html_message = render_to_string('accounts/emails/verification_email.html', {
        'user': user,
        'verification_url': verification_url,
    })
    plain_message = strip_tags(html_message)

    try:
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )
        logger.info(f"Verification email sent to {user.email}")
    except Exception as exc:
        logger.warning(f"Email send failed ({exc}). Using dev fallback.")
        print(f"\n[DEV] Verification link for {user.email}:\n  {verification_url}\n")

        # In DEBUG mode, show the link as a flash message on the page
        if settings.DEBUG:
            messages.warning(
                request,
                f'[DEV MODE] Email could not be sent. '
                f'Click this link to verify: {verification_url}'
            )
