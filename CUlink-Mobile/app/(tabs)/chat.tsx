import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Pusher from 'pusher-js';
import { chatAPI } from '../../services/api';
import { useAuthStore, useNotifStore } from '../../store';
import { Colors, Spacing, Radius, PUSHER_CLUSTER, PUSHER_KEY } from '../../constants';

// ── Types ──────────────────────────────────────────────────────────────────

interface ConversationEntry {
  user: { id: number; username: string; display_name: string; avatar_url: string };
  last_message: string;
  last_timestamp: string | null;
  unread_count: number;
}

interface Message {
  id: number;
  sender: string;
  recipient: string;
  content: string;
  timestamp: string;
  is_read: boolean;
}

// ── Inbox View ─────────────────────────────────────────────────────────────

function InboxView({ onSelectUser }: { onSelectUser: (username: string) => void }) {
  const [conversations, setConversations] = useState<ConversationEntry[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'chats' | 'people'>('chats');
  const { user } = useAuthStore();
  const { setUnreadDMs } = useNotifStore();

  const pusherRef = useRef<Pusher | null>(null);

  useEffect(() => {
    loadInbox();
    loadUsers();
  }, []);

  // Subscribe to personal notification channel
  useEffect(() => {
    if (!user) return;
    const pusher = new Pusher(conversations[0] ? '' : '', {
      cluster: PUSHER_CLUSTER,
    });
    return () => pusher.disconnect();
  }, [user]);

  const loadInbox = async () => {
    try {
      const res = await chatAPI.getInbox();
      setConversations(res.data.conversations);
      const totalUnread = res.data.conversations.reduce(
        (sum: number, c: ConversationEntry) => sum + c.unread_count, 0
      );
      setUnreadDMs(totalUnread);
    } catch {
      Alert.alert('Error', 'Could not load conversations.');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await chatAPI.getUsers();
      setAllUsers(res.data.users);
    } catch {}
  };

  const filteredConvos = conversations.filter(
    (c) => c.user.username.toLowerCase().includes(search.toLowerCase()) ||
      (c.user.display_name || '').toLowerCase().includes(search.toLowerCase())
  );
  const filteredUsers = allUsers.filter(
    (u) => u.username.toLowerCase().includes(search.toLowerCase()) ||
      (u.display_name || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }

  const renderConvo = ({ item }: { item: ConversationEntry }) => (
    <TouchableOpacity style={styles.convoItem} onPress={() => onSelectUser(item.user.username)}>
      <View style={styles.avatar}>
        {item.user.avatar_url ? (
          <Image source={{ uri: item.user.avatar_url }} style={styles.avatarImg} />
        ) : (
          <Text style={styles.avatarFallback}>
            {(item.user.display_name || item.user.username).charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.convoName}>{item.user.display_name || item.user.username}</Text>
          {item.last_timestamp && (
            <Text style={styles.convoTime}>{formatTime(item.last_timestamp)}</Text>
          )}
        </View>
        <Text style={styles.convoPreview} numberOfLines={1}>{item.last_message || 'Start a conversation'}</Text>
      </View>
      {item.unread_count > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{item.unread_count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderUser = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.convoItem} onPress={() => onSelectUser(item.username)}>
      <View style={styles.avatar}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatarImg} />
        ) : (
          <Text style={styles.avatarFallback}>
            {(item.display_name || item.username).charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.convoName}>{item.display_name || item.username}</Text>
        <Text style={styles.convoPreview}>@{item.username} {item.university ? `· ${item.university}` : ''}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1 }}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search users..."
        placeholderTextColor={Colors.textMuted}
        value={search}
        onChangeText={setSearch}
      />
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'chats' && styles.tabBtnActive]}
          onPress={() => setTab('chats')}
        >
          <Text style={[styles.tabBtnText, tab === 'chats' && styles.tabBtnTextActive]}>
            Conversations
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'people' && styles.tabBtnActive]}
          onPress={() => setTab('people')}
        >
          <Text style={[styles.tabBtnText, tab === 'people' && styles.tabBtnTextActive]}>
            All People
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'chats' ? (
        <FlatList
          data={filteredConvos}
          keyExtractor={(item) => item.user.username}
          renderItem={renderConvo}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyText}>No conversations yet</Text>
              <Text style={styles.emptySubtext}>Switch to All People to start chatting</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.username}
          renderItem={renderUser}
        />
      )}
    </View>
  );
}

// ── Conversation View ──────────────────────────────────────────────────────

