from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required, user_passes_test
from django.views.decorators.http import require_POST
from django.utils.decorators import method_decorator
from django.views import View
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.db.models import Q
from django.conf import settings as django_settings

from .forms import RegistrationForm, LoginForm
from .models import CustomUser, EmailVerificationToken, DirectMessage, Post, PostComment, PostImage
from .tokens import generate_token, send_verification_email


@login_required(login_url='/login/')
def converter(request):
    """File converter — requires login."""
    return render(request, 'accounts/converter.html')


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def redirect_if_logged_in(view_func):
    """Redirect already-authenticated users away from public auth pages."""
    def wrapper(request, *args, **kwargs):
        if request.user.is_authenticated:
            return redirect('dashboard')
        return view_func(request, *args, **kwargs)
    return wrapper


def is_staff_user(user):
    return user.is_active and (user.is_staff or user.is_superuser)


# ---------------------------------------------------------------------------
# Public pages
# ---------------------------------------------------------------------------

class HomeView(View):
    def get(self, request):
        return render(request, 'accounts/home.html')


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

@method_decorator(redirect_if_logged_in, name='dispatch')
class RegisterView(View):
    template_name = 'accounts/register.html'

    def get(self, request):
        form = RegistrationForm()
        return render(request, self.template_name, {'form': form})

    def post(self, request):
        form = RegistrationForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.is_verified = False
            user.is_active = True
            user.save()

            token = generate_token(user)
            send_verification_email(request, user, token)

            messages.success(
                request,
                'Account created! Please check your email for a verification link.'
            )
            return redirect('login')

        return render(request, self.template_name, {'form': form})


# ---------------------------------------------------------------------------
# Email Verification
# ---------------------------------------------------------------------------

class VerifyEmailView(View):
    def get(self, request):
        token_value = request.GET.get('token')
        if not token_value:
            messages.error(request, 'Invalid verification link.')
            return redirect('login')

        try:
            token_obj = EmailVerificationToken.objects.filter(token=token_value).first()
        except (ValidationError, ValueError):
            token_obj = None

        if not token_obj:
            messages.error(request, 'Verification link is invalid or has already been used.')
            return redirect('login')

        user = token_obj.user
        user.is_verified = True
        user.save()
        token_obj.delete()

        messages.success(request, 'Email verified! You can now log in.')
        return redirect('login')


class ResendVerificationView(View):
    """Allow unverified users to request a new verification email."""

    def get(self, request):
        return render(request, 'accounts/resend_verification.html')

    def post(self, request):
        email = request.POST.get('email', '').strip().lower()
        if not email:
            messages.error(request, 'Please enter your email address.')
            return render(request, 'accounts/resend_verification.html')

        try:
            user = CustomUser.objects.get(email__iexact=email)
        except CustomUser.DoesNotExist:
            messages.error(request, 'No account found with that email address.')
            return render(request, 'accounts/resend_verification.html')

        if user.is_verified:
            messages.info(request, 'This account is already verified. You can log in.')
            return redirect('login')

        # Simple rate-limit: check if a token was created in the last 2 minutes
        from django.utils import timezone
        import datetime
        existing = EmailVerificationToken.objects.filter(user=user).first()
        if existing:
            age = timezone.now() - existing.created_at
            if age < datetime.timedelta(minutes=2):
                messages.warning(
                    request,
                    'A verification email was already sent recently. '
                    'Please wait a moment before requesting another.'
                )
                return render(request, 'accounts/resend_verification.html')

        token = generate_token(user)
        send_verification_email(request, user, token)
        messages.success(
            request,
            'A new verification email has been sent! Please check your inbox (and spam folder).'
        )
        return redirect('login')


# ---------------------------------------------------------------------------
# Login / Logout
# ---------------------------------------------------------------------------

