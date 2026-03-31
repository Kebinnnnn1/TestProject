from django.contrib import admin
from .models import CustomUser, EmailVerificationToken


@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'is_verified', 'is_active', 'is_staff', 'date_joined')
    list_filter = ('is_verified', 'is_active', 'is_staff')
    search_fields = ('username', 'email')
    ordering = ('-date_joined',)
    readonly_fields = ('date_joined', 'last_login')


@admin.register(EmailVerificationToken)
class EmailVerificationTokenAdmin(admin.ModelAdmin):
    list_display = ('user', 'token', 'created_at')
    readonly_fields = ('token', 'created_at')
