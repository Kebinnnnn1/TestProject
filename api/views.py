"""
CUlink REST API Views
All endpoints live under /api/  and use JWT Bearer token auth.
The existing HTML views are completely untouched.
"""
import json
import random as _random

from django.conf import settings as django_settings
from django.db.models import Q, Count, Max
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import (
    CustomUser, EmailVerificationToken,
    DirectMessage, Post, PostComment, PostImage,
    WorkspaceDoc, WorkspaceItem,
)
from accounts.tokens import generate_token, send_verification_email

from .serializers import (
    RegisterSerializer, UserSerializer,
    PostSerializer, PostCommentSerializer,
    DirectMessageSerializer, ChatUserSerializer,
    WorkspaceDocSerializer, WorkspaceItemSerializer,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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


def _verified_only(request):
    """Return a 403 Response if user is not email-verified, else None."""
    if not request.user.is_verified:
        return Response(
            {'detail': 'Please verify your email to access this feature.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


# ===========================================================================
# AUTH
# ===========================================================================

class RegisterView(APIView):
    """
    POST /api/auth/register/
    Body: { username, email, password }
    Sends verification email; returns 201 on success.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            token = generate_token(user)
            send_verification_email(request, user, token)
            return Response(
                {'detail': 'Account created. Check your email for the verification link.'},
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    """
    POST /api/auth/login/
    Body: { username, password }
    Returns: { access, refresh, user }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        from django.contrib.auth import authenticate
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')

        if not username or not password:
            return Response(
                {'detail': 'username and password are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response(
                {'detail': 'Invalid username or password.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        if not user.is_active:
            return Response(
                {'detail': 'Your account has been deactivated.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        refresh = RefreshToken.for_user(user)
        return Response({
            'access':  str(refresh.access_token),
            'refresh': str(refresh),
            'user':    UserSerializer(user).data,
        })


class TokenRefreshView(APIView):
    """
    POST /api/auth/refresh/
    Body: { refresh }
    Returns: { access }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response({'detail': 'refresh token required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            refresh = RefreshToken(refresh_token)
            return Response({'access': str(refresh.access_token)})
        except Exception:
            return Response({'detail': 'Invalid or expired refresh token.'}, status=status.HTTP_401_UNAUTHORIZED)


class ResendVerificationView(APIView):
    """
    POST /api/auth/resend-verification/
    Body: { email }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        import datetime
        from django.utils import timezone

        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response({'detail': 'email is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = CustomUser.objects.get(email__iexact=email)
        except CustomUser.DoesNotExist:
            return Response({'detail': 'No account found with that email.'}, status=status.HTTP_404_NOT_FOUND)

        if user.is_verified:
            return Response({'detail': 'This account is already verified.'})

        existing = EmailVerificationToken.objects.filter(user=user).first()
        if existing:
            age = timezone.now() - existing.created_at
            if age < datetime.timedelta(minutes=2):
                return Response(
                    {'detail': 'A verification email was sent recently. Please wait before requesting another.'},
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )

        token = generate_token(user)
        send_verification_email(request, user, token)
        return Response({'detail': 'Verification email sent. Check your inbox.'})


class MeView(APIView):
    """GET /api/auth/me/ — returns current user's profile."""

    def get(self, request):
        return Response(UserSerializer(request.user).data)


# ===========================================================================
# PROFILE
# ===========================================================================

class ProfileUpdateView(APIView):
    """
    PATCH /api/profile/update/
    Form-data: display_name (optional), avatar (optional file)
    """
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def patch(self, request):
        user = request.user
        display_name = request.data.get('display_name', '').strip()
        if display_name:
            user.display_name = display_name[:60]

        avatar_file = request.FILES.get('avatar')
        if avatar_file:
            import cloudinary.uploader
            result = cloudinary.uploader.upload(
                avatar_file,
                folder='avatars',
                public_id=f'avatar_{user.pk}',
                overwrite=True,
                transformation=[{'width': 400, 'height': 400, 'crop': 'fill', 'gravity': 'face'}],
            )
            user.avatar = result.get('public_id', '')

        user.save(update_fields=['display_name', 'avatar'])
        return Response(UserSerializer(user).data)


class PublicProfileView(APIView):
    """GET /api/profile/<username>/"""

    def get(self, request, username):
        user = get_object_or_404(CustomUser, username=username)
        data = UserSerializer(user).data
        data['post_count'] = user.posts.count()
        return Response(data)


class ChangePasswordView(APIView):
    """
    POST /api/profile/change-password/
    Body: { old_password, new_password, confirm_password }
    """

    def post(self, request):
        old_pw     = request.data.get('old_password', '')
        new_pw     = request.data.get('new_password', '')
        confirm_pw = request.data.get('confirm_password', '')

        if not request.user.check_password(old_pw):
            return Response({'detail': 'Current password is incorrect.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(new_pw) < 8:
            return Response({'detail': 'New password must be at least 8 characters.'}, status=status.HTTP_400_BAD_REQUEST)
        if new_pw != confirm_pw:
            return Response({'detail': 'New passwords do not match.'}, status=status.HTTP_400_BAD_REQUEST)

        request.user.set_password(new_pw)
        request.user.save()
        # Re-issue tokens so the app doesn't get logged out
        refresh = RefreshToken.for_user(request.user)
        return Response({
            'detail': 'Password changed successfully.',
            'access':  str(refresh.access_token),
            'refresh': str(refresh),
        })


class UpdateUniversityView(APIView):
    """
    POST /api/profile/university/
    Body: { university }
    """

    def post(self, request):
        uni   = request.data.get('university', '').strip()
        valid = [c[0] for c in CustomUser.UNIVERSITY_CHOICES]
        if uni not in valid:
            return Response({'detail': 'Invalid university.'}, status=status.HTTP_400_BAD_REQUEST)
        request.user.university = uni
        request.user.save(update_fields=['university'])
        return Response({'detail': f'University updated to {uni}.'})


# ===========================================================================
# KNOWLEDGE WALL
# ===========================================================================

PAGE_SIZE = 10


class WallListView(APIView):
    """
    GET  /api/wall/?offset=0&tag=python&university=CTU
    Returns paginated posts as JSON.
    """
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        err = _verified_only(request)
        if err:
            return err

        offset     = int(request.query_params.get('offset', 0))
        tag_filter = request.query_params.get('tag', '').strip()
        uni_filter = request.query_params.get('university', '').strip()

        qs = Post.objects.select_related('author').prefetch_related(
            'likes', 'comments__author', 'extra_images'
        )
        if tag_filter:
            qs = qs.filter(tags__icontains=tag_filter)
        if uni_filter:
            qs = qs.filter(university=uni_filter)
        qs    = qs.order_by('-timestamp')
        total = qs.count()
        batch = qs[offset: offset + PAGE_SIZE]

        serializer = PostSerializer(batch, many=True, context={'request': request})
        return Response({
            'posts':       serializer.data,
            'has_more':    (offset + PAGE_SIZE) < total,
            'next_offset': offset + PAGE_SIZE,
        })

    def post(self, request):
        """POST /api/wall/ — create a new post (multipart/form-data)."""
        err = _verified_only(request)
        if err:
            return err

        content = request.data.get('content', '').strip()
        if not content:
            return Response({'detail': 'Post content cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

        tags = request.data.get('tags', '').strip()
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

        extra_urls = []
        for i, f in enumerate(files[1:], start=1):
            pi = PostImage.objects.create(post=post, image=f, order=i)
            try:
                extra_urls.append(pi.image.url)
            except Exception:
                pass

        try:
            _pusher_client().trigger('wall', 'new-post', {
                'pk':       post.pk,
                'author':   request.user.username,
                'content':  post.content,
            })
        except Exception:
            pass

        serializer = PostSerializer(post, context={'request': request})
        return Response({'ok': True, 'post': serializer.data}, status=status.HTTP_201_CREATED)


class WallPostDetailView(APIView):
    """DELETE /api/wall/<pk>/"""

    def delete(self, request, pk):
        err = _verified_only(request)
        if err:
            return err
        try:
            post = Post.objects.get(pk=pk)
        except Post.DoesNotExist:
            return Response({'detail': 'Post not found.'}, status=status.HTTP_404_NOT_FOUND)
        if post.author != request.user and not request.user.is_staff:
            return Response({'detail': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)
        post.delete()
        return Response({'ok': True})


class LikePostView(APIView):
    """POST /api/wall/<pk>/like/ — toggle like."""

    def post(self, request, pk):
        err = _verified_only(request)
        if err:
            return err
        post = get_object_or_404(Post, pk=pk)
        if request.user in post.likes.all():
            post.likes.remove(request.user)
            liked = False
        else:
            post.likes.add(request.user)
            liked = True
        try:
            _pusher_client().trigger('wall', 'post-liked', {'pk': post.pk, 'count': post.likes.count()})
        except Exception:
            pass
        return Response({'liked': liked, 'count': post.likes.count()})


class CommentListView(APIView):
    """
    GET  /api/wall/<pk>/comments/  — list comments
    POST /api/wall/<pk>/comments/  — add a comment
    """

    def get(self, request, pk):
        err = _verified_only(request)
        if err:
            return err
        post     = get_object_or_404(Post, pk=pk)
        comments = post.comments.select_related('author').all()
        return Response(PostCommentSerializer(comments, many=True).data)

    def post(self, request, pk):
        err = _verified_only(request)
        if err:
            return err
        post    = get_object_or_404(Post, pk=pk)
        content = request.data.get('content', '').strip()
        if not content:
            return Response({'detail': 'Comment cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

        is_reply = content.startswith('@')
        comment  = PostComment.objects.create(
            post=post, author=request.user, content=content, is_reply=is_reply,
        )
        try:
            pc = _pusher_client()
            pc.trigger('wall', 'new-comment', {
                'post_pk': post.pk,
                'pk':      comment.pk,
                'author':  request.user.username,
                'content': comment.content,
                'is_reply': is_reply,
            })
            if post.author != request.user:
                pc.trigger(f'user-notif-{post.author.pk}', 'wall-reply', {
                    'post_pk': post.pk,
                    'author':  request.user.username,
                    'preview': comment.content[:60],
                })
        except Exception:
            pass

        return Response(PostCommentSerializer(comment).data, status=status.HTTP_201_CREATED)


class DeleteCommentView(APIView):
    """DELETE /api/wall/comment/<pk>/"""

    def delete(self, request, pk):
        err = _verified_only(request)
        if err:
            return err
        comment = get_object_or_404(PostComment, pk=pk)
        if comment.author != request.user and not request.user.is_staff:
            return Response({'detail': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)
        comment.delete()
        return Response({'ok': True})


# ===========================================================================
# CHAT (Direct Messages)
# ===========================================================================

class ChatInboxView(APIView):
    """GET /api/chat/ — inbox + all users."""

    def get(self, request):
        err = _verified_only(request)
        if err:
            return err

        me = request.user
        talked_ids_qs = DirectMessage.objects.filter(
            Q(sender=me) | Q(recipient=me)
        ).values_list('sender_id', 'recipient_id')

        ids = set()
        for s, r in talked_ids_qs:
            ids.add(s)
            ids.add(r)
        ids.discard(me.pk)

        unread_map = {
            item['sender_id']: item['cnt']
            for item in DirectMessage.objects.filter(
                recipient=me, is_read=False
            ).values('sender_id').annotate(cnt=Count('id'))
        }

        convos = []
        for u in CustomUser.objects.filter(pk__in=ids):
            d = ChatUserSerializer(u).data
            d['unread'] = unread_map.get(u.pk, 0)
            convos.append(d)

        all_others = ChatUserSerializer(
            CustomUser.objects.exclude(pk=me.pk).exclude(pk__in=ids),
            many=True,
        ).data

        return Response({'conversations': convos, 'all_users': all_others})


class ConversationView(APIView):
    """
    GET  /api/chat/<username>/  — message history
    POST /api/chat/<username>/  — send a message
    """

    def get(self, request, username):
        err = _verified_only(request)
        if err:
            return err

        me    = request.user
        other = get_object_or_404(CustomUser, username=username)
        msgs  = DirectMessage.objects.filter(
            Q(sender=me, recipient=other) | Q(sender=other, recipient=me)
        ).order_by('timestamp')

        # Mark as read
        DirectMessage.objects.filter(sender=other, recipient=me, is_read=False).update(is_read=True)

        return Response({
            'messages':       DirectMessageSerializer(msgs, many=True).data,
            'pusher_key':     django_settings.PUSHER_KEY,
            'pusher_cluster': django_settings.PUSHER_CLUSTER,
            'channel':        _dm_channel(me, other),
            'me':             me.username,
            'other':          ChatUserSerializer(other).data,
        })

    def post(self, request, username):
        err = _verified_only(request)
        if err:
            return err

        me      = request.user
        other   = get_object_or_404(CustomUser, username=username)
        content = request.data.get('content', '').strip()

        if not content:
            return Response({'detail': 'Message cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

        msg = DirectMessage.objects.create(sender=me, recipient=other, content=content)

        try:
            pc = _pusher_client()
            pc.trigger(_dm_channel(me, other), 'new-message', {
                'id':        msg.pk,
                'sender':    me.username,
                'content':   content,
                'timestamp': msg.timestamp.strftime('%H:%M'),
            })
            pc.trigger(f'user-notif-{other.pk}', 'new-dm', {'sender': me.username})
        except Exception:
            pass

        return Response(DirectMessageSerializer(msg).data, status=status.HTTP_201_CREATED)


class RandomChatView(APIView):
    """GET /api/chat/random/?university=CTU"""

    def get(self, request):
        err = _verified_only(request)
        if err:
            return err

        uni = request.query_params.get('university', '').strip()
        if uni:
            valid = [c[0] for c in CustomUser.UNIVERSITY_CHOICES]
            if uni not in valid:
                return Response({'detail': 'Invalid university.'}, status=status.HTTP_400_BAD_REQUEST)
            candidates = list(
                CustomUser.objects.filter(university=uni, is_active=True)
                .exclude(pk=request.user.pk)
            )
            if not candidates:
                return Response({'detail': f'No users found from {uni}.'}, status=status.HTTP_404_NOT_FOUND)
        else:
            candidates = list(CustomUser.objects.filter(is_active=True).exclude(pk=request.user.pk))
            if not candidates:
                return Response({'detail': 'No other users available.'}, status=status.HTTP_404_NOT_FOUND)

        pick = _random.choice(candidates)
        return Response({'username': pick.username})


# ===========================================================================
# WORKSPACE
# ===========================================================================

class WorkspaceDocsView(APIView):
    """
    GET  /api/workspace/       — list all docs (with items)
    POST /api/workspace/       — create a new doc
    """

    def get(self, request):
        err = _verified_only(request)
        if err:
            return err
        docs = WorkspaceDoc.objects.filter(owner=request.user).prefetch_related('items')
        return Response(WorkspaceDocSerializer(docs, many=True).data)

    def post(self, request):
        err = _verified_only(request)
        if err:
            return err
        doc = WorkspaceDoc.objects.create(
            owner=request.user,
            type=request.data.get('type', 'note'),
            title=request.data.get('title', 'Untitled')[:200],
            color=request.data.get('color', '#4E7C3F'),
        )
        return Response(WorkspaceDocSerializer(doc).data, status=status.HTTP_201_CREATED)


class WorkspaceDocDetailView(APIView):
    """
    PATCH  /api/workspace/doc/<pk>/  — rename / recolour
    DELETE /api/workspace/doc/<pk>/  — delete doc + all items
    """

    def patch(self, request, pk):
        err = _verified_only(request)
        if err:
            return err
        doc = get_object_or_404(WorkspaceDoc, pk=pk, owner=request.user)
        if 'title' in request.data:
            doc.title = request.data['title'][:200]
        if 'color' in request.data:
            doc.color = request.data['color']
        doc.save()
        return Response(WorkspaceDocSerializer(doc).data)

    def delete(self, request, pk):
        err = _verified_only(request)
        if err:
            return err
        doc = get_object_or_404(WorkspaceDoc, pk=pk, owner=request.user)
        doc.delete()
        return Response({'ok': True})


class WorkspaceItemsView(APIView):
    """POST /api/workspace/doc/<pk>/items/ — add item to doc."""

    def post(self, request, pk):
        err = _verified_only(request)
        if err:
            return err
        doc      = get_object_or_404(WorkspaceDoc, pk=pk, owner=request.user)
        max_order = doc.items.aggregate(Max('order'))['order__max'] or 0
        item = WorkspaceItem.objects.create(
            doc=doc,
            content=request.data.get('content', ''),
            status=request.data.get('status', 'todo'),
            priority=request.data.get('priority', 'medium'),
            due_date=request.data.get('due_date') or None,
            color=request.data.get('color', '#fef9c3'),
            order=max_order + 1,
        )
        return Response(WorkspaceItemSerializer(item).data, status=status.HTTP_201_CREATED)


class WorkspaceItemDetailView(APIView):
    """
    PATCH  /api/workspace/item/<pk>/  — update item fields
    DELETE /api/workspace/item/<pk>/  — delete item
    """

    def patch(self, request, pk):
        err = _verified_only(request)
        if err:
            return err
        item = get_object_or_404(WorkspaceItem, pk=pk, doc__owner=request.user)
        data = request.data
        fields_to_save = []
        for field in [
            'content', 'description', 'is_done', 'status', 'priority',
            'task_type', 'effort', 'due_date', 'start_date', 'progress', 'color',
        ]:
            if field in data:
                if field == 'is_done':
                    setattr(item, field, bool(data[field]))
                elif field == 'progress':
                    setattr(item, field, int(data[field]))
                elif field in ('due_date', 'start_date'):
                    setattr(item, field, data[field] or None)
                else:
                    setattr(item, field, data[field])
                fields_to_save.append(field)
        if fields_to_save:
            item.save(update_fields=fields_to_save)
        return Response(WorkspaceItemSerializer(item).data)

    def delete(self, request, pk):
        err = _verified_only(request)
        if err:
            return err
        item = get_object_or_404(WorkspaceItem, pk=pk, doc__owner=request.user)
        item.delete()
        return Response({'ok': True})


# ===========================================================================
# PUSHER AUTH (needed for mobile Pusher SDK private channels)
# ===========================================================================

@api_view(['POST'])
def pusher_auth(request):
    """
    POST /api/pusher/auth/
    Body: { socket_id, channel_name }
    Mobile Pusher SDK calls this to authenticate private channels.
    """
    socket_id    = request.data.get('socket_id')
    channel_name = request.data.get('channel_name')
    if not socket_id or not channel_name:
        return Response({'detail': 'socket_id and channel_name required.'}, status=status.HTTP_400_BAD_REQUEST)

    # Only allow the user to auth their own dm-channels or notif-channel
    me = request.user
    allowed_channels = [
        f'user-notif-{me.pk}',
    ]
    # Allow any dm channel that includes this user's pk
    if channel_name.startswith('dm-'):
        parts = channel_name.split('-')  # ['dm', 'pk1', 'pk2']
        if len(parts) == 3 and str(me.pk) in parts[1:]:
            allowed_channels.append(channel_name)

    if channel_name not in allowed_channels:
        return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        pc   = _pusher_client()
        auth = pc.authenticate(channel=channel_name, socket_id=socket_id)
        return Response(auth)
    except Exception as e:
        return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