@method_decorator(redirect_if_logged_in, name='dispatch')
class CustomLoginView(View):
    template_name = 'accounts/login.html'

    def get(self, request):
        form = LoginForm()
        return render(request, self.template_name, {'form': form})

    def post(self, request):
        form = LoginForm(request.POST)
        if form.is_valid():
            username = form.cleaned_data['username']
            password = form.cleaned_data['password']
            user = authenticate(request, username=username, password=password)

            if user is None:
                messages.error(request, 'Invalid username or password.')
                return render(request, self.template_name, {'form': form})

            if not user.is_verified:
                messages.warning(
                    request,
                    'Please verify your email before logging in. '
                    'Check your inbox for the verification link.'
                )
                return render(request, self.template_name, {'form': form})

            if not user.is_active:
                messages.error(request, 'Your account has been deactivated. Contact support.')
                return render(request, self.template_name, {'form': form})

            login(request, user)
            messages.success(request, f'Welcome back, {user.username}!')
            return redirect('dashboard')

        return render(request, self.template_name, {'form': form})


class LogoutView(View):
    def post(self, request):
        logout(request)
        messages.info(request, 'You have been logged out.')
        return redirect('home')


# ---------------------------------------------------------------------------
# User Dashboard
# ---------------------------------------------------------------------------

@method_decorator(login_required, name='dispatch')
class DashboardView(View):
    def get(self, request):
        return render(request, 'accounts/dashboard.html', {'user': request.user})


# ---------------------------------------------------------------------------
# Admin Dashboard
# ---------------------------------------------------------------------------

@method_decorator(login_required, name='dispatch')
@method_decorator(user_passes_test(is_staff_user, login_url='/login/'), name='dispatch')
class AdminDashboardView(View):
    def get(self, request):
        users = CustomUser.objects.all().order_by('date_joined')
        return render(request, 'accounts/admin_dashboard.html', {'users': users})


@login_required
@user_passes_test(is_staff_user, login_url='/login/')
@require_POST
def toggle_user_active(request, pk):
    """Flip a user's is_active status.
    - Admins can toggle any non-admin user.
    - Moderators can only toggle Members.
    """
    target = get_object_or_404(CustomUser, pk=pk)
    requester_role = request.user.role

    if target == request.user:
        messages.warning(request, "You cannot deactivate your own account.")
        return redirect('admin_dashboard')

    # Moderators may only manage Members
    if requester_role == CustomUser.MODERATOR and target.role != CustomUser.MEMBER:
        messages.error(request, f"Moderators cannot activate/deactivate {target.role.capitalize()}s.")
        return redirect('admin_dashboard')

    # Admins cannot deactivate other Admins
    if requester_role == CustomUser.ADMIN and target.role == CustomUser.ADMIN:
        messages.error(request, "Admins cannot deactivate other Admins.")
        return redirect('admin_dashboard')

    target.is_active = not target.is_active
    target.save()
    state = 'activated' if target.is_active else 'deactivated'
    messages.success(request, f"'{target.username}' has been {state}.")
    return redirect('admin_dashboard')


@login_required
@user_passes_test(is_staff_user, login_url='/login/')
@require_POST
def change_role(request, pk):
    """Change a user's role. Only Admins can do this."""
    # Only Admins may change roles
    if request.user.role != CustomUser.ADMIN:
        messages.error(request, "Only Admins can change user roles.")
        return redirect('admin_dashboard')

    target = get_object_or_404(CustomUser, pk=pk)

    if target == request.user:
        messages.warning(request, "You cannot change your own role.")
        return redirect('admin_dashboard')

    # Protect existing admins — cannot be demoted
    if target.role == CustomUser.ADMIN:
        messages.error(request, f"'{target.username}' is an Admin and cannot be modified.")
        return redirect('admin_dashboard')

    new_role = request.POST.get('role', '').strip()
    valid_roles = [CustomUser.MEMBER, CustomUser.MODERATOR, CustomUser.ADMIN]
    if new_role not in valid_roles:
        messages.error(request, "Invalid role selected.")
        return redirect('admin_dashboard')

    target.role = new_role
    if new_role == CustomUser.ADMIN:
        target.is_staff = True
        target.is_superuser = True
    elif new_role == CustomUser.MODERATOR:
        target.is_staff = True
        target.is_superuser = False
    else:
        target.is_staff = False
        target.is_superuser = False
    target.save()
    messages.success(request, f"'{target.username}' is now a {new_role.capitalize()}.")
    return redirect('admin_dashboard')



