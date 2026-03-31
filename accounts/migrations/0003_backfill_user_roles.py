from django.db import migrations


def backfill_roles(apps, schema_editor):
    """Set role based on existing is_superuser / is_staff flags."""
    CustomUser = apps.get_model('accounts', 'CustomUser')
    for user in CustomUser.objects.all():
        if user.is_superuser:
            user.role = 'admin'
        elif user.is_staff:
            user.role = 'moderator'
        else:
            user.role = 'member'
        user.save(update_fields=['role'])


def reverse_backfill(apps, schema_editor):
    """Reverse: reset all roles to member."""
    CustomUser = apps.get_model('accounts', 'CustomUser')
    CustomUser.objects.all().update(role='member')


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_customuser_role'),
    ]

    operations = [
        migrations.RunPython(backfill_roles, reverse_backfill),
    ]
