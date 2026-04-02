from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone

from accounts.models import (
    CustomUser, DirectMessage, Post, PostComment, PostImage,
    WorkspaceDoc, WorkspaceItem,
)


# ─────────────────────────────────────────────────────────────
# User Serializers
# ─────────────────────────────────────────────────────────────

class UserMiniSerializer(serializers.ModelSerializer):
    """Compact user info used inside other serializers."""
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'display_name', 'university', 'avatar_url']

    def get_avatar_url(self, obj):
        try:
            if obj.avatar and str(obj.avatar):
                return obj.avatar.url
        except Exception:
            pass
        return ''


class UserProfileSerializer(serializers.ModelSerializer):
    """Full profile for /api/v1/profile/."""
    avatar_url = serializers.SerializerMethodField()
    post_count = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = [
            'id', 'username', 'email', 'display_name', 'university',
            'avatar_url', 'role', 'is_verified', 'date_joined', 'post_count',
        ]
        read_only_fields = ['id', 'username', 'email', 'role', 'is_verified', 'date_joined']

    def get_avatar_url(self, obj):
        try:
            if obj.avatar and str(obj.avatar):
                return obj.avatar.url
        except Exception:
            pass
        return ''

    def get_post_count(self, obj):
        return obj.posts.count()


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    password2 = serializers.CharField(write_only=True)

    def validate_username(self, value):
        if CustomUser.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('This username is already taken.')
        return value

    def validate_email(self, value):
        if CustomUser.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value

    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError({'password2': 'Passwords do not match.'})
        validate_password(data['password'])
        return data

    def create(self, validated_data):
        user = CustomUser.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            is_verified=False,
            is_active=True,
        )
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(username=data['username'], password=data['password'])
        if not user:
            raise serializers.ValidationError('Invalid username or password.')
        if not user.is_active:
            raise serializers.ValidationError('Your account has been deactivated.')
        data['user'] = user
        return data


class UpdateProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['display_name', 'university']


# ─────────────────────────────────────────────────────────────
# Post / Wall Serializers
# ─────────────────────────────────────────────────────────────

class PostCommentSerializer(serializers.ModelSerializer):
    author = UserMiniSerializer(read_only=True)

    class Meta:
        model = PostComment
        fields = ['id', 'author', 'content', 'timestamp', 'is_reply']


class PostSerializer(serializers.ModelSerializer):
    author = UserMiniSerializer(read_only=True)
    like_count = serializers.SerializerMethodField()
    liked = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    extra_image_urls = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    comments = PostCommentSerializer(many=True, read_only=True)
    tags = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id', 'author', 'content', 'tags', 'university',
            'image_url', 'extra_image_urls',
            'like_count', 'liked', 'can_delete',
            'comment_count', 'comments', 'timestamp',
        ]

    def get_like_count(self, obj):
        return obj.likes.count()

    def get_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(pk=request.user.pk).exists()
        return False

    def get_can_delete(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.author == request.user or request.user.is_staff
        return False

    def get_image_url(self, obj):
        try:
            if obj.image and str(obj.image):
                return obj.image.url
        except Exception:
            pass
        return ''

    def get_extra_image_urls(self, obj):
        urls = []
        for pi in obj.extra_images.all():
            try:
                if pi.image and str(pi.image):
                    urls.append(pi.image.url)
            except Exception:
                pass
        return urls

    def get_comment_count(self, obj):
        return obj.comments.count()

    def get_tags(self, obj):
        return obj.tag_list()


# ─────────────────────────────────────────────────────────────
# Chat Serializers
# ─────────────────────────────────────────────────────────────

class DirectMessageSerializer(serializers.ModelSerializer):
    sender = serializers.StringRelatedField()
    recipient = serializers.StringRelatedField()

    class Meta:
        model = DirectMessage
        fields = ['id', 'sender', 'recipient', 'content', 'timestamp', 'is_read']


class InboxEntrySerializer(serializers.Serializer):
    """One conversation entry in the chat inbox."""
    user = UserMiniSerializer()
    last_message = serializers.CharField()
    last_timestamp = serializers.DateTimeField()
    unread_count = serializers.IntegerField()


# ─────────────────────────────────────────────────────────────
# Workspace Serializers
# ─────────────────────────────────────────────────────────────

class WorkspaceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkspaceItem
        fields = [
            'id', 'content', 'description', 'is_done', 'status',
            'priority', 'task_type', 'effort', 'due_date', 'start_date',
            'progress', 'order', 'color', 'created_at',
        ]


class WorkspaceDocSerializer(serializers.ModelSerializer):
    items = WorkspaceItemSerializer(many=True, read_only=True)
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = WorkspaceDoc
        fields = [
            'id', 'type', 'title', 'color', 'created_at', 'updated_at',
            'items', 'item_count',
        ]

    def get_item_count(self, obj):
        return obj.items.count()


class WorkspaceDocListSerializer(serializers.ModelSerializer):
    """Lightweight version (no items) for the doc list screen."""
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = WorkspaceDoc
        fields = ['id', 'type', 'title', 'color', 'updated_at', 'item_count']

    def get_item_count(self, obj):
        return obj.items.count()
