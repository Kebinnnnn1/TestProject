import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert, Modal, ScrollView,
  KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { wallAPI } from '../../services/api';
import { useAuthStore } from '../../store';
import { Colors, Spacing, Radius } from '../../constants';

// ── Types ──────────────────────────────────────────────────────────────────

interface Comment {
  id: number;
  author: { username: string; display_name: string; avatar_url: string };
  content: string;
  timestamp: string;
}

interface Post {
  id: number;
  author: { username: string; display_name: string; avatar_url: string; university: string };
  content: string;
  tags: string[];
  university: string;
  image_url: string;
  extra_image_urls: string[];
  like_count: number;
  liked: boolean;
  can_delete: boolean;
  comment_count: number;
  comments: Comment[];
  timestamp: string;
}

// ── Post Card ──────────────────────────────────────────────────────────────

function PostCard({ post, onLike, onDelete, onComment }: {
  post: Post;
  onLike: (id: number) => void;
  onDelete: (id: number) => void;
  onComment: (post: Post) => void;
}) {
  const allImages = [post.image_url, ...post.extra_image_urls].filter(Boolean);
  const displayName = post.author.display_name || post.author.username;

  return (
    <View style={styles.card}>
      {/* Author header */}
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          {post.author.avatar_url ? (
            <Image source={{ uri: post.author.avatar_url }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarFallback}>{displayName.charAt(0).toUpperCase()}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.authorName}>{displayName}</Text>
          <Text style={styles.authorMeta}>
            @{post.author.username}
            {post.university ? ` · ${post.university}` : ''}
            {' · '}{formatTime(post.timestamp)}
          </Text>
        </View>
        {post.can_delete && (
          <TouchableOpacity onPress={() => onDelete(post.id)} style={styles.deleteBtn}>
            <Text style={styles.deleteBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <Text style={styles.postContent}>{post.content}</Text>

      {/* Tags */}
      {post.tags.length > 0 && (
        <View style={styles.tags}>
          {post.tags.map((t, i) => (
            <View key={i} style={styles.tag}>
              <Text style={styles.tagText}>#{t}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Images */}
      {allImages.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageRow}>
          {allImages.map((url, i) => (
            <Image key={i} source={{ uri: url }} style={styles.postImage} contentFit="cover" />
          ))}
        </ScrollView>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onLike(post.id)}>
          <Text style={[styles.actionIcon, post.liked && styles.liked]}>
            {post.liked ? '❤️' : '🤍'}
          </Text>
          <Text style={[styles.actionCount, post.liked && styles.likedText]}>
            {post.like_count}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => onComment(post)}>
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionCount}>{post.comment_count}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────

export default function WallScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const [createVisible, setCreateVisible] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState('');
  const [pickedImages, setPickedImages] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);

  const [commentPost, setCommentPost] = useState<Post | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commenting, setCommenting] = useState(false);

  const { user } = useAuthStore();

  const loadPosts = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true);
      setOffset(0);
    }
    try {
      const res = await wallAPI.getPosts({ offset: reset ? 0 : offset });
      const newPosts = res.data.posts;
      setPosts((prev) => reset ? newPosts : [...prev, ...newPosts]);
      setHasMore(res.data.has_more);
      setOffset(reset ? newPosts.length : offset + newPosts.length);
    } catch {
      Alert.alert('Error', 'Could not load posts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [offset]);

  React.useEffect(() => { loadPosts(true); }, []);

  const onRefresh = () => { setRefreshing(true); loadPosts(true); };

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await wallAPI.getPosts({ offset });
      setPosts((prev) => [...prev, ...res.data.posts]);
      setHasMore(res.data.has_more);
      setOffset((prev) => prev + res.data.posts.length);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleLike = async (id: number) => {
    try {
      const res = await wallAPI.likePost(id);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, liked: res.data.liked, like_count: res.data.like_count } : p
        )
      );
    } catch {}
  };

  const handleDelete = (id: number) => {
    Alert.alert('Delete Post', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await wallAPI.deletePost(id);
            setPosts((prev) => prev.filter((p) => p.id !== id));
          } catch {
            Alert.alert('Error', 'Could not delete post.');
          }
        },
      },
    ]);
  };

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setPickedImages(result.assets.map((a) => a.uri));
    }
  };

  const handleCreatePost = async () => {
    if (!newContent.trim()) {
      Alert.alert('Error', 'Post content cannot be empty.');
      return;
    }
    setPosting(true);
    try {
      const formData = new FormData();
      formData.append('content', newContent.trim());
      formData.append('tags', newTags.trim());
      pickedImages.forEach((uri, i) => {
        formData.append('images', {
          uri,
          name: `image_${i}.jpg`,
          type: 'image/jpeg',
        } as any);
      });

      const res = await wallAPI.createPost(formData);
      setPosts((prev) => [res.data, ...prev]);
      setCreateVisible(false);
      setNewContent('');
      setNewTags('');
      setPickedImages([]);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Could not create post.');
    } finally {
      setPosting(false);
    }
  };

  const handleComment = async () => {
    if (!commentPost || !commentText.trim()) return;
    setCommenting(true);
    try {
      const res = await wallAPI.addComment(commentPost.id, commentText.trim());
      setPosts((prev) =>
        prev.map((p) =>
          p.id === commentPost.id
            ? { ...p, comments: [...p.comments, res.data], comment_count: p.comment_count + 1 }
            : p
        )
      );
      setCommentText('');
    } catch {
      Alert.alert('Error', 'Could not add comment.');
    } finally {
      setCommenting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Knowledge Wall</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => {
          if (!user?.is_verified) {
            Alert.alert('Verify Email', 'Please verify your email to post.');
            return;
          }
          setCreateVisible(true);
        }}>
          <Text style={styles.createBtnText}>+ Post</Text>
        </TouchableOpacity>
      </View>

      {/* Feed */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onLike={handleLike}
            onDelete={handleDelete}
            onComment={setCommentPost}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={Colors.primary} style={{ margin: 16 }} /> : null}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No posts yet. Be the first!</Text>
          </View>
        }
      />

      {/* Create Post Modal */}
      <Modal visible={createVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Post</Text>
              <TouchableOpacity onPress={() => setCreateVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.textArea}
              placeholder="Share knowledge with the community..."
              placeholderTextColor={Colors.textMuted}
              multiline
              value={newContent}
              onChangeText={setNewContent}
              textAlignVertical="top"
            />

            <TextInput
              style={styles.input}
              placeholder="Tags (comma separated, e.g. django,python)"
              placeholderTextColor={Colors.textMuted}
              value={newTags}
              onChangeText={setNewTags}
            />

            <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImages}>
              <Text style={styles.imagePickerText}>
                📷 {pickedImages.length > 0 ? `${pickedImages.length} image(s) selected` : 'Add Images'}
              </Text>
            </TouchableOpacity>

            {pickedImages.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickedRow}>
                {pickedImages.map((uri, i) => (
                  <Image key={i} source={{ uri }} style={styles.pickedThumb} contentFit="cover" />
                ))}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.postBtn} onPress={handleCreatePost} disabled={posting}>
              {posting ? <ActivityIndicator color="#fff" /> : <Text style={styles.postBtnText}>Publish Post</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Comments Modal */}
      <Modal visible={!!commentPost} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalCard, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <TouchableOpacity onPress={() => { setCommentPost(null); setCommentText(''); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }}>
              {commentPost?.comments.map((c) => (
                <View key={c.id} style={styles.commentItem}>
                  <Text style={styles.commentAuthor}>{c.author.display_name || c.author.username}</Text>
                  <Text style={styles.commentContent}>{c.content}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.commentInputRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 8 }]}
                placeholder="Write a comment..."
                placeholderTextColor={Colors.textMuted}
                value={commentText}
                onChangeText={setCommentText}
              />
              <TouchableOpacity style={styles.commentSendBtn} onPress={handleComment} disabled={commenting}>
                {commenting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.commentSendText}>Send</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingTop: 56, paddingBottom: Spacing.sm,
    backgroundColor: Colors.bgCard, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800' },
  createBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  card: {
    backgroundColor: Colors.bgCard, margin: Spacing.sm,
    borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary + '44',
    alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.sm, overflow: 'hidden',
  },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { color: Colors.primary, fontWeight: '700', fontSize: 16 },
  authorName: { color: Colors.textPrimary, fontWeight: '700', fontSize: 14 },
  authorMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 1 },
  deleteBtn: { padding: 6 },
  deleteBtnText: { color: Colors.textMuted, fontSize: 14 },

  postContent: { color: Colors.textPrimary, fontSize: 15, lineHeight: 22, marginBottom: Spacing.sm },

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.sm },
  tag: {
    backgroundColor: Colors.primary + '22', borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  tagText: { color: Colors.primaryLight, fontSize: 12, fontWeight: '600' },

  imageRow: { marginBottom: Spacing.sm },
  postImage: { width: 200, height: 160, borderRadius: Radius.sm, marginRight: 8 },

  actions: { flexDirection: 'row', gap: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionIcon: { fontSize: 18 },
  actionCount: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  liked: {},
  likedText: { color: '#ef4444' },

  empty: { alignItems: 'center', padding: Spacing.xl },
  emptyText: { color: Colors.textMuted, fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.lg, paddingBottom: 32,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },
  modalClose: { color: Colors.textMuted, fontSize: 18 },

  textArea: {
    backgroundColor: Colors.bgInput, color: Colors.textPrimary,
    borderRadius: Radius.sm, padding: Spacing.md, height: 120,
    fontSize: 15, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  input: {
    backgroundColor: Colors.bgInput, color: Colors.textPrimary,
    borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 12,
    fontSize: 14, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  imagePickerBtn: {
    backgroundColor: Colors.bgInput, borderRadius: Radius.sm,
    paddingVertical: 12, alignItems: 'center', marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed',
  },
  imagePickerText: { color: Colors.textSecondary, fontSize: 14 },
  pickedRow: { marginBottom: Spacing.sm },
  pickedThumb: { width: 80, height: 80, borderRadius: Radius.sm, marginRight: 8 },
  postBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.sm,
    paddingVertical: 14, alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  postBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  commentItem: { paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  commentAuthor: { color: Colors.primary, fontWeight: '700', fontSize: 13, marginBottom: 2 },
  commentContent: { color: Colors.textPrimary, fontSize: 14 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm },
  commentSendBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
  },
  commentSendText: { color: '#fff', fontWeight: '700' },
});
