"""
URL configuration for authapp project.
"""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('django-admin/', admin.site.urls),
    path('api/', include('api.urls')),   # REST API for mobile app
    path('', include('accounts.urls')),  # Existing HTML website (unchanged)
]
