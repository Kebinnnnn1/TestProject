import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class CustomUser(AbstractUser):
    """Extended user model with email verification and role support."""
    MEMBER    = 'member'
    MODERATOR = 'moderator'
    ADMIN     = 'admin'
    ROLE_CHOICES = [
        (MEMBER,    'Member'),
        (MODERATOR, 'Moderator'),
        (ADMIN,     'Admin'),
    ]

    email      = models.EmailField(unique=True)
    is_verified = models.BooleanField(default=False)
    role       = models.CharField(max_length=20, choices=ROLE_CHOICES, default=MEMBER)

    def __str__(self):
        return self.username


class EmailVerificationToken(models.Model):
    """One-time token sent to users to verify their email address."""
    user = models.OneToOneField(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='verification_token'
    )
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Token for {self.user.username}"


class DirectMessage(models.Model):
    """Private message between two users."""
    sender    = models.ForeignKey(
        'CustomUser', on_delete=models.CASCADE, related_name='sent_messages'
    )
    recipient = models.ForeignKey(
        'CustomUser', on_delete=models.CASCADE, related_name='received_messages'
    )
    content   = models.TextField(max_length=2000)
    timestamp = models.DateTimeField(default=timezone.now)
    is_read   = models.BooleanField(default=False)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f"{self.sender} → {self.recipient}: {self.content[:40]}"
