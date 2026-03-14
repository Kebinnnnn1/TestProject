from .models import DirectMessage


def unread_dm_count(request):
    """Inject unread DM count into every template context."""
    if request.user.is_authenticated:
        count = DirectMessage.objects.filter(
            recipient=request.user, is_read=False
        ).count()
        return {'unread_dm_count': count}
    return {'unread_dm_count': 0}
