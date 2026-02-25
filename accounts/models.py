import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models


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