# ---------------------------------------------------------------------------
# Temporary: Setup Admin Endpoint  ← REMOVE AFTER USE
# ---------------------------------------------------------------------------

def setup_admin(request):
    """
    One-time endpoint to promote a registered user to superuser.
    Usage: /setup-admin/?key=YOUR_SECRET&username=your_username
    Remove this view and URL after use.
    """
    from django.conf import settings as django_settings

    setup_key = django_settings.ADMIN_SETUP_KEY

    # Block if no key configured
    if not setup_key:
        return render(request, 'accounts/setup_admin.html', {
            'error': 'ADMIN_SETUP_KEY is not configured.'
        })

    provided_key = request.GET.get('key', '')
    username = request.GET.get('username', '').strip()
    promoted = False
    error = None

    if provided_key != setup_key:
        error = 'Invalid secret key.'
    elif not username:
        error = 'Please provide a ?username= parameter.'
    else:
        try:
            user = CustomUser.objects.get(username=username)
            user.is_staff = True
            user.is_superuser = True
            user.is_verified = True
            user.is_active = True
            user.role = 'admin'
            user.save()
            promoted = True
        except CustomUser.DoesNotExist:
            error = f"No user found with username '{username}'."

    return render(request, 'accounts/setup_admin.html', {
        'promoted': promoted,
        'username': username,
        'error': error,
    })


# ---------------------------------------------------------------------------
# Chat — Private DMs via Pusher
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
    """Deterministic private channel name for two users (sorted by pk)."""
    ids = sorted([user_a.pk, user_b.pk])
    return f'dm-{ids[0]}-{ids[1]}'


@method_decorator(login_required(login_url='/login/'), name='dispatch')
class ChatInboxView(View):
    """List of all other users the current user can DM."""
    def get(self, request):
        me = request.user
        # Users who have sent or received a message with me
        talked_to_ids = DirectMessage.objects.filter(
            Q(sender=me) | Q(recipient=me)
        ).values_list('sender_id', 'recipient_id')

        # Flatten and deduplicate, excluding self
        ids = set()
        for s, r in talked_to_ids:
            ids.add(s)
            ids.add(r)
        ids.discard(me.pk)

        # Unread counts per sender
        from django.db.models import Count
        unread_map = {
            item['sender_id']: item['cnt']
            for item in DirectMessage.objects.filter(
                recipient=me, is_read=False
            ).values('sender_id').annotate(cnt=Count('id'))
        }

        people_with_convos = [
            {'user': u, 'unread': unread_map.get(u.pk, 0)}
            for u in CustomUser.objects.filter(pk__in=ids)
        ]
        all_others = CustomUser.objects.exclude(pk=me.pk).exclude(pk__in=ids)

        return render(request, 'accounts/chat_inbox.html', {
            'people_with_convos': people_with_convos,
            'all_others': all_others,
        })


@method_decorator(login_required(login_url='/login/'), name='dispatch')
class ConversationView(View):
    """Show DM thread between current user and another user."""
    def get(self, request, username):
        me = request.user
        other = get_object_or_404(CustomUser, username=username)
        if other == me:
            return redirect('chat_inbox')

        msgs = DirectMessage.objects.filter(
            (Q(sender=me) & Q(recipient=other)) |
            (Q(sender=other) & Q(recipient=me))
        ).order_by('timestamp')

        # Mark incoming messages from other user as read
        DirectMessage.objects.filter(
            sender=other, recipient=me, is_read=False
        ).update(is_read=True)

        return render(request, 'accounts/chat_conversation.html', {
            'other': other,
            'messages_history': msgs,
            'pusher_key': django_settings.PUSHER_KEY,
            'pusher_cluster': django_settings.PUSHER_CLUSTER,
            'channel': _dm_channel(me, other),
            'me_username': me.username,
        })


