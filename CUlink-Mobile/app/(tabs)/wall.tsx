import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert, Modal, ScrollView,
  KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { wallAPI } from '../../services/api';
import { useAuthStore } from '../../store';
import { Colors, Spacing, Radius } from '../../constants';

// Who we're currently replying to (null = plain comment)
type ReplyTarget = { username: string; displayName: string } | null;

interface Comment {
  id: number;
  author: { username: string; display_name: string; avatar_url: string };
  content: string;
  timestamp: string;
  is_reply: boolean;
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

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** Returns the @username mentioned at the start of a comment, or null */
function getReplyMention(content: string): string | null {
  const m = content.match(/^@(\w+)\s/);
  return m ? m[1] : null;
}

function Avatar({ url, name, size = 40 }: { url?: string; name: string; size?: number }) {
  return (
    <View style={[s.avatarWrap, { width: size, height: size, borderRadius: size / 2 }]}>
      {url
        ? <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        : <Text style={[s.avatarLetterBase, { fontSize: size * 0.38 }]}>{name.charAt(0).toUpperCase()}</Text>}
    </View>
  );
}

function PostCard({ post, onLike, onDelete, onComment }: {
  post: Post; onLike: (id: number) => void; onDelete: (id: number) => void; onComment: (p: Post) => void;
}) {
  const all = [post.image_url, ...post.extra_image_urls].filter(Boolean);
  const name = post.author.display_name || post.author.username;
  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        <Avatar url={post.author.avatar_url} name={name} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.cardAuthorName}>{name}</Text>
          <Text style={s.cardAuthorMeta}>@{post.author.username}{post.university ? ` · ${post.university}` : ''} · {timeAgo(post.timestamp)}</Text>
        </View>
        {post.can_delete && (
          <TouchableOpacity onPress={() => onDelete(post.id)} hitSlop={8}>
            <Ionicons name="close" size={17} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={s.cardContent}>{post.content}</Text>

      {post.tags.length > 0 && (
        <View style={s.tags}>
          {post.tags.map((t, i) => (
            <View key={i} style={s.tag}><Text style={s.tagText}>#{t}</Text></View>
          ))}
        </View>
      )}

      {all.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.imgRow}>
          {all.map((url, i) => <Image key={i} source={{ uri: url }} style={s.postImg} contentFit="cover" />)}
        </ScrollView>
      )}

      <View style={s.cardActions}>
        <TouchableOpacity style={s.cardAction} onPress={() => onLike(post.id)}>
          <Ionicons name={post.liked ? 'heart' : 'heart-outline'} size={19} color={post.liked ? '#ef4444' : Colors.textMuted} />
          <Text style={[s.cardActionCount, post.liked && { color: '#ef4444' }]}>{post.like_count}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.cardAction} onPress={() => onComment(post)}>
          <Ionicons name="chatbubble-outline" size={17} color={Colors.textMuted} />
          <Text style={s.cardActionCount}>{post.comment_count}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Comment item: detects @mention to render as threaded reply ────────────
