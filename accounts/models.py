import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
from cloudinary.models import CloudinaryField


class CustomUser(AbstractUser):
    """Extended user model with email verification and role support."""
    MEMBER    = 'member'
    MODERATOR = 'moderator'
    ADMIN     = 'admin'
    ROLE_CHOICES = [
        (MEMBER,    'Member'),
        (MODERATOR, 'Moderator'),
        (ADMIN,     'Admin'),
    ]

    UNIVERSITY_CHOICES = [
        ('CTU', 'CTU - Cebu Technological University'),
        ('CEC', 'CEC - Cebu Eastern College'),
        ('SWU', 'SWU - Southwestern University'),
        ('ACT', 'ACT - Asian College of Technology'),
        ('UV',  'UV - University of the Visayas'),
    ]

    email        = models.EmailField(unique=True)
    is_verified  = models.BooleanField(default=False)
    role         = models.CharField(max_length=20, choices=ROLE_CHOICES, default=MEMBER)
    university   = models.CharField(max_length=10, blank=True, default='', choices=UNIVERSITY_CHOICES)

    def __str__(self):
        return self.username


class EmailVerificationToken(models.Model):
    """One-time token sent to users to verify their email address."""
    user = models.OneToOneField(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='verification_token'
    )
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Token for {self.user.username}"


class DirectMessage(models.Model):
    """Private message between two users."""
    sender    = models.ForeignKey(
        'CustomUser', on_delete=models.CASCADE, related_name='sent_messages'
    )
    recipient = models.ForeignKey(
        'CustomUser', on_delete=models.CASCADE, related_name='received_messages'
    )
    content   = models.TextField(max_length=2000)
    timestamp = models.DateTimeField(default=timezone.now)
    is_read   = models.BooleanField(default=False)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f"{self.sender} → {self.recipient}: {self.content[:40]}"


class Post(models.Model):
    """A knowledge-sharing post on the Wall."""
    author    = models.ForeignKey(
        'CustomUser', on_delete=models.CASCADE, related_name='posts'
    )
    content   = models.TextField(max_length=3000)
    image     = CloudinaryField('image', blank=True, null=True)
    tags      = models.CharField(max_length=200, blank=True, default='',
                                 help_text='Comma-separated tags, e.g. django,python')
    university = models.CharField(max_length=10, blank=True, default='')
    likes     = models.ManyToManyField(
        'CustomUser', blank=True, related_name='liked_posts'
    )
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.author} — {self.content[:60]}"

    def tag_list(self):
        return [t.strip() for t in self.tags.split(',') if t.strip()]

    @property
    def image_url(self):
        """Returns the Cloudinary URL safely, or empty string if no image."""
        try:
            if self.image and str(self.image):
                return self.image.url
        except Exception:
            pass
        return ''


class PostComment(models.Model):
    """A comment on a Wall post."""
    post      = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments')
    author    = models.ForeignKey(
        'CustomUser', on_delete=models.CASCADE, related_name='post_comments'
    )
    content   = models.TextField(max_length=1000)
    timestamp = models.DateTimeField(default=timezone.now)
    is_reply  = models.BooleanField(default=False)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f"{self.author} on Post#{self.post_id}: {self.content[:40]}"


class PostImage(models.Model):
    """Extra images attached to a Wall post (supports multi-image upload)."""
    post  = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='extra_images')
    image = CloudinaryField('image')
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"Image {self.order} for Post#{self.post_id}"


# ──────────────────────────────────────────
# Workspace (Notion-style personal workspace)
# ──────────────────────────────────────────

class WorkspaceDoc(models.Model):
    """A Notion-like document / workspace page owned by one user."""
    TYPE_TODO       = 'todo'
    TYPE_PROJECT    = 'project'
    TYPE_BRAINSTORM = 'brainstorm'
    TYPE_GOAL       = 'goal'
    TYPE_NOTE       = 'note'

    TYPE_CHOICES = [
        (TYPE_TODO,       'To-Do List'),
        (TYPE_PROJECT,    'Project Tracker'),
        (TYPE_BRAINSTORM, 'Brainstorm'),
        (TYPE_GOAL,       'Goal Tracker'),
        (TYPE_NOTE,       'Notes'),
    ]

    owner      = models.ForeignKey('CustomUser', on_delete=models.CASCADE, related_name='workspace_docs')
    type       = models.CharField(max_length=20, choices=TYPE_CHOICES)
    title      = models.CharField(max_length=200, default='Untitled')
    color      = models.CharField(max_length=20, default='#4E7C3F')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.owner.username} — {self.title}"


class WorkspaceItem(models.Model):
    """An individual item inside a WorkspaceDoc (task, card, sticky note, goal, etc.)."""
    STATUS_TODO        = 'todo'
    STATUS_IN_PROGRESS = 'in_progress'
    STATUS_DONE        = 'done'
    STATUS_BLOCKED     = 'blocked'

    STATUS_CHOICES = [
        (STATUS_TODO,        'To Do'),
        (STATUS_IN_PROGRESS, 'In Progress'),
        (STATUS_DONE,        'Done'),
        (STATUS_BLOCKED,     'Blocked'),
    ]

    PRIORITY_LOW    = 'low'
    PRIORITY_MEDIUM = 'medium'
    PRIORITY_HIGH   = 'high'

    PRIORITY_CHOICES = [
        (PRIORITY_LOW,    'Low'),
        (PRIORITY_MEDIUM, 'Medium'),
        (PRIORITY_HIGH,   'High'),
    ]

    TYPE_FEATURE  = 'feature'
    TYPE_BUG      = 'bug'
    TYPE_RESEARCH = 'research'
    TYPE_MEETING  = 'meeting'
    TYPE_PERSONAL = 'personal'
    TYPE_OTHER    = 'other'

    TASK_TYPE_CHOICES = [
        (TYPE_FEATURE,  'Feature'),
        (TYPE_BUG,      'Bug'),
        (TYPE_RESEARCH, 'Research'),
        (TYPE_MEETING,  'Meeting'),
        (TYPE_PERSONAL, 'Personal'),
        (TYPE_OTHER,    'Other'),
    ]

    EFFORT_XS = 'xs'
    EFFORT_S  = 's'
    EFFORT_M  = 'm'
    EFFORT_L  = 'l'
    EFFORT_XL = 'xl'

    EFFORT_CHOICES = [
        (EFFORT_XS, 'XS'),
        (EFFORT_S,  'S'),
        (EFFORT_M,  'M'),
        (EFFORT_L,  'L'),
        (EFFORT_XL, 'XL'),
    ]

    doc         = models.ForeignKey(WorkspaceDoc, on_delete=models.CASCADE, related_name='items')
    content     = models.TextField()
    description = models.TextField(blank=True, default='')
    is_done     = models.BooleanField(default=False)
    status      = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_TODO)
    priority    = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default=PRIORITY_MEDIUM)
    task_type   = models.CharField(max_length=20, choices=TASK_TYPE_CHOICES, default=TYPE_OTHER, blank=True)
    effort      = models.CharField(max_length=5,  choices=EFFORT_CHOICES,    default=EFFORT_M,   blank=True)
    due_date    = models.DateField(null=True, blank=True)
    order       = models.IntegerField(default=0)
    color       = models.CharField(max_length=20, default='#fef9c3')  # brainstorm sticky-note color
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"Item in '{self.doc.title}': {self.content[:40]}"

