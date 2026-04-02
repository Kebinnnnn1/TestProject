from django.urls import path
from . import views

urlpatterns = [

    # ------------------------------------------------------------------
    # Auth
    # ------------------------------------------------------------------
    path('auth/register/',            views.RegisterView.as_view(),           name='api_register'),
    path('auth/login/',               views.LoginView.as_view(),              name='api_login'),
    path('auth/refresh/',             views.TokenRefreshView.as_view(),       name='api_token_refresh'),
    path('auth/resend-verification/', views.ResendVerificationView.as_view(), name='api_resend_verification'),
    path('auth/me/',                  views.MeView.as_view(),                 name='api_me'),

    # ------------------------------------------------------------------
    # Profile
    # ------------------------------------------------------------------
    path('profile/update/',           views.ProfileUpdateView.as_view(),    name='api_profile_update'),
    path('profile/change-password/',  views.ChangePasswordView.as_view(),   name='api_change_password'),
    path('profile/university/',       views.UpdateUniversityView.as_view(), name='api_update_university'),
    path('profile/<str:username>/',   views.PublicProfileView.as_view(),    name='api_public_profile'),

    # ------------------------------------------------------------------
    # Knowledge Wall
    # ------------------------------------------------------------------
    path('wall/',                          views.WallListView.as_view(),       name='api_wall'),
    path('wall/<int:pk>/',                 views.WallPostDetailView.as_view(), name='api_wall_post_detail'),
    path('wall/<int:pk>/like/',            views.LikePostView.as_view(),       name='api_like_post'),
    path('wall/<int:pk>/comments/',        views.CommentListView.as_view(),    name='api_post_comments'),
    path('wall/comment/<int:pk>/',         views.DeleteCommentView.as_view(),  name='api_delete_comment'),

    # ------------------------------------------------------------------
    # Chat
    # ------------------------------------------------------------------
    path('chat/',                     views.ChatInboxView.as_view(),    name='api_chat_inbox'),
    path('chat/random/',              views.RandomChatView.as_view(),   name='api_random_chat'),
    path('chat/<str:username>/',      views.ConversationView.as_view(), name='api_conversation'),

    # ------------------------------------------------------------------
    # Workspace
    # ------------------------------------------------------------------
    path('workspace/',                       views.WorkspaceDocsView.as_view(),      name='api_workspace'),
    path('workspace/doc/<int:pk>/',          views.WorkspaceDocDetailView.as_view(), name='api_workspace_doc'),
    path('workspace/doc/<int:pk>/items/',    views.WorkspaceItemsView.as_view(),     name='api_workspace_items'),
    path('workspace/item/<int:pk>/',         views.WorkspaceItemDetailView.as_view(),name='api_workspace_item'),

    # ------------------------------------------------------------------
    # Pusher authentication (for mobile SDK private channels)
    # ------------------------------------------------------------------
    path('pusher/auth/', views.pusher_auth, name='api_pusher_auth'),
]
