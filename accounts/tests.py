from django.test import TestCase, Client
from django.urls import reverse
from .models import CustomUser, EmailVerificationToken


class RegistrationTests(TestCase):
    def test_register_creates_unverified_user(self):
        """A newly registered user should be unverified."""
        response = self.client.post(reverse('register'), {
            'username': 'testuser',
            'email': 'test@example.com',
            'password1': 'SecureP@ss123',
            'password2': 'SecureP@ss123',
        })
        self.assertRedirects(response, reverse('login'))
        user = CustomUser.objects.get(username='testuser')
        self.assertFalse(user.is_verified)

    def test_duplicate_email_rejected(self):
        """Registering with an existing email should fail."""
        CustomUser.objects.create_user('existing', 'dup@example.com', 'pass')
        response = self.client.post(reverse('register'), {
            'username': 'newuser',
            'email': 'dup@example.com',
            'password1': 'SecureP@ss123',
            'password2': 'SecureP@ss123',
        })
        self.assertEqual(response.status_code, 200)  # form re-renders with error
        form = response.context['form']
        self.assertIn('An account with this email already exists.', form.errors.get('email', []))

    def test_verification_token_created_on_register(self):
        """A verification token should be created after registration."""
        self.client.post(reverse('register'), {
            'username': 'tokenuser',
            'email': 'token@example.com',
            'password1': 'SecureP@ss123',
            'password2': 'SecureP@ss123',
        })
        user = CustomUser.objects.get(username='tokenuser')
        self.assertTrue(EmailVerificationToken.objects.filter(user=user).exists())


class EmailVerificationTests(TestCase):
    def setUp(self):
        self.user = CustomUser.objects.create_user(
            username='verifyme', email='verify@example.com', password='SecureP@ss123'
        )
        self.user.is_verified = False
        self.user.save()
        self.token_obj = EmailVerificationToken.objects.create(user=self.user)

    def test_valid_token_verifies_user(self):
        """Clicking a valid verification link should verify the user."""
        response = self.client.get(reverse('verify_email'), {'token': str(self.token_obj.token)})
        self.assertRedirects(response, reverse('login'))
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_verified)

    def test_invalid_token_shows_error(self):
        """An invalid token (valid UUID format but non-existent) should NOT verify."""
        import uuid
        fake_token = str(uuid.uuid4())  # valid UUID format but not in DB
        response = self.client.get(reverse('verify_email'), {'token': fake_token})
        self.assertRedirects(response, reverse('login'))
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_verified)

    def test_token_deleted_after_verification(self):
        """The token should be deleted after successful verification."""
        self.client.get(reverse('verify_email'), {'token': str(self.token_obj.token)})
        self.assertFalse(EmailVerificationToken.objects.filter(user=self.user).exists())


class LoginTests(TestCase):
    def setUp(self):
        self.verified_user = CustomUser.objects.create_user(
            username='verified', email='v@example.com', password='SecureP@ss123'
        )
        self.verified_user.is_verified = True
        self.verified_user.save()

        self.unverified_user = CustomUser.objects.create_user(
            username='unverified', email='u@example.com', password='SecureP@ss123'
        )
        self.unverified_user.is_verified = False
        self.unverified_user.save()

    def test_login_verified_user_succeeds(self):
        """A verified user should be logged in and redirected to dashboard."""
        response = self.client.post(reverse('login'), {
            'username': 'verified', 'password': 'SecureP@ss123'
        })
        self.assertRedirects(response, reverse('dashboard'))

    def test_login_unverified_user_blocked(self):
        """An unverified user should NOT be logged in."""
        response = self.client.post(reverse('login'), {
            'username': 'unverified', 'password': 'SecureP@ss123'
        })
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.wsgi_request.user.is_authenticated)

    def test_login_wrong_password(self):
        """Wrong password should fail login."""
        response = self.client.post(reverse('login'), {
            'username': 'verified', 'password': 'WrongPass'
        })
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.wsgi_request.user.is_authenticated)


class DashboardAccessTests(TestCase):
    def setUp(self):
        self.user = CustomUser.objects.create_user(
            username='dashuser', email='dash@example.com', password='SecureP@ss123'
        )
        self.user.is_verified = True
        self.user.save()

    def test_dashboard_requires_login(self):
        """Dashboard should redirect unauthenticated users to login."""
        response = self.client.get(reverse('dashboard'))
        self.assertRedirects(response, f"{reverse('login')}?next={reverse('dashboard')}")

    def test_dashboard_accessible_when_logged_in(self):
        """Dashboard should return 200 for authenticated users."""
        self.client.force_login(self.user)
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 200)


class AdminDashboardTests(TestCase):
    def setUp(self):
        self.regular_user = CustomUser.objects.create_user(
            username='regular', email='r@example.com', password='SecureP@ss123'
        )
        self.regular_user.is_verified = True
        self.regular_user.save()

        self.staff_user = CustomUser.objects.create_user(
            username='staffmember', email='staff@example.com', password='SecureP@ss123'
        )
        self.staff_user.is_staff = True
        self.staff_user.is_verified = True
        self.staff_user.save()

    def test_admin_dashboard_denied_for_regular_user(self):
        """Regular users should NOT have access to admin dashboard."""
        self.client.force_login(self.regular_user)
        response = self.client.get(reverse('admin_dashboard'))
        self.assertNotEqual(response.status_code, 200)

    def test_admin_dashboard_accessible_for_staff(self):
        """Staff users should be able to access admin dashboard."""
        self.client.force_login(self.staff_user)
        response = self.client.get(reverse('admin_dashboard'))
        self.assertEqual(response.status_code, 200)