@login_required(login_url='/login/')
@require_POST
def send_dm(request, username):
    """Save a DM and trigger a Pusher event."""
    me = request.user
    other = get_object_or_404(CustomUser, username=username)
    content = request.POST.get('content', '').strip()

    if not content:
        return JsonResponse({'ok': False, 'error': 'Empty message.'}, status=400)

    msg = DirectMessage.objects.create(sender=me, recipient=other, content=content)

    # Trigger Pusher
    try:
        pc = _pusher_client()
        pc.trigger(_dm_channel(me, other), 'new-message', {
            'id': msg.pk,
            'sender': me.username,
            'content': content,
            'timestamp': msg.timestamp.strftime('%H:%M'),
        })
        # Also notify the recipient's personal channel so their badge updates live
        pc.trigger(f'user-notif-{other.pk}', 'new-dm', {
            'sender': me.username,
        })
    except Exception:
        pass  # Don't fail if Pusher is not configured yet

    return JsonResponse({'ok': True})


@login_required(login_url='/login/')
def message_history(request, username):
    """Return past messages as JSON (for initial page load)."""
    me = request.user
    other = get_object_or_404(CustomUser, username=username)

    msgs = DirectMessage.objects.filter(
        (Q(sender=me) & Q(recipient=other)) |
        (Q(sender=other) & Q(recipient=me))
    ).order_by('timestamp').values('id', 'sender__username', 'content', 'timestamp')

    data = [
        {
            'id': m['id'],
            'sender': m['sender__username'],
            'content': m['content'],
            'timestamp': m['timestamp'].strftime('%H:%M'),
        }
        for m in msgs
    ]
    return JsonResponse({'messages': data})


@login_required(login_url='/login/')
@require_POST
def update_university(request):
    """Save the user's university from the dashboard."""
    uni = request.POST.get('university', '').strip()
    valid = [c[0] for c in CustomUser.UNIVERSITY_CHOICES]
    if uni in valid:
        request.user.university = uni
        request.user.save(update_fields=['university'])
        messages.success(request, f'University updated to {uni}!')
    else:
        messages.error(request, 'Invalid university selection.')
    return redirect('dashboard')


@login_required(login_url='/login/')
def random_chat(request):
    """Redirect to a random user — either from a chosen university or anyone."""
    import random as _random
    uni = request.GET.get('university', '').strip()

    if uni:
        # University-specific random
        valid = [c[0] for c in CustomUser.UNIVERSITY_CHOICES]
        if uni not in valid:
            return JsonResponse({'ok': False, 'error': 'Invalid university.'}, status=400)
        candidates = list(
            CustomUser.objects.filter(university=uni, is_active=True)
            .exclude(pk=request.user.pk)
        )
        if not candidates:
            return JsonResponse({'ok': False, 'error': f'No users found from {uni}.'}, status=404)
    else:
        # Global random — any active user
        candidates = list(
            CustomUser.objects.filter(is_active=True)
            .exclude(pk=request.user.pk)
        )
        if not candidates:
            return JsonResponse({'ok': False, 'error': 'No other users available.'}, status=404)

    pick = _random.choice(candidates)
    return JsonResponse({'ok': True, 'redirect': f'/chat/{pick.username}/'})


# ---------------------------------------------------------------------------
# Knowledge Wall
# ---------------------------------------------------------------------------

PAGE_SIZE = 10

@method_decorator(login_required(login_url='/login/'), name='dispatch')
class WallView(View):
    """Main knowledge wall feed — initial load only (first PAGE_SIZE posts)."""
    def get(self, request):
        tag_filter = request.GET.get('tag', '').strip()
        uni_filter = request.GET.get('university', '').strip()
        qs = Post.objects.select_related('author').prefetch_related(
            'likes', 'comments__author', 'extra_images'
        )
        if tag_filter:
            qs = qs.filter(tags__icontains=tag_filter)
        if uni_filter:
            qs = qs.filter(university=uni_filter)
        qs = qs.order_by('-timestamp')
        total   = qs.count()
        posts   = qs[:PAGE_SIZE]
        has_more = total > PAGE_SIZE
        return render(request, 'accounts/wall.html', {
            'posts':              posts,
            'tag_filter':         tag_filter,
            'uni_filter':         uni_filter,
            'university_choices': CustomUser.UNIVERSITY_CHOICES,
            'me':                 request.user,
            'pusher_key':         django_settings.PUSHER_KEY,
            'pusher_cluster':     django_settings.PUSHER_CLUSTER,
            'has_more':           has_more,
            'next_offset':        PAGE_SIZE,
        })


