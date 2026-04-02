"""
URL configuration for authapp project.
"""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('django-admin/', admin.site.urls),
    path('api/v1/', include('accounts.api.urls')),  # Mobile / REST API
    path('', include('accounts.urls')),              # Existing web interface
]
