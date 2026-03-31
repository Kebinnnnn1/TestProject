import os
import sys

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'authapp.settings')

from django.core.wsgi import get_wsgi_application  # noqa: E402

# Auto-migrate on cold start (keeps the demo working without manual steps)
import django  # noqa: E402
django.setup()
from django.core.management import call_command  # noqa: E402
try:
    call_command('migrate', '--run-syncdb', verbosity=0)
except Exception:
    pass

application = get_wsgi_application()

# Vercel expects a callable named 'app'
app = application

