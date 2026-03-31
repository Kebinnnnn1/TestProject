from django.conf import settings as django_settings
from .models import DirectMessage


def unread_dm_count(request):
    """Inject unread DM count + Pusher config into every template context."""
    if request.user.is_authenticated:
        count = DirectMessage.objects.filter(
            recipient=request.user, is_read=False
        ).count()
        return {
            'unread_dm_count': count,
            'pusher_key': django_settings.PUSHER_KEY,
            'pusher_cluster': django_settings.PUSHER_CLUSTER,
        }
    return {
        'unread_dm_count': 0,
        'pusher_key': django_settings.PUSHER_KEY,
        'pusher_cluster': django_settings.PUSHER_CLUSTER,
    }
