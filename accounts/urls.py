from django.urls import path
from django.contrib.auth import views as auth_views
from . import views

urlpatterns = [
    path('', views.HomeView.as_view(), name='home'),
    path('register/', views.RegisterView.as_view(), name='register'),
    path('login/', views.CustomLoginView.as_view(), name='login'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    path('verify/', views.VerifyEmailView.as_view(), name='verify_email'),
    path('resend-verification/', views.ResendVerificationView.as_view(), name='resend_verification'),
    path('dashboard/', views.DashboardView.as_view(), name='dashboard'),
    path('admin-dashboard/', views.AdminDashboardView.as_view(), name='admin_dashboard'),
    path('admin-dashboard/toggle/<int:pk>/', views.toggle_user_active, name='toggle_user_active'),
    path('admin-dashboard/role/<int:pk>/', views.change_role, name='change_role'),
    path('converter/', views.converter, name='converter'),
    # Temporary — remove after creating your superuser
    path('setup-admin/', views.setup_admin, name='setup_admin'),
    # Chat
    path('chat/', views.ChatInboxView.as_view(), name='chat_inbox'),
    path('chat/random/', views.random_chat, name='random_chat'),
    path('chat/<str:username>/', views.ConversationView.as_view(), name='chat_conversation'),
    path('chat/<str:username>/send/', views.send_dm, name='send_dm'),
    path('chat/<str:username>/history/', views.message_history, name='message_history'),
    # Profile
    path('profile/', views.ProfileView.as_view(), name='profile'),
    path('profile/update/', views.update_profile, name='update_profile'),
    path('dashboard/university/', views.update_university, name='update_university'),
    path('dashboard/change-password/', views.change_password, name='change_password'),
    path('dashboard/change-email/', views.change_email, name='change_email'),
    # Knowledge Wall
    path('wall/', views.WallView.as_view(), name='wall'),
    path('wall/create/', views.create_post, name='create_post'),
    path('wall/posts/', views.wall_posts, name='wall_posts'),
    path('wall/<int:pk>/delete/', views.delete_post, name='delete_post'),
    path('wall/<int:pk>/like/', views.like_post, name='like_post'),
    path('wall/<int:pk>/comment/', views.add_comment, name='add_comment'),
    path('wall/comment/<int:pk>/delete/', views.delete_comment, name='delete_comment'),
    # Workspace
    path('workspace/', views.workspace_view, name='workspace'),
    path('workspace/doc/create/', views.workspace_create_doc, name='workspace_create_doc'),
    path('workspace/doc/<int:pk>/update/', views.workspace_update_doc, name='workspace_update_doc'),
    path('workspace/doc/<int:pk>/delete/', views.workspace_delete_doc, name='workspace_delete_doc'),
    path('workspace/doc/<int:pk>/item/', views.workspace_create_item, name='workspace_create_item'),
    path('workspace/item/<int:pk>/update/', views.workspace_update_item, name='workspace_update_item'),
    path('workspace/item/<int:pk>/delete/', views.workspace_delete_item, name='workspace_delete_item'),
    # Password reset (Django built-in, custom templates)
    path('password-reset/', auth_views.PasswordResetView.as_view(
        template_name='accounts/password_reset.html',
        email_template_name='accounts/emails/password_reset_email.html',
        subject_template_name='accounts/emails/password_reset_subject.txt',
        success_url='/password-reset/done/',
    ), name='password_reset'),
    path('password-reset/done/', auth_views.PasswordResetDoneView.as_view(
        template_name='accounts/password_reset_done.html',
    ), name='password_reset_done'),
    path('password-reset-confirm/<uidb64>/<token>/', auth_views.PasswordResetConfirmView.as_view(
        template_name='accounts/password_reset_confirm.html',
        success_url='/password-reset-complete/',
    ), name='password_reset_confirm'),
    path('password-reset-complete/', auth_views.PasswordResetCompleteView.as_view(
        template_name='accounts/password_reset_complete.html',
    ), name='password_reset_complete'),
]
