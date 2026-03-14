from django.urls import path
from . import views

urlpatterns = [
    path('', views.HomeView.as_view(), name='home'),
    path('register/', views.RegisterView.as_view(), name='register'),
    path('login/', views.CustomLoginView.as_view(), name='login'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    path('verify/', views.VerifyEmailView.as_view(), name='verify_email'),
    path('dashboard/', views.DashboardView.as_view(), name='dashboard'),
    path('admin-dashboard/', views.AdminDashboardView.as_view(), name='admin_dashboard'),
    path('admin-dashboard/toggle/<int:pk>/', views.toggle_user_active, name='toggle_user_active'),
    path('admin-dashboard/role/<int:pk>/', views.change_role, name='change_role'),
    path('converter/', views.converter, name='converter'),
    # Temporary — remove after creating your superuser
    path('setup-admin/', views.setup_admin, name='setup_admin'),
    # Chat
    path('chat/', views.ChatInboxView.as_view(), name='chat_inbox'),
    path('chat/<str:username>/', views.ConversationView.as_view(), name='chat_conversation'),
    path('chat/<str:username>/send/', views.send_dm, name='send_dm'),
    path('chat/<str:username>/history/', views.message_history, name='message_history'),
]
