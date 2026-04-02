import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView, Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chatAPI } from '../../services/api';
import { useAuthStore, useNotifStore } from '../../store';
import { Colors, Spacing, Radius, PUSHER_CLUSTER, PUSHER_KEY } from '../../constants';

// ── Safe Pusher factory ────────────────────────────────────────────────────
function makePusher(key: string, cluster: string) {
  try {
    const mod = require('pusher-js/react-native');
    const P = mod?.default ?? mod;
    return new P(key, { cluster });
  } catch {
    try {
      const mod2 = require('pusher-js');
      const P2 = mod2?.default ?? mod2;
      return new P2(key, { cluster });
    } catch { return null; }
  }
}

// ── Types ──────────────────────────────────────────────────────────────────
interface Convo {
  user: { id: number; username: string; display_name: string; avatar_url: string; university: string };
  last_message: string;
  last_timestamp: string | null;
  unread_count: number;
}
interface Msg { id: number; sender: string; recipient: string; content: string; timestamp: string; is_read: boolean; }

// ── Avatar helper ──────────────────────────────────────────────────────────
function Avatar({ url, name, size = 44 }: { url?: string; name: string; size?: number }) {
  return (
    <View style={[s.avatarWrap, { width: size, height: size, borderRadius: size / 2 }]}>
      {url
        ? <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        : <Text style={[s.avatarLetter, { fontSize: size * 0.38 }]}>{name.charAt(0).toUpperCase()}</Text>}
    </View>
  );
}

function ts(iso: string) {
  const d = new Date(iso), now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return d.toLocaleDateString();
}

