from rest_framework import serializers
from accounts.models import (
    CustomUser, Post, PostComment, PostImage,
    DirectMessage, WorkspaceDoc, WorkspaceItem,
)


# ---------------------------------------------------------------------------
# Auth / User
# ---------------------------------------------------------------------------

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model  = CustomUser
        fields = ['username', 'email', 'password']

    def validate_email(self, value):
        if CustomUser.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value.lower()

    def create(self, validated_data):
        user = CustomUser.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            is_verified=False,
            is_active=True,
        )
        return user


class UserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model  = CustomUser
        fields = [
            'id', 'username', 'email', 'display_name',
            'university', 'role', 'is_verified', 'avatar_url',
        ]
        read_only_fields = fields

    def get_avatar_url(self, obj):
        try:
            if obj.avatar and str(obj.avatar):
                return obj.avatar.url
        except Exception:
            pass
        return ''


# ---------------------------------------------------------------------------
# Wall
# ---------------------------------------------------------------------------

class PostCommentSerializer(serializers.ModelSerializer):
    author = serializers.CharField(source='author.username', read_only=True)

    class Meta:
        model  = PostComment
        fields = ['pk', 'author', 'content', 'is_reply', 'timestamp']


class PostImageSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model  = PostImage
        fields = ['pk', 'url', 'order']

    def get_url(self, obj):
        try:
            return obj.image.url if obj.image and str(obj.image) else ''
        except Exception:
            return ''


class PostSerializer(serializers.ModelSerializer):
    author       = serializers.CharField(source='author.username', read_only=True)
    author_id    = serializers.IntegerField(source='author.pk', read_only=True)
    university   = serializers.CharField(read_only=True)
    tags         = serializers.SerializerMethodField()
    image_url    = serializers.SerializerMethodField()
    image_urls   = serializers.SerializerMethodField()
    like_count   = serializers.SerializerMethodField()
    liked        = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    comments     = PostCommentSerializer(many=True, read_only=True)
    can_delete   = serializers.SerializerMethodField()

    class Meta:
        model  = Post
        fields = [
            'pk', 'author', 'author_id', 'university', 'content', 'tags',
            'image_url', 'image_urls',
            'like_count', 'liked', 'comment_count', 'comments',
            'can_delete', 'timestamp',
        ]

    def get_tags(self, obj):
        return obj.tag_list()

    def get_image_url(self, obj):
        return obj.image_url

    def get_image_urls(self, obj):
        urls = []
        if obj.image_url:
            urls.append(obj.image_url)
        for pi in obj.extra_images.all():
            try:
                u = pi.image.url if pi.image and str(pi.image) else ''
                if u:
                    urls.append(u)
            except Exception:
                pass
        return urls

    def get_like_count(self, obj):
        return obj.likes.count()

    def get_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return request.user in obj.likes.all()
        return False

    def get_comment_count(self, obj):
        return obj.comments.count()

    def get_can_delete(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.author == request.user or request.user.is_staff
        return False


# ---------------------------------------------------------------------------
# Chat (DMs)
# ---------------------------------------------------------------------------

class DirectMessageSerializer(serializers.ModelSerializer):
    sender    = serializers.CharField(source='sender.username', read_only=True)
    recipient = serializers.CharField(source='recipient.username', read_only=True)

    class Meta:
        model  = DirectMessage
        fields = ['pk', 'sender', 'recipient', 'content', 'timestamp', 'is_read']


class ChatUserSerializer(serializers.ModelSerializer):
    """Lightweight user info for the inbox list."""
    avatar_url = serializers.SerializerMethodField()
    unread     = serializers.IntegerField(default=0)

    class Meta:
        model  = CustomUser
        fields = ['id', 'username', 'display_name', 'university', 'avatar_url', 'unread']

    def get_avatar_url(self, obj):
        try:
            if obj.avatar and str(obj.avatar):
                return obj.avatar.url
        except Exception:
            pass
        return ''


# ---------------------------------------------------------------------------
# Workspace
# ---------------------------------------------------------------------------

class WorkspaceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model  = WorkspaceItem
        fields = [
            'pk', 'content', 'description', 'is_done', 'status',
            'priority', 'task_type', 'effort',
            'due_date', 'start_date', 'progress', 'order', 'color', 'created_at',
        ]


class WorkspaceDocSerializer(serializers.ModelSerializer):
    items = WorkspaceItemSerializer(many=True, read_only=True)

    class Meta:
        model  = WorkspaceDoc
        fields = ['pk', 'type', 'title', 'color', 'created_at', 'updated_at', 'items']
