from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required, user_passes_test
from django.views.decorators.http import require_POST
from django.utils.decorators import method_decorator
from django.views import View
from django.core.exceptions import ValidationError

from .forms import RegistrationForm, LoginForm
from .models import CustomUser, EmailVerificationToken
from .tokens import generate_token, send_verification_email


def converter(request):
    """File converter landing page — all conversions happen client-side."""
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