// ── Inbox ──────────────────────────────────────────────────────────────────
function Inbox({ onSelect }: { onSelect: (u: string) => void }) {
  const [convos, setConvos] = useState<Convo[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [uniModal, setUniModal] = useState(false);
  const [anyoneModal, setAnyoneModal] = useState(false);
  const [selUni, setSelUni] = useState('');
  const [finding, setFinding] = useState(false);
  const { user } = useAuthStore();
  const { setUnreadDMs } = useNotifStore();

  useEffect(() => { load(); loadUsers(); }, []);

  useEffect(() => {
    if (!user) return;
    const p = makePusher(PUSHER_KEY, PUSHER_CLUSTER);
    if (p) { const ch = p.subscribe(`user-notif-${user.id}`); ch.bind('new-dm', load); }
    return () => p?.disconnect();
  }, [user]);

  const load = async () => {
    try {
      const r = await chatAPI.getInbox();
      setConvos(r.data.conversations);
      setUnreadDMs(r.data.conversations.reduce((t: number, c: Convo) => t + c.unread_count, 0));
    } catch { Alert.alert('Error', 'Could not load conversations.'); }
    setLoading(false);
  };

  const loadUsers = async () => {
    try { const r = await chatAPI.getUsers(); setAllUsers(r.data.users); } catch {}
  };

  const unis = [...new Set(allUsers.map((u: any) => u.university).filter(Boolean))].sort();

  const randomByUni = async () => {
    if (!selUni) { Alert.alert('Pick a university'); return; }
    setFinding(true);
    const pool = allUsers.filter((u: any) => u.university === selUni && u.username !== user?.username);
    if (!pool.length) { Alert.alert('No users found from that university.'); setFinding(false); return; }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setUniModal(false); setFinding(false); onSelect(pick.username);
  };

  const randomAnyone = async () => {
    setFinding(true);
    const pool = allUsers.filter((u: any) => u.username !== user?.username);
    if (!pool.length) { Alert.alert('No users found.'); setFinding(false); return; }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setAnyoneModal(false); setFinding(false); onSelect(pick.username);
  };

  const filtered = allUsers.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    (u.display_name || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <View style={s.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

      {/* ── Action cards — matching web ──────────────────────── */}
      <View style={s.actionCards}>
        <TouchableOpacity style={s.actionCard} onPress={() => setSearchOpen(true)}>
          <View style={[s.actionCardIcon, { backgroundColor: Colors.primary + '22' }]}>
            <Ionicons name="person-add-outline" size={20} color={Colors.primary} />
          </View>
          <Text style={s.actionCardTitle}>Chat with a user</Text>
          <Text style={s.actionCardSub}>Start by entering a username</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.actionCard} onPress={() => setUniModal(true)}>
          <View style={[s.actionCardIcon, { backgroundColor: '#7c3aed22' }]}>
            <Ionicons name="shuffle-outline" size={20} color="#7c3aed" />
          </View>
          <Text style={s.actionCardTitle}>Random chat</Text>
          <Text style={s.actionCardSub}>Match from a university</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.actionCard} onPress={() => setAnyoneModal(true)}>
          <View style={[s.actionCardIcon, { backgroundColor: '#05966922' }]}>
            <Ionicons name="globe-outline" size={20} color="#059669" />
          </View>
          <Text style={s.actionCardTitle}>Random chat with anyone</Text>
          <Text style={s.actionCardSub}>Match with any CUlink user</Text>
        </TouchableOpacity>
      </View>

      {/* ── User search ──────────────────────────────────────── */}
      {searchOpen && (
        <View style={s.searchBox}>
          <View style={s.searchRow}>
            <Ionicons name="search-outline" size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={s.searchInput} placeholder="Search username..." placeholderTextColor={Colors.textMuted}
              value={search} onChangeText={setSearch} autoFocus
            />
            <TouchableOpacity onPress={() => { setSearchOpen(false); setSearch(''); }}>
              <Ionicons name="close" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          {search.length > 0 && filtered.slice(0, 6).length > 0 && (
            <View style={s.convoList}>
              {filtered.slice(0, 6).map((u, i) => (
                <TouchableOpacity key={u.username}
                  style={[s.convoRow, i === Math.min(filtered.length, 6) - 1 && { borderBottomWidth: 0 }]}
                  onPress={() => { setSearchOpen(false); setSearch(''); onSelect(u.username); }}>
                  <Avatar url={u.avatar_url} name={u.display_name || u.username} size={38} />
                  <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                    <Text style={s.convoName}>{u.display_name || u.username}</Text>
                    <Text style={s.convoMeta}>@{u.username}{u.university ? ` · ${u.university}` : ''}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ── CONVERSATIONS label ───────────────────────────────── */}
      <Text style={s.sectionLabel}>CONVERSATIONS</Text>

      {convos.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="chatbubbles-outline" size={44} color={Colors.textMuted} />
          <Text style={s.emptyTitle}>No conversations yet</Text>
          <Text style={s.emptySub}>Use the options above to start chatting</Text>
        </View>
      ) : (
        // Wrap ALL conversation rows in one rounded card — like the web
        <View style={s.convoList}>
          {convos.map((c, i) => (
            <TouchableOpacity
              key={c.user.username}
              style={[s.convoRow, i === convos.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => onSelect(c.user.username)}
            >
              <Avatar url={c.user.avatar_url} name={c.user.display_name || c.user.username} />
              <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={s.convoName}>{c.user.display_name || c.user.username}</Text>
                  {c.last_timestamp && <Text style={s.convoTime}>{ts(c.last_timestamp)}</Text>}
                </View>
                <Text style={s.convoMeta} numberOfLines={1}>{c.last_message || 'Start a conversation'}</Text>
              </View>
              {c.unread_count > 0
                ? <View style={s.unreadBadge}><Text style={s.unreadText}>{c.unread_count}</Text></View>
                : <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={{ marginLeft: 6 }} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Random by University Modal ────────────────────────── */}
      <Modal visible={uniModal} animationType="fade" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHead}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="shuffle-outline" size={18} color="#7c3aed" />
                <Text style={s.modalTitle}>Random Chat</Text>
              </View>
              <TouchableOpacity onPress={() => setUniModal(false)}><Ionicons name="close" size={22} color={Colors.textMuted} /></TouchableOpacity>
            </View>
            <Text style={s.modalSub}>Pick a university and we'll match you with a random student there!</Text>
            <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
              {unis.map(uni => (
                <TouchableOpacity key={uni}
                  style={[s.uniOption, selUni === uni && s.uniOptionActive]}
                  onPress={() => setSelUni(uni)}
                >
                  <Text style={[s.uniOptionText, selUni === uni && { color: '#fff' }]}>{uni}</Text>
                  {selUni === uni && <Ionicons name="checkmark" size={16} color="#fff" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[s.modalBtn, { backgroundColor: '#7c3aed' }]} onPress={randomByUni} disabled={finding}>
              {finding ? <ActivityIndicator color="#fff" /> : <Text style={s.modalBtnText}>Find Someone →</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Random Anyone Modal ───────────────────────────────── */}
      <Modal visible={anyoneModal} animationType="fade" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHead}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="globe-outline" size={18} color="#059669" />
                <Text style={s.modalTitle}>Random Chat with Anyone</Text>
              </View>
              <TouchableOpacity onPress={() => setAnyoneModal(false)}><Ionicons name="close" size={22} color={Colors.textMuted} /></TouchableOpacity>
            </View>
            <Text style={s.modalSub}>We'll match you with a random active CUlink user from any university!</Text>
            <TouchableOpacity style={[s.modalBtn, { backgroundColor: '#059669' }]} onPress={randomAnyone} disabled={finding}>
              {finding ? <ActivityIndicator color="#fff" /> : <Text style={s.modalBtnText}>Find Anyone →</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ── Conversation ───────────────────────────────────────────────────────────
function Conversation({ username, onBack, topInset }: { username: string; onBack: () => void; topInset: number }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [other, setOther] = useState<any>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const pusherRef = useRef<any>(null);
  const { user } = useAuthStore();
  const { clearUnreadDMs } = useNotifStore();

  useEffect(() => { loadMsgs(); return () => pusherRef.current?.disconnect(); }, [username]);

  const loadMsgs = async () => {
    try {
      const r = await chatAPI.getMessages(username);
      setMsgs(r.data.messages);
      setOther(r.data.other_user);
      if (r.data.pusher_key && r.data.channel) {
        const p = makePusher(r.data.pusher_key, r.data.pusher_cluster || PUSHER_CLUSTER);
        if (p) {
          const ch = p.subscribe(r.data.channel);
          ch.bind('new-message', (data: any) => {
            if (data.sender !== user?.username)
              setMsgs(prev => [...prev, { id: data.id, sender: data.sender, recipient: user?.username || '', content: data.content, timestamp: new Date().toISOString(), is_read: false }]);
          });
          pusherRef.current = p;
        }
      }
      clearUnreadDMs();
    } catch { Alert.alert('Error', 'Could not load messages.'); }
    setLoading(false);
  };

  const send = async () => {
    if (!text.trim() || sending) return;
    const content = text.trim(); setText(''); setSending(true);
    const tmp: Msg = { id: Date.now(), sender: user?.username || '', recipient: username, content, timestamp: new Date().toISOString(), is_read: true };
    setMsgs(prev => [...prev, tmp]);
    try { await chatAPI.sendMessage(username, content); }
    catch { setMsgs(prev => prev.filter(m => m.id !== tmp.id)); Alert.alert('Error', 'Message failed.'); }
    setSending(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.chatBar, { paddingTop: topInset + 10 }]}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={Colors.primary} />
        </TouchableOpacity>
        <Avatar url={other?.avatar_url} name={other?.display_name || other?.username || '?'} size={36} />
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={s.chatBarName}>{other?.display_name || other?.username}</Text>
          <Text style={s.chatBarSub}>@{other?.username}</Text>
        </View>
      </View>

      <FlatList ref={listRef} data={msgs} keyExtractor={m => m.id.toString()}
        renderItem={({ item }) => {
          const me = item.sender === user?.username;
          return (
            <View style={[s.bubbleRow, me && { justifyContent: 'flex-end' }]}>
              <View style={[s.bubble, me ? s.bubbleMe : s.bubbleThem]}>
                <Text style={[s.bubbleText, me && { color: '#fff' }]}>{item.content}</Text>
                <Text style={s.bubbleTime}>{ts(item.timestamp)}</Text>
              </View>
            </View>
          );
        }}
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: 8 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />

      <View style={s.inputBar}>
        <TextInput
          style={s.msgInput} placeholder="Type a message..." placeholderTextColor={Colors.textMuted}
          value={text} onChangeText={setText} multiline
        />
        <TouchableOpacity style={s.sendBtn} onPress={send} disabled={sending}>
          <Ionicons name="send" size={17} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Root screen ────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const [selected, setSelected] = useState<string | null>(null);
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();

  if (!user?.is_verified) {
    return (
      <View style={s.center}>
        <Ionicons name="mail-outline" size={48} color={Colors.textMuted} />
        <Text style={s.emptyTitle}>Verify your email to use Chat</Text>
        <Text style={s.emptySub}>Check your inbox for the verification link.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      {!selected && (
        /* Header — matching the web "Messages" hero section */
        <View style={[s.heroHeader, { paddingTop: insets.top + 16 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={s.heroIcon}>
              <Ionicons name="chatbubbles" size={20} color={Colors.primary} />
            </View>
            <View>
              <Text style={s.heroTitle}>Messages</Text>
              <Text style={s.heroSub}>Your private conversations</Text>
            </View>
          </View>
        </View>
      )}
      {selected
        ? <Conversation username={selected} onBack={() => setSelected(null)} topInset={insets.top} />
        : <Inbox onSelect={setSelected} />}
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },

  heroHeader: {
    backgroundColor: Colors.bgCard, borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.md,
  },
  heroIcon: {
    width: 40, height: 40, borderRadius: Radius.sm,
    backgroundColor: Colors.primary + '22', alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800' },
  heroSub: { color: Colors.textMuted, fontSize: 13 },

  // Action cards
  actionCards: {
    flexDirection: 'row', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.xs,
  },
  actionCard: {
    flex: 1, backgroundColor: Colors.bgCard,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, minWidth: 0,
  },
  actionCardIcon: { width: 38, height: 38, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  actionCardTitle: { color: Colors.textPrimary, fontSize: 12, fontWeight: '700', marginBottom: 2 },
  actionCardSub: { color: Colors.textMuted, fontSize: 11, lineHeight: 14 },

  // Search
  searchBox: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgCard, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 10,
    marginBottom: Spacing.xs,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 14 },

  sectionLabel: {
    color: Colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1,
    paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: 6,
  },

  // Conversation list: one rounded card wrapping all rows
  convoList: {
    marginHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    overflow: 'hidden',
  },
  convoRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  avatarWrap: {
    backgroundColor: Colors.primary + '33',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarLetter: { color: Colors.primary, fontWeight: '700' },
  convoName: { color: Colors.textPrimary, fontWeight: '700', fontSize: 14 },
  convoMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  convoTime: { color: Colors.textMuted, fontSize: 11 },
  unreadBadge: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4, marginLeft: 8,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  empty: { alignItems: 'center', paddingTop: 48, gap: 8 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  emptySub: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: Spacing.xl },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  modalCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    padding: Spacing.lg, width: '100%',
    borderWidth: 1, borderColor: Colors.border,
  },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  modalTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },
  modalSub: { color: Colors.textMuted, fontSize: 13, marginBottom: Spacing.md },
  uniOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm, marginBottom: 3,
  },
  uniOptionActive: { backgroundColor: Colors.primary },
  uniOptionText: { color: Colors.textPrimary, fontSize: 14 },
  modalBtn: { borderRadius: Radius.sm, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.md },
  modalBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Chat window
  chatBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgCard, borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingBottom: 12, gap: 10,
  },
  backBtn: { marginRight: 4 },
  chatBarName: { color: Colors.textPrimary, fontWeight: '700', fontSize: 15 },
  chatBarSub: { color: Colors.textMuted, fontSize: 12 },

  bubbleRow: { flexDirection: 'row', marginBottom: 10 },
  bubble: {
    maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radius.md,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
  },
  bubbleMe: { backgroundColor: Colors.primary, borderColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleThem: { borderBottomLeftRadius: 4 },
  bubbleText: { color: Colors.textPrimary, fontSize: 15, lineHeight: 20 },
  bubbleTime: { color: 'rgba(255,255,255,0.45)', fontSize: 10, marginTop: 4, textAlign: 'right' },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  msgInput: {
    flex: 1, backgroundColor: Colors.bg, color: Colors.textPrimary,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: 15, maxHeight: 100, marginRight: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  sendBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    width: 42, height: 42, alignItems: 'center', justifyContent: 'center',
  },
});