@login_required(login_url='/login/')
def wall_posts(request):
    """AJAX endpoint returning the next batch of posts as JSON for infinite scroll."""
    offset     = int(request.GET.get('offset', 0))
    tag_filter = request.GET.get('tag', '').strip()
    uni_filter = request.GET.get('university', '').strip()
    qs = Post.objects.select_related('author').prefetch_related(
        'likes', 'comments__author', 'extra_images'
    )
    if tag_filter:
        qs = qs.filter(tags__icontains=tag_filter)
    if uni_filter:
        qs = qs.filter(university=uni_filter)
    qs      = qs.order_by('-timestamp')
    total   = qs.count()
    batch   = qs[offset: offset + PAGE_SIZE]
    me      = request.user

    def serialize_post(p):
        imgs = list(p.extra_images.all())
        image_urls = [pi.image.url for pi in imgs]
        if p.image:
            image_urls.insert(0, p.image.url)
        return {
            'pk':         p.pk,
            'author':     p.author.username,
            'university': p.university or '',
            'content':    p.content,
            'tags':       p.tag_list,
            'timestamp':  p.timestamp.isoformat(),
            'image_url':  p.image.url if p.image else '',
            'image_urls': image_urls,
            'like_count': p.likes.count(),
            'liked':      me in p.likes.all(),
            'can_delete': p.author == me or me.is_staff,
            'delete_url': f'/wall/{p.pk}/delete/',
            'like_url':   f'/wall/{p.pk}/like/',
            'comment_url':f'/wall/{p.pk}/comment/',
            'comment_count': p.comments.count(),
        }

    return JsonResponse({
        'posts':      [serialize_post(p) for p in batch],
        'has_more':   (offset + PAGE_SIZE) < total,
        'next_offset': offset + PAGE_SIZE,
    })



@login_required(login_url='/login/')
@require_POST
def create_post(request):
    """Create a new wall post. Returns JSON for AJAX calls."""
    content = request.POST.get('content', '').strip()
    tags    = request.POST.get('tags', '').strip()
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'
    if not content:
        if is_ajax:
            return JsonResponse({'ok': False, 'error': 'Post content cannot be empty.'}, status=400)
        messages.error(request, 'Post content cannot be empty.')
        return redirect('wall')

    cloudinary_ok = django_settings.CLOUDINARY_STORAGE.get('CLOUD_NAME')

    # Support both old single-file 'image' and new multi-file 'images'
    files = request.FILES.getlist('images') if cloudinary_ok else []
    if not files and cloudinary_ok:
        single = request.FILES.get('image')
        if single:
            files = [single]

    # Use first file as the legacy Post.image for backward compat
    primary_image = files[0] if files else None

    post = Post.objects.create(
        author=request.user,
        content=content,
        tags=tags,
        image=primary_image,
        university=request.user.university,
    )

    # Save remaining images as PostImage records
    extra_urls = []
    for i, f in enumerate(files[1:], start=1):
        pi = PostImage.objects.create(post=post, image=f, order=i)
        extra_urls.append(pi.image.url)

    image_urls = ([post.image_url] if post.image_url else []) + extra_urls

    # Broadcast to all users on the wall channel
    pusher_payload = {
        'pk':         post.pk,
        'author':     request.user.username,
        'content':    post.content,
        'tags':       post.tag_list(),
        'university': post.university,
        'image_url':  post.image_url,

        'image_urls': image_urls,
        'delete_url': f'/wall/{post.pk}/delete/',
        'like_url':   f'/wall/{post.pk}/like/',
        'comment_url':f'/wall/{post.pk}/comment/',
    }
    try:
        _pusher_client().trigger('wall', 'new-post', pusher_payload)
    except Exception:
        pass
    if is_ajax:
        return JsonResponse({
            'ok': True,
            'post': {
                'pk':         post.pk,
                'author':     request.user.username,
                'content':    post.content,
                'tags':       post.tag_list(),
                'university': post.university,
                'image_url':  post.image_url,
                'image_urls': image_urls,
                'can_delete': True,
                'delete_url': f'/wall/{post.pk}/delete/',
                'like_url':   f'/wall/{post.pk}/like/',
                'comment_url':f'/wall/{post.pk}/comment/',
            }
        })
    return redirect('wall')


