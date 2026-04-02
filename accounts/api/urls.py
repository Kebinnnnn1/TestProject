from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    # Auth
    api_register, api_login, api_verify_email,
    api_resend_verification,
    # Profile
    api_profile, api_update_profile, api_change_password,
    api_public_profile, api_search_users,
    # Wall
    api_wall, api_create_post, api_like_post,
    api_add_comment, api_delete_post, api_delete_comment,
    # Chat
    api_chat_inbox, api_message_history, api_send_dm, api_users_list,
    # Workspace
    api_workspace, api_create_doc, api_get_doc, api_update_doc, api_delete_doc,
    api_create_item, api_update_item, api_delete_item,
)

urlpatterns = [
    # ── Auth ──────────────────────────────────────────────────────────────
    path('auth/register/',            api_register,           name='api_register'),
    path('auth/login/',               api_login,              name='api_login'),
    path('auth/refresh/',             TokenRefreshView.as_view(), name='api_token_refresh'),
    path('auth/verify-email/',        api_verify_email,       name='api_verify_email'),
    path('auth/resend-verification/', api_resend_verification, name='api_resend_verification'),

    # ── Profile ───────────────────────────────────────────────────────────
    path('profile/',                  api_profile,            name='api_profile'),
    path('profile/update/',           api_update_profile,     name='api_update_profile'),
    path('profile/change-password/',  api_change_password,    name='api_change_password'),

    # ── Users ─────────────────────────────────────────────────────────────
    path('users/',                    api_users_list,         name='api_users_list'),
    path('users/search/',             api_search_users,       name='api_search_users'),
    path('users/<str:username>/',     api_public_profile,     name='api_public_profile'),

    # ── Wall ──────────────────────────────────────────────────────────────
    path('wall/',                     api_wall,               name='api_wall'),
    path('wall/create/',              api_create_post,        name='api_create_post'),
    path('wall/<int:pk>/like/',       api_like_post,          name='api_like_post'),
    path('wall/<int:pk>/comment/',    api_add_comment,        name='api_add_comment'),
    path('wall/<int:pk>/delete/',     api_delete_post,        name='api_delete_post'),
    path('wall/comment/<int:pk>/delete/', api_delete_comment, name='api_delete_comment'),

    # ── Chat ──────────────────────────────────────────────────────────────
    path('chat/inbox/',                       api_chat_inbox,      name='api_chat_inbox'),
    path('chat/<str:username>/messages/',     api_message_history, name='api_message_history'),
    path('chat/<str:username>/send/',         api_send_dm,         name='api_send_dm'),

    # ── Workspace ─────────────────────────────────────────────────────────
    path('workspace/',                        api_workspace,       name='api_workspace'),
    path('workspace/doc/create/',             api_create_doc,      name='api_create_doc'),
    path('workspace/doc/<int:pk>/',           api_get_doc,         name='api_get_doc'),
    path('workspace/doc/<int:pk>/update/',    api_update_doc,      name='api_update_doc'),
    path('workspace/doc/<int:pk>/delete/',    api_delete_doc,      name='api_delete_doc'),
    path('workspace/doc/<int:pk>/item/',      api_create_item,     name='api_create_item'),
    path('workspace/item/<int:pk>/update/',   api_update_item,     name='api_update_item'),
    path('workspace/item/<int:pk>/delete/',   api_delete_item,     name='api_delete_item'),
]