function ConversationView({ username, onBack }: { username: string; onBack: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const pusherRef = useRef<Pusher | null>(null);
  const { user } = useAuthStore();
  const { clearUnreadDMs } = useNotifStore();

  useEffect(() => {
    loadMessages();
    return () => {
      pusherRef.current?.disconnect();
    };
  }, [username]);

  const loadMessages = async () => {
    try {
      const res = await chatAPI.getMessages(username);
      setMessages(res.data.messages);
      setOtherUser(res.data.other_user);

      // Subscribe to Pusher channel
      if (res.data.pusher_key && res.data.channel) {
        const pusher = new Pusher(res.data.pusher_key, { cluster: res.data.pusher_cluster || PUSHER_CLUSTER });
        const channel = pusher.subscribe(res.data.channel);
        channel.bind('new-message', (data: any) => {
          if (data.sender !== user?.username) {
            setMessages((prev) => [...prev, {
              id: data.id,
              sender: data.sender,
              recipient: user?.username || '',
              content: data.content,
              timestamp: new Date().toISOString(),
              is_read: false,
            }]);
          }
        });
        pusherRef.current = pusher;
      }
      clearUnreadDMs();
    } catch {
      Alert.alert('Error', 'Could not load messages.');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    const content = text.trim();
    setText('');
    setSending(true);

    // Optimistic update
    const tempMsg: Message = {
      id: Date.now(),
      sender: user?.username || '',
      recipient: username,
      content,
      timestamp: new Date().toISOString(),
      is_read: true,
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      await chatAPI.sendMessage(username, content);
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
      Alert.alert('Error', 'Message failed to send.');
    } finally {
      setSending(false);
    }
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender === user?.username;
    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.content}</Text>
          <Text style={styles.bubbleTime}>{formatTime(item.timestamp)}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.avatar}>
          {otherUser?.avatar_url ? (
            <Image source={{ uri: otherUser.avatar_url }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarFallback}>
              {(otherUser?.display_name || otherUser?.username || '?').charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <View>
          <Text style={styles.chatHeaderName}>{otherUser?.display_name || otherUser?.username}</Text>
          <Text style={styles.chatHeaderSub}>@{otherUser?.username}</Text>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMessage}
        contentContainerStyle={{ padding: Spacing.sm, paddingBottom: 16 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.messageInput}
          placeholder="Type a message..."
          placeholderTextColor={Colors.textMuted}
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={sending}>
          <Text style={styles.sendBtnText}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Screen Orchestrator ────────────────────────────────────────────────────

export default function ChatScreen() {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const { user } = useAuthStore();

  if (!user?.is_verified) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.emptyIcon}>📧</Text>
        <Text style={styles.emptyText}>Verify your email to use Chat</Text>
        <Text style={styles.emptySubtext}>Check your inbox for the verification link.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {selectedUser ? '' : 'Messages'}
        </Text>
      </View>
      {selectedUser ? (
        <ConversationView username={selectedUser} onBack={() => setSelectedUser(null)} />
      ) : (
        <InboxView onSelectUser={setSelectedUser} />
      )}
    </View>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return d.toLocaleDateString();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingHorizontal: Spacing.md, paddingTop: 56, paddingBottom: Spacing.sm,
    backgroundColor: Colors.bgCard, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800' },

  searchInput: {
    backgroundColor: Colors.bgInput, color: Colors.textPrimary,
    borderRadius: Radius.sm, marginHorizontal: Spacing.md, marginVertical: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 10, fontSize: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  tabs: { flexDirection: 'row', paddingHorizontal: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.sm },
  tabBtn: {
    flex: 1, paddingVertical: 8, borderRadius: Radius.sm, alignItems: 'center',
    backgroundColor: Colors.bgInput,
  },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabBtnText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 13 },
  tabBtnTextActive: { color: '#fff' },

  convoItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.primary + '33',
    alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.sm, overflow: 'hidden',
  },
  avatarImg: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { color: Colors.primary, fontWeight: '700', fontSize: 18 },
  convoName: { color: Colors.textPrimary, fontWeight: '700', fontSize: 15 },
  convoPreview: { color: Colors.textMuted, fontSize: 13, marginTop: 2 },
  convoTime: { color: Colors.textMuted, fontSize: 12 },
  unreadBadge: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4, marginLeft: Spacing.sm,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  emptyState: { alignItems: 'center', paddingTop: Spacing.xxl },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyText: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  emptySubtext: { color: Colors.textMuted, fontSize: 13, marginTop: 6, textAlign: 'center' },

  chatHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingTop: 56, paddingBottom: Spacing.sm,
    backgroundColor: Colors.bgCard, borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  backBtn: { marginRight: 4 },
  backBtnText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
  chatHeaderName: { color: Colors.textPrimary, fontWeight: '700', fontSize: 16 },
  chatHeaderSub: { color: Colors.textMuted, fontSize: 12 },

  msgRow: { flexDirection: 'row', marginBottom: Spacing.sm },
  msgRowMe: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '75%', padding: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
  },
  bubbleMe: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleThem: { borderBottomLeftRadius: 4 },
  bubbleText: { color: Colors.textPrimary, fontSize: 15 },
  bubbleTextMe: { color: '#fff' },
  bubbleTime: { color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 4, textAlign: 'right' },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  messageInput: {
    flex: 1, backgroundColor: Colors.bgInput, color: Colors.textPrimary,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: 15, maxHeight: 100, marginRight: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  sendBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnText: { color: '#fff', fontSize: 18 },
});
