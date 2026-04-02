import cloudinary.uploader
from django.conf import settings as django_settings
from django.contrib.auth.password_validation import validate_password
from django.db.models import Q, Count, Max
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import (
    CustomUser, EmailVerificationToken, DirectMessage,
    Post, PostComment, PostImage, WorkspaceDoc, WorkspaceItem,
)
from accounts.tokens import generate_token, send_verification_email
from .serializers import (
    RegisterSerializer, LoginSerializer, UserProfileSerializer,
    UpdateProfileSerializer, UserMiniSerializer,
    PostSerializer, PostCommentSerializer,
    DirectMessageSerializer, WorkspaceDocSerializer,
    WorkspaceDocListSerializer, WorkspaceItemSerializer,
)


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _pusher_client():
    import pusher
    return pusher.Pusher(
        app_id=django_settings.PUSHER_APP_ID,
        key=django_settings.PUSHER_KEY,
        secret=django_settings.PUSHER_SECRET,
        cluster=django_settings.PUSHER_CLUSTER,
        ssl=True,
    )


def _dm_channel(user_a, user_b):
    ids = sorted([user_a.pk, user_b.pk])
    return f'dm-{ids[0]}-{ids[1]}'


PAGE_SIZE = 15


# ─────────────────────────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def api_register(request):
    """POST /api/v1/auth/register/ — Create a new user account."""
    serializer = RegisterSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user = serializer.save()
    token = generate_token(user)
    send_verification_email(request, user, token)

    refresh = RefreshToken.for_user(user)
    return Response({
        'message': 'Account created! Please verify your email.',
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': UserProfileSerializer(user, context={'request': request}).data,
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def api_login(request):
    """POST /api/v1/auth/login/ — Login and receive JWT tokens."""
    serializer = LoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user = serializer.validated_data['user']
    refresh = RefreshToken.for_user(user)
    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': UserProfileSerializer(user, context={'request': request}).data,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def api_verify_email(request):
    """POST /api/v1/auth/verify-email/ — Verify email with token."""
    token_value = request.data.get('token') or request.query_params.get('token')
    if not token_value:
        return Response({'error': 'Token is required.'}, status=status.HTTP_400_BAD_REQUEST)

    from django.core.exceptions import ValidationError
    try:
        token_obj = EmailVerificationToken.objects.filter(token=token_value).first()
    except (ValidationError, ValueError):
        token_obj = None

    if not token_obj:
        return Response({'error': 'Invalid or expired verification token.'}, status=status.HTTP_400_BAD_REQUEST)

    user = token_obj.user
    user.is_verified = True
    user.save()
    token_obj.delete()
    return Response({'message': 'Email verified successfully! You can now access all features.'})


@api_view(['POST'])
@permission_classes([AllowAny])
def api_resend_verification(request):
    """POST /api/v1/auth/resend-verification/ — Resend verification email."""
    email = request.data.get('email', '').strip().lower()
    if not email:
        return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = CustomUser.objects.get(email__iexact=email)
    except CustomUser.DoesNotExist:
        return Response({'error': 'No account found with this email.'}, status=status.HTTP_404_NOT_FOUND)

    if user.is_verified:
        return Response({'message': 'Account is already verified.'})

    import datetime
    from django.utils import timezone
    existing = EmailVerificationToken.objects.filter(user=user).first()
    if existing:
        age = timezone.now() - existing.created_at
        if age < datetime.timedelta(minutes=2):
            return Response(
                {'error': 'A verification email was recently sent. Please wait a moment.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

    token = generate_token(user)
    send_verification_email(request, user, token)
    return Response({'message': 'Verification email sent!'})


# ─────────────────────────────────────────────────────────────
# PROFILE
# ─────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_profile(request):
    """GET /api/v1/profile/ — Get current user's profile."""
    serializer = UserProfileSerializer(request.user, context={'request': request})
    return Response(serializer.data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def api_update_profile(request):
    """PATCH /api/v1/profile/update/ — Update display name, university, avatar."""
    user = request.user

    # Handle text fields
    display_name = request.data.get('display_name')
    university = request.data.get('university')

    if display_name is not None:
        user.display_name = display_name[:60]
    if university is not None:
        valid_unis = [c[0] for c in CustomUser.UNIVERSITY_CHOICES]
        if university not in valid_unis and university != '':
            return Response({'error': 'Invalid university.'}, status=status.HTTP_400_BAD_REQUEST)
        user.university = university

    # Handle avatar upload
    avatar_file = request.FILES.get('avatar')
    if avatar_file:
        try:
            result = cloudinary.uploader.upload(
                avatar_file,
                folder='avatars',
                public_id=f'avatar_{user.pk}',
                overwrite=True,
                transformation=[{'width': 400, 'height': 400, 'crop': 'fill', 'gravity': 'face'}],
            )
            user.avatar = result.get('public_id', '')
        except Exception as e:
            return Response({'error': f'Avatar upload failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    user.save()
    return Response(UserProfileSerializer(user, context={'request': request}).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_change_password(request):
    """POST /api/v1/profile/change-password/ — Change password."""
    old_pw = request.data.get('old_password', '')
    new_pw = request.data.get('new_password', '')
    confirm_pw = request.data.get('confirm_password', '')

    if not request.user.check_password(old_pw):
        return Response({'error': 'Current password is incorrect.'}, status=status.HTTP_400_BAD_REQUEST)
    if len(new_pw) < 8:
        return Response({'error': 'New password must be at least 8 characters.'}, status=status.HTTP_400_BAD_REQUEST)
    if new_pw != confirm_pw:
        return Response({'error': 'Passwords do not match.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        validate_password(new_pw, request.user)
    except Exception as e:
        return Response({'error': list(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

    request.user.set_password(new_pw)
    request.user.save()

    # Return new tokens (old ones still work until expiry, but give fresh ones)
    refresh = RefreshToken.for_user(request.user)
    return Response({
        'message': 'Password changed successfully.',
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_public_profile(request, username):
    """GET /api/v1/users/<username>/ — View anyone's public profile."""
    user = get_object_or_404(CustomUser, username=username)
    return Response(UserProfileSerializer(user, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_search_users(request):
    """GET /api/v1/users/search/?q=... — Search users by username."""
    q = request.query_params.get('q', '').strip()
    if len(q) < 2:
        return Response({'results': []})
    users = CustomUser.objects.filter(
        Q(username__icontains=q) | Q(display_name__icontains=q)
    ).exclude(pk=request.user.pk)[:20]
    return Response({'results': UserMiniSerializer(users, many=True, context={'request': request}).data})


# ─────────────────────────────────────────────────────────────
# WALL
# ─────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_wall(request):
    """GET /api/v1/wall/?offset=0&tag=&university= — Paginated wall feed."""
    if not request.user.is_verified:
        return Response({'error': 'Email verification required.'}, status=status.HTTP_403_FORBIDDEN)

    offset = int(request.query_params.get('offset', 0))
    tag_filter = request.query_params.get('tag', '').strip()
    uni_filter = request.query_params.get('university', '').strip()

    qs = Post.objects.select_related('author').prefetch_related('likes', 'comments__author', 'extra_images')
    if tag_filter:
        qs = qs.filter(tags__icontains=tag_filter)
    if uni_filter:
        qs = qs.filter(university=uni_filter)
    qs = qs.order_by('-timestamp')

    total = qs.count()
    batch = qs[offset: offset + PAGE_SIZE]
    serializer = PostSerializer(batch, many=True, context={'request': request})

    return Response({
        'posts': serializer.data,
        'has_more': (offset + PAGE_SIZE) < total,
        'next_offset': offset + PAGE_SIZE,
        'total': total,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def api_create_post(request):
    """POST /api/v1/wall/create/ — Create a new wall post."""
    if not request.user.is_verified:
        return Response({'error': 'Email verification required.'}, status=status.HTTP_403_FORBIDDEN)

    content = request.data.get('content', '').strip()
    tags = request.data.get('tags', '').strip()

    if not content:
        return Response({'error': 'Post content cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

    cloudinary_ok = django_settings.CLOUDINARY_STORAGE.get('CLOUD_NAME')
    files = request.FILES.getlist('images') if cloudinary_ok else []
    if not files and cloudinary_ok:
        single = request.FILES.get('image')
        if single:
            files = [single]

    primary_image = files[0] if files else None
    post = Post.objects.create(
        author=request.user,
        content=content,
        tags=tags,
        image=primary_image,
        university=request.user.university,
    )

    # Upload extra images to Cloudinary
    if cloudinary_ok and len(files) > 1:
        for i, f in enumerate(files[1:], start=1):
            try:
                result = cloudinary.uploader.upload(f, folder='wall_images')
                PostImage.objects.create(post=post, image=result['public_id'], order=i)
            except Exception:
                pass

    return Response(
        PostSerializer(post, context={'request': request}).data,
        status=status.HTTP_201_CREATED
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_like_post(request, pk):
    """POST /api/v1/wall/<pk>/like/ — Toggle like on a post."""
    if not request.user.is_verified:
        return Response({'error': 'Email verification required.'}, status=status.HTTP_403_FORBIDDEN)

    post = get_object_or_404(Post, pk=pk)
    if request.user in post.likes.all():
        post.likes.remove(request.user)
        liked = False
    else:
        post.likes.add(request.user)
        liked = True

    return Response({'liked': liked, 'like_count': post.likes.count()})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_add_comment(request, pk):
    """POST /api/v1/wall/<pk>/comment/ — Add a comment to a post."""
    if not request.user.is_verified:
        return Response({'error': 'Email verification required.'}, status=status.HTTP_403_FORBIDDEN)

    post = get_object_or_404(Post, pk=pk)
    content = request.data.get('content', '').strip()

    if not content:
        return Response({'error': 'Comment cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

    comment = PostComment.objects.create(
        post=post,
        author=request.user,
        content=content,
    )
    return Response(
        PostCommentSerializer(comment, context={'request': request}).data,
        status=status.HTTP_201_CREATED
    )


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def api_delete_post(request, pk):
    """DELETE /api/v1/wall/<pk>/delete/ — Delete a post (owner or staff)."""
    post = get_object_or_404(Post, pk=pk)
    if post.author != request.user and not request.user.is_staff:
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
    post.delete()
    return Response({'message': 'Post deleted.'})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def api_delete_comment(request, pk):
    """DELETE /api/v1/wall/comment/<pk>/delete/ — Delete a comment."""
    comment = get_object_or_404(PostComment, pk=pk)
    if comment.author != request.user and not request.user.is_staff:
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
    comment.delete()
    return Response({'message': 'Comment deleted.'})


# ─────────────────────────────────────────────────────────────
# CHAT
# ─────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_chat_inbox(request):
    """GET /api/v1/chat/inbox/ — List conversations."""
    if not request.user.is_verified:
        return Response({'error': 'Email verification required.'}, status=status.HTTP_403_FORBIDDEN)

    me = request.user

    talked_to_ids_raw = DirectMessage.objects.filter(
        Q(sender=me) | Q(recipient=me)
    ).values_list('sender_id', 'recipient_id')

    ids = set()
    for s, r in talked_to_ids_raw:
        ids.add(s)
        ids.add(r)
    ids.discard(me.pk)

    unread_map = {
        item['sender_id']: item['cnt']
        for item in DirectMessage.objects.filter(
            recipient=me, is_read=False
        ).values('sender_id').annotate(cnt=Count('id'))
    }

    # Get last message per conversation
    conversations = []
    for user in CustomUser.objects.filter(pk__in=ids):
        last_msg = DirectMessage.objects.filter(
            (Q(sender=me) & Q(recipient=user)) |
            (Q(sender=user) & Q(recipient=me))
        ).order_by('-timestamp').first()

        conversations.append({
            'user': UserMiniSerializer(user, context={'request': request}).data,
            'last_message': last_msg.content if last_msg else '',
            'last_timestamp': last_msg.timestamp.isoformat() if last_msg else None,
            'unread_count': unread_map.get(user.pk, 0),
        })

    # Sort by last message time (newest first)
    conversations.sort(
        key=lambda x: x['last_timestamp'] or '',
        reverse=True
    )

    return Response({
        'conversations': conversations,
        'pusher_key': django_settings.PUSHER_KEY,
        'pusher_cluster': django_settings.PUSHER_CLUSTER,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_message_history(request, username):
    """GET /api/v1/chat/<username>/messages/ — Get DM history."""
    if not request.user.is_verified:
        return Response({'error': 'Email verification required.'}, status=status.HTTP_403_FORBIDDEN)

    me = request.user
    other = get_object_or_404(CustomUser, username=username)

    msgs = DirectMessage.objects.filter(
        (Q(sender=me) & Q(recipient=other)) |
        (Q(sender=other) & Q(recipient=me))
    ).order_by('timestamp')

    # Mark as read
    DirectMessage.objects.filter(sender=other, recipient=me, is_read=False).update(is_read=True)

    return Response({
        'messages': DirectMessageSerializer(msgs, many=True).data,
        'other_user': UserMiniSerializer(other, context={'request': request}).data,
        'channel': _dm_channel(me, other),
        'pusher_key': django_settings.PUSHER_KEY,
        'pusher_cluster': django_settings.PUSHER_CLUSTER,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_send_dm(request, username):
    """POST /api/v1/chat/<username>/send/ — Send a DM."""
    if not request.user.is_verified:
        return Response({'error': 'Email verification required.'}, status=status.HTTP_403_FORBIDDEN)

    me = request.user
    other = get_object_or_404(CustomUser, username=username)
    content = request.data.get('content', '').strip()

    if not content:
        return Response({'error': 'Message cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

    msg = DirectMessage.objects.create(sender=me, recipient=other, content=content)

    # Trigger Pusher event
    try:
        pc = _pusher_client()
        pc.trigger(_dm_channel(me, other), 'new-message', {
            'id': msg.pk,
            'sender': me.username,
            'content': content,
            'timestamp': msg.timestamp.strftime('%H:%M'),
        })
        pc.trigger(f'user-notif-{other.pk}', 'new-dm', {
            'sender': me.username,
        })
    except Exception:
        pass

    return Response(DirectMessageSerializer(msg).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_users_list(request):
    """GET /api/v1/users/ — List all users for starting a new chat."""
    if not request.user.is_verified:
        return Response({'error': 'Email verification required.'}, status=status.HTTP_403_FORBIDDEN)

    users = CustomUser.objects.exclude(pk=request.user.pk).filter(is_active=True)
    return Response({
        'users': UserMiniSerializer(users, many=True, context={'request': request}).data
    })


# ─────────────────────────────────────────────────────────────
# WORKSPACE
# ─────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_workspace(request):
    """GET /api/v1/workspace/ — List all workspace docs for current user."""
    docs = WorkspaceDoc.objects.filter(owner=request.user)
    return Response({
        'docs': WorkspaceDocListSerializer(docs, many=True).data
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_create_doc(request):
    """POST /api/v1/workspace/doc/create/ — Create a new workspace doc."""
    doc_type = request.data.get('type', '')
    title = request.data.get('title', 'Untitled')
    color = request.data.get('color', '#4E7C3F')

    valid_types = [t[0] for t in WorkspaceDoc.TYPE_CHOICES]
    if doc_type not in valid_types:
        return Response({'error': f'Invalid type. Choose from: {valid_types}'}, status=status.HTTP_400_BAD_REQUEST)

    doc = WorkspaceDoc.objects.create(
        owner=request.user,
        type=doc_type,
        title=title[:200],
        color=color,
    )
    return Response(WorkspaceDocSerializer(doc).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_get_doc(request, pk):
    """GET /api/v1/workspace/doc/<pk>/ — Get a specific doc with all items."""
    doc = get_object_or_404(WorkspaceDoc, pk=pk, owner=request.user)
    return Response(WorkspaceDocSerializer(doc).data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def api_update_doc(request, pk):
    """PATCH /api/v1/workspace/doc/<pk>/update/ — Update doc title/color."""
    doc = get_object_or_404(WorkspaceDoc, pk=pk, owner=request.user)

    title = request.data.get('title')
    color = request.data.get('color')

    if title is not None:
        doc.title = title[:200]
    if color is not None:
        doc.color = color
    doc.save()

    return Response(WorkspaceDocSerializer(doc).data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def api_delete_doc(request, pk):
    """DELETE /api/v1/workspace/doc/<pk>/delete/ — Delete a doc."""
    doc = get_object_or_404(WorkspaceDoc, pk=pk, owner=request.user)
    doc.delete()
    return Response({'message': 'Document deleted.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_create_item(request, pk):
    """POST /api/v1/workspace/doc/<pk>/item/ — Add an item to a doc."""
    doc = get_object_or_404(WorkspaceDoc, pk=pk, owner=request.user)
    content = request.data.get('content', '').strip()

    if not content:
        return Response({'error': 'Item content cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

    last_order = doc.items.aggregate(max_order=Max('order'))['max_order'] or 0

    item = WorkspaceItem.objects.create(
        doc=doc,
        content=content,
        description=request.data.get('description', ''),
        status=request.data.get('status', WorkspaceItem.STATUS_TODO),
        priority=request.data.get('priority', WorkspaceItem.PRIORITY_MEDIUM),
        task_type=request.data.get('task_type', WorkspaceItem.TYPE_OTHER),
        effort=request.data.get('effort', WorkspaceItem.EFFORT_M),
        due_date=request.data.get('due_date') or None,
        start_date=request.data.get('start_date') or None,
        color=request.data.get('color', '#fef9c3'),
        order=last_order + 1,
    )
    doc.save()  # update updated_at
    return Response(WorkspaceItemSerializer(item).data, status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def api_update_item(request, pk):
    """PATCH /api/v1/workspace/item/<pk>/update/ — Update a workspace item."""
    item = get_object_or_404(WorkspaceItem, pk=pk, doc__owner=request.user)

    fields = ['content', 'description', 'is_done', 'status', 'priority',
              'task_type', 'effort', 'due_date', 'start_date', 'progress', 'order', 'color']
    for field in fields:
        if field in request.data:
            setattr(item, field, request.data[field])
    item.save()
    item.doc.save()  # update updated_at

    return Response(WorkspaceItemSerializer(item).data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def api_delete_item(request, pk):
    """DELETE /api/v1/workspace/item/<pk>/delete/ — Delete a workspace item."""
    item = get_object_or_404(WorkspaceItem, pk=pk, doc__owner=request.user)
    item.delete()
    return Response({'message': 'Item deleted.'})