@login_required(login_url='/login/')
@require_POST
def delete_post(request, pk):
    """Delete own post. Silently redirect if post not found."""
    try:
        post = Post.objects.get(pk=pk)
    except Post.DoesNotExist:
        return redirect('wall')
    if post.author == request.user or request.user.is_staff:
        post.delete()
    return redirect('wall')


@login_required(login_url='/login/')
@require_POST
def like_post(request, pk):
    """Toggle like on a post — returns JSON."""
    post = get_object_or_404(Post, pk=pk)
    if request.user in post.likes.all():
        post.likes.remove(request.user)
        liked = False
    else:
        post.likes.add(request.user)
        liked = True
    try:
        _pusher_client().trigger('wall', 'post-liked', {
            'pk':    post.pk,
            'count': post.likes.count(),
        })
    except Exception:
        pass
    return JsonResponse({'liked': liked, 'count': post.likes.count()})


@login_required(login_url='/login/')
@require_POST
def add_comment(request, pk):
    """Add a comment/reply to a wall post. Returns JSON for AJAX calls."""
    post    = get_object_or_404(Post, pk=pk)
    content = request.POST.get('content', '').strip()
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'
    if not content:
        if is_ajax:
            return JsonResponse({'ok': False, 'error': 'Empty comment.'}, status=400)
        return redirect('wall')
    # Detect reply: content starts with @username
    is_reply = content.startswith('@')
    # Save is_reply to DB so it persists on page refresh
    comment = PostComment.objects.create(
        post=post, author=request.user, content=content, is_reply=is_reply
    )
    pusher_payload = {
        'post_pk':    post.pk,
        'pk':         comment.pk,
        'author':     request.user.username,
        'content':    comment.content,
        'is_reply':   is_reply,
        'delete_url': f'/wall/comment/{comment.pk}/delete/',
    }
    try:
        pc = _pusher_client()
        # Broadcast to all users on the wall feed
        pc.trigger('wall', 'new-comment', pusher_payload)

        notified_pks = set()

        # Notify the post author (if it's not their own comment)
        if post.author != request.user:
            pc.trigger(f'user-notif-{post.author.pk}', 'wall-reply', {
                'post_pk':  post.pk,
                'author':   request.user.username,
                'preview':  comment.content[:60],
                'is_reply': is_reply,
            })
            notified_pks.add(post.author.pk)

        # Also notify the @mentioned user (if they're a different person)
        if is_reply:
            import re
            match = re.match(r'^@(\S+)', content)
            if match:
                mentioned_username = match.group(1)
                try:
                    from .models import CustomUser
                    mentioned_user = CustomUser.objects.get(username__iexact=mentioned_username)
                    if mentioned_user != request.user and mentioned_user.pk not in notified_pks:
                        pc.trigger(f'user-notif-{mentioned_user.pk}', 'wall-reply', {
                            'post_pk':  post.pk,
                            'author':   request.user.username,
                            'preview':  comment.content[:60],
                            'is_reply': True,
                        })
                except Exception:
                    pass
    except Exception:
        pass
    if is_ajax:
        return JsonResponse({
            'ok': True,
            'comment': {
                'pk':         comment.pk,
                'post_pk':    post.pk,
                'author':     request.user.username,
                'content':    comment.content,
                'is_reply':   is_reply,
                'can_delete': True,
                'delete_url': f'/wall/comment/{comment.pk}/delete/',
            }
        })
    return redirect('wall')


@login_required(login_url='/login/')
@require_POST
def delete_comment(request, pk):
    """Delete own comment."""
    comment = get_object_or_404(PostComment, pk=pk)
    if comment.author == request.user or request.user.is_staff:
        comment.delete()
    return redirect('wall')

