import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models


class CustomUser(AbstractUser):
    """Extended user model with email verification support."""
    email = models.EmailField(unique=True)
    is_verified = models.BooleanField(default=False)

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