function CommentItem({
  comment,
  onReply,
}: {
  comment: Comment;
  onReply: (author: { username: string; display_name: string }) => void;
}) {
  const mention = getReplyMention(comment.content);
  const isReply = !!mention;
  const name = comment.author.display_name || comment.author.username;

  if (isReply) {
    // Render as indented reply (matches web style)
    return (
      <View style={s.replyWrapper}>
        {/* Vertical thread line */}
        <View style={s.threadLine} />
        <View style={{ flex: 1 }}>
          {/* "Replying to @x" label */}
          <View style={s.replyingToRow}>
            <Ionicons name="return-down-forward-outline" size={12} color={Colors.textMuted} />
            <Text style={s.replyingToText} numberOfLines={1}>
              Replying to{' '}
              <Text style={{ color: Colors.primary, fontWeight: '700' }}>@{mention}</Text>
            </Text>
          </View>
          {/* Reply bubble */}
          <View style={s.commentBubbleRow}>
            <View style={[s.commentAvatar, { width: 28, height: 28, borderRadius: 14 }]}>
              <Text style={[s.commentAvatarText, { fontSize: 11 }]}>
                {name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={[s.commentBubble, s.replyBubble]}>
              <View style={s.commentBubbleTop}>
                <Text style={s.commentAuthor}>{name}</Text>
                <Text style={s.commentTimestamp}>{timeAgo(comment.timestamp)}</Text>
                <TouchableOpacity
                  style={s.replyBtn}
                  onPress={() => onReply(comment.author)}
                  hitSlop={8}
                >
                  <Ionicons name="return-down-forward-outline" size={12} color={Colors.primary} />
                  <Text style={s.replyBtnText}>Reply</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.commentBody}>{comment.content}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // Top-level comment
  return (
    <View style={s.commentBubbleRow}>
      <View style={s.commentAvatar}>
        <Text style={s.commentAvatarText}>{name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={s.commentBubble}>
        <View style={s.commentBubbleTop}>
          <Text style={s.commentAuthor}>{name}</Text>
          <Text style={s.commentTimestamp}>{timeAgo(comment.timestamp)}</Text>
          <TouchableOpacity
            style={s.replyBtn}
            onPress={() => onReply(comment.author)}
            hitSlop={8}
          >
            <Ionicons name="return-down-forward-outline" size={12} color={Colors.primary} />
            <Text style={s.replyBtnText}>Reply</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.commentBody}>{comment.content}</Text>
      </View>
    </View>
  );
}

export default function WallScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);

  const [commentPost, setCommentPost] = useState<Post | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget>(null);
  const commentListRef = useRef<FlatList>(null);
  const commentInputRef = useRef<TextInput>(null);

  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();

  const load = useCallback(async (reset = false) => {
    if (reset) { setLoading(true); setOffset(0); }
    try {
      const r = await wallAPI.getPosts({ offset: reset ? 0 : offset });
      setPosts(p => reset ? r.data.posts : [...p, ...r.data.posts]);
      setHasMore(r.data.has_more);
      setOffset(reset ? r.data.posts.length : offset + r.data.posts.length);
    } catch (err: any) {
      if (err.response?.status === 403) Alert.alert('Email Not Verified', 'Verify your email to view the Knowledge Wall.');
      else Alert.alert('Error', 'Could not load posts.');
    } finally { setLoading(false); setRefreshing(false); }
  }, [offset]);

  React.useEffect(() => { load(true); }, []);

  const pickImages = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.8,
    });
    if (!r.canceled) setImages(r.assets.map(a => a.uri));
  };

  const createPost = async () => {
    if (!content.trim()) { Alert.alert('Error', 'Post content cannot be empty.'); return; }
    setPosting(true);
    try {
      const fd = new FormData();
      fd.append('content', content.trim()); fd.append('tags', tags.trim());
      images.forEach((uri, i) => fd.append('images', { uri, name: `img_${i}.jpg`, type: 'image/jpeg' } as any));
      const r = await wallAPI.createPost(fd);
      setPosts(p => [r.data, ...p]);
      setCreateOpen(false); setContent(''); setTags(''); setImages([]);
    } catch (e: any) { Alert.alert('Error', e.response?.data?.error || 'Could not create post.'); }
    setPosting(false);
  };

  const likePost = async (id: number) => {
    try {
      const r = await wallAPI.likePost(id);
      setPosts(p => p.map(post => post.id === id ? { ...post, liked: r.data.liked, like_count: r.data.like_count } : post));
    } catch {}
  };

  const deletePost = (id: number) => {
    Alert.alert('Delete Post', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await wallAPI.deletePost(id); setPosts(p => p.filter(post => post.id !== id)); }
        catch { Alert.alert('Error', 'Could not delete post.'); }
      }},
    ]);
  };

  const addComment = async () => {
    if (!commentPost || !commentText.trim()) return;
    setCommenting(true);
    const body = commentText.trim();
    setCommentText('');
    setReplyTarget(null);
    try {
      const r = await wallAPI.addComment(commentPost.id, body);
      const newComment: Comment = r.data;
      setPosts(p => p.map(post => post.id === commentPost.id
        ? { ...post, comments: [...post.comments, newComment], comment_count: post.comment_count + 1 }
        : post));
      setCommentPost(prev =>
        prev
          ? { ...prev, comments: [...prev.comments, newComment], comment_count: prev.comment_count + 1 }
          : prev);
      setTimeout(() => commentListRef.current?.scrollToEnd({ animated: true }), 80);
    } catch {
      setCommentText(body);
      Alert.alert('Error', 'Could not add comment.');
    }
    setCommenting(false);
  };

  const startReply = (author: { username: string; display_name: string }) => {
    const displayName = author.display_name || author.username;
    setReplyTarget({ username: author.username, displayName });
    setCommentText(`@${author.username} `);
    setTimeout(() => commentInputRef.current?.focus(), 50);
  };

  const cancelReply = () => {
    setReplyTarget(null);
    setCommentText(prev =>
      prev.startsWith('@') && prev.trim().split(' ').length <= 1 ? '' : prev
    );
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 14 }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Knowledge Wall</Text>
          <Text style={s.headerSub}>Share knowledge with the community</Text>
        </View>
        <TouchableOpacity
          style={s.newPostBtn}
          onPress={() => {
            if (!user?.is_verified) { Alert.alert('Verify Email', 'Please verify your email to post.'); return; }
            setCreateOpen(true);
          }}
        >
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={s.newPostBtnText}>Post</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        keyExtractor={p => p.id.toString()}
        renderItem={({ item }) => (
          <PostCard post={item} onLike={likePost} onDelete={deletePost} onComment={setCommentPost} />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={Colors.primary} />}
        onEndReached={() => { if (hasMore && !loadingMore) { setLoadingMore(true); load().finally(() => setLoadingMore(false)); }}}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={Colors.primary} style={{ margin: 20 }} /> : null}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <Ionicons name="newspaper-outline" size={44} color={Colors.textMuted} />
            <Text style={s.emptyTitle}>No posts yet</Text>
            <Text style={s.emptySub}>Be the first to share something!</Text>
          </View>
        }
        contentContainerStyle={{ paddingVertical: Spacing.sm, paddingBottom: 24 }}
      />

      {/* Create Post Modal */}
      <Modal visible={createOpen} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalSheet}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>New Post</Text>
              <TouchableOpacity onPress={() => setCreateOpen(false)}><Ionicons name="close" size={22} color={Colors.textMuted} /></TouchableOpacity>
            </View>

            <TextInput
              style={s.textarea} placeholder="Share knowledge with the community..."
              placeholderTextColor={Colors.textMuted} multiline value={content}
              onChangeText={setContent} textAlignVertical="top"
            />
            <TextInput
              style={s.tagInput} placeholder="Tags (comma separated, e.g. python,django)"
              placeholderTextColor={Colors.textMuted} value={tags} onChangeText={setTags}
            />

            <TouchableOpacity style={s.imgPickerBtn} onPress={pickImages}>
              <Ionicons name="camera-outline" size={17} color={Colors.textSecondary} />
              <Text style={s.imgPickerText}>{images.length > 0 ? `${images.length} image(s) selected` : 'Add Images'}</Text>
            </TouchableOpacity>

            {images.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }}>
                {images.map((uri, i) => <Image key={i} source={{ uri }} style={s.thumbImg} contentFit="cover" />)}
              </ScrollView>
            )}

            <TouchableOpacity style={s.primaryBtn} onPress={createPost} disabled={posting}>
              {posting ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Publish Post</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Comments Bottom Sheet ──────────────────────────────── */}
      <Modal visible={!!commentPost} animationType="slide" transparent statusBarTranslucent>
        <View style={s.sheetOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => { setCommentPost(null); setCommentText(''); setReplyTarget(null); }} />

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={s.sheet}
          >
            {/* Handle bar */}
            <View style={s.sheetHandle} />

            {/* Header */}
            <View style={s.sheetHeader}>
              <Text style={s.modalTitle}>
                Comments {commentPost ? `(${commentPost.comment_count})` : ''}
              </Text>
              <TouchableOpacity
                onPress={() => { setCommentPost(null); setCommentText(''); setReplyTarget(null); }}
                style={s.sheetClose}
                hitSlop={12}
              >
                <Ionicons name="close" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Comments list */}
            <FlatList
              ref={commentListRef}
              data={commentPost?.comments || []}
              keyExtractor={(c, i) => (c.id?.toString() ?? i.toString())}
              renderItem={({ item: c }) => (
                <CommentItem comment={c} onReply={startReply} />
              )}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Ionicons name="chatbubble-outline" size={40} color={Colors.textMuted} />
                  <Text style={{ color: Colors.textMuted, marginTop: 10, fontSize: 14 }}>No comments yet — be the first!</Text>
                </View>
              }
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm }}
            />

            {/* Reply-to banner */}
            {replyTarget && (
              <View style={s.replyBanner}>
                <Ionicons name="return-down-forward-outline" size={14} color={Colors.primary} />
                <Text style={s.replyBannerText} numberOfLines={1}>
                  Replying to <Text style={{ color: Colors.primary, fontWeight: '700' }}>@{replyTarget.username}</Text>
                </Text>
                <TouchableOpacity onPress={cancelReply} hitSlop={8} style={{ marginLeft: 'auto' }}>
                  <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            )}

            {/* Input pinned at bottom */}
            <View style={s.commentInputBar}>
              <TextInput
                ref={commentInputRef}
                style={s.commentInput}
                placeholder={replyTarget ? `Reply to @${replyTarget.username}...` : 'Write a comment...'}
                placeholderTextColor={Colors.textMuted}
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={addComment}
                blurOnSubmit={false}
              />
              <TouchableOpacity
                style={[s.sendBtn, !commentText.trim() && { opacity: 0.4 }]}
                onPress={addComment}
                disabled={commenting || !commentText.trim()}
              >
                {commenting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Ionicons name="send" size={16} color="#fff" />}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800' },
  headerSub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  newPostBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  newPostBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    padding: Spacing.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  avatarWrap: {
    backgroundColor: Colors.primary + '33', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarLetterBase: { color: Colors.primary, fontWeight: '700' },
  cardAuthorName: { color: Colors.textPrimary, fontWeight: '700', fontSize: 14 },
  cardAuthorMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 1 },
  cardContent: { color: Colors.textPrimary, fontSize: 15, lineHeight: 22, marginBottom: Spacing.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.sm },
  tag: { backgroundColor: Colors.primary + '18', borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { color: Colors.primary, fontSize: 12, fontWeight: '600' },
  imgRow: { marginBottom: Spacing.sm },
  postImg: { width: 200, height: 140, borderRadius: Radius.sm, marginRight: 8 },
  cardActions: {
    flexDirection: 'row', gap: Spacing.lg, paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  cardAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardActionCount: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  emptySub: { color: Colors.textMuted, fontSize: 13 },

  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.lg, paddingBottom: 36,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },
  textarea: {
    backgroundColor: Colors.bg, color: Colors.textPrimary,
    borderRadius: Radius.sm, padding: Spacing.md, height: 120,
    fontSize: 15, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  tagInput: {
    backgroundColor: Colors.bg, color: Colors.textPrimary,
    borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 11,
    fontSize: 14, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  imgPickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bg, borderRadius: Radius.sm,
    paddingVertical: 12, paddingHorizontal: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', marginBottom: Spacing.sm,
  },
  imgPickerText: { color: Colors.textSecondary, fontSize: 14 },
  thumbImg: { width: 76, height: 76, borderRadius: Radius.sm, marginRight: 8 },
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.sm,
    paddingVertical: 14, alignItems: 'center', marginTop: Spacing.xs,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // ── Comment bottom sheet ─────────────────────────────────────────────────
  sheetOverlay: {
    flex: 1,
    backgroundColor: '#000000bb',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    height: '65%',
    flexDirection: 'column',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40, height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    marginTop: 10, marginBottom: 6,
    flexShrink: 0,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexShrink: 0,
  },
  sheetClose: {
    width: 32, height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Top-level comment bubble ─────────────────────────────────────────────
  commentBubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  commentAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.primary + '33',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  commentAvatarText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
  commentBubble: {
    flex: 1,
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    borderTopLeftRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  commentBubbleTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
    flexWrap: 'wrap',
  },
  commentAuthor: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
  commentTimestamp: { color: Colors.textMuted, fontSize: 11, flex: 1 },
  commentBody: { color: Colors.textPrimary, fontSize: 14, lineHeight: 20 },

  // ── Reply button ─────────────────────────────────────────────────────────
  replyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary + '15',
  },
  replyBtnText: { color: Colors.primary, fontSize: 11, fontWeight: '600' },

  // ── Threaded reply display (indented) ────────────────────────────────────
  replyWrapper: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 10,
    marginLeft: 16,
  },
  threadLine: {
    width: 2,
    backgroundColor: Colors.primary + '40',
    borderRadius: 2,
    marginRight: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  replyingToRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  replyingToText: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  replyBubble: {
    backgroundColor: Colors.primary + '0A',
    borderColor: Colors.primary + '28',
    borderTopLeftRadius: 4,
  },

  // ── Reply banner (shown above input when replying) ───────────────────────
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    backgroundColor: Colors.primary + '12',
    borderTopWidth: 1,
    borderTopColor: Colors.primary + '28',
  },
  replyBannerText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 13,
  },

  // ── Comment input bar ────────────────────────────────────────────────────
  commentInputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    paddingBottom: 20,
    borderTopWidth: 1, borderTopColor: Colors.border,
    gap: 10,
  },
  commentInput: {
    flex: 1,
    backgroundColor: Colors.bg,
    color: Colors.textPrimary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 90,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
});
