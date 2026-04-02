import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView, Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chatAPI } from '../../services/api';
import { useAuthStore, useNotifStore } from '../../store';
import { useTheme, DarkColors as Colors, Spacing, Radius, PUSHER_CLUSTER, PUSHER_KEY } from '../../constants';

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
  const Colors = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: Colors.primary + '33', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {url
        ? <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        : <Text style={{ color: Colors.primary, fontWeight: '700', fontSize: size * 0.38 }}>{name.charAt(0).toUpperCase()}</Text>}
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

function Inbox({ onSelect }: { onSelect: (u: string) => void }) {
  const Colors = useTheme();
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

  if (loading) return <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={Colors.primary} size="large" /></View>;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.bg }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

      {/* ── Action cards ── */}
      <View style={{ flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.xs }}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: Colors.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm }} onPress={() => setSearchOpen(true)}>
          <View style={{ width: 38, height: 38, borderRadius: Radius.sm, backgroundColor: Colors.primary + '22', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <Ionicons name="person-add-outline" size={20} color={Colors.primary} />
          </View>
          <Text style={{ color: Colors.textPrimary, fontSize: 12, fontWeight: '700', marginBottom: 2 }}>Chat with a user</Text>
          <Text style={{ color: Colors.textMuted, fontSize: 11 }}>Start by entering a username</Text>
        </TouchableOpacity>

        <TouchableOpacity style={{ flex: 1, backgroundColor: Colors.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm }} onPress={() => setUniModal(true)}>
          <View style={{ width: 38, height: 38, borderRadius: Radius.sm, backgroundColor: '#7c3aed22', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <Ionicons name="shuffle-outline" size={20} color="#7c3aed" />
          </View>
          <Text style={{ color: Colors.textPrimary, fontSize: 12, fontWeight: '700', marginBottom: 2 }}>Random chat</Text>
          <Text style={{ color: Colors.textMuted, fontSize: 11 }}>Match from a university</Text>
        </TouchableOpacity>

        <TouchableOpacity style={{ flex: 1, backgroundColor: Colors.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm }} onPress={() => setAnyoneModal(true)}>
          <View style={{ width: 38, height: 38, borderRadius: Radius.sm, backgroundColor: '#05966922', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <Ionicons name="globe-outline" size={20} color="#059669" />
          </View>
          <Text style={{ color: Colors.textPrimary, fontSize: 12, fontWeight: '700', marginBottom: 2 }}>Random anyone</Text>
          <Text style={{ color: Colors.textMuted, fontSize: 11 }}>Match with any CUlink user</Text>
        </TouchableOpacity>
      </View>

      {searchOpen && (
        <View style={{ paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgCard, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.sm, paddingVertical: 10, marginBottom: Spacing.xs }}>
            <Ionicons name="search-outline" size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={{ flex: 1, color: Colors.textPrimary, fontSize: 14 }} placeholder="Search username..." placeholderTextColor={Colors.textMuted}
              value={search} onChangeText={setSearch} autoFocus
            />
            <TouchableOpacity onPress={() => { setSearchOpen(false); setSearch(''); }}>
              <Ionicons name="close" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          {search.length > 0 && filtered.slice(0, 6).length > 0 && (
            <View style={{ marginHorizontal: 0, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard, overflow: 'hidden' }}>
              {filtered.slice(0, 6).map((u, i) => (
                <TouchableOpacity key={u.username}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 14, borderBottomWidth: i === Math.min(filtered.length, 6) - 1 ? 0 : 1, borderBottomColor: Colors.border, backgroundColor: Colors.bgCard }}
                  onPress={() => { setSearchOpen(false); setSearch(''); onSelect(u.username); }}>
                  <Avatar url={u.avatar_url} name={u.display_name || u.username} size={38} />
                  <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                    <Text style={{ color: Colors.textPrimary, fontWeight: '700', fontSize: 14 }}>{u.display_name || u.username}</Text>
                    <Text style={{ color: Colors.textMuted, fontSize: 12 }}>@{u.username}{u.university ? ` · ${u.university}` : ''}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      <Text style={{ color: Colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: 6 }}>CONVERSATIONS</Text>

      {convos.length === 0 ? (
        <View style={{ alignItems: 'center', paddingTop: 48, gap: 8 }}>
          <Ionicons name="chatbubbles-outline" size={44} color={Colors.textMuted} />
          <Text style={{ color: Colors.textPrimary, fontSize: 16, fontWeight: '700' }}>No conversations yet</Text>
          <Text style={{ color: Colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: Spacing.xl }}>Use the options above to start chatting</Text>
        </View>
      ) : (
        <View style={{ marginHorizontal: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard, overflow: 'hidden' }}>
          {convos.map((c, i) => (
            <TouchableOpacity
              key={c.user.username}
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 14, borderBottomWidth: i === convos.length - 1 ? 0 : 1, borderBottomColor: Colors.border, backgroundColor: Colors.bgCard }}
              onPress={() => onSelect(c.user.username)}
            >
              <Avatar url={c.user.avatar_url} name={c.user.display_name || c.user.username} />
              <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: Colors.textPrimary, fontWeight: '700', fontSize: 14 }}>{c.user.display_name || c.user.username}</Text>
                  {c.last_timestamp && <Text style={{ color: Colors.textMuted, fontSize: 11 }}>{ts(c.last_timestamp)}</Text>}
                </View>
                <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{c.last_message || 'Start a conversation'}</Text>
              </View>
              {c.unread_count > 0
                ? <View style={{ backgroundColor: Colors.primary, borderRadius: Radius.full, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, marginLeft: 8 }}><Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{c.unread_count}</Text></View>
                : <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={{ marginLeft: 6 }} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Random by University Modal ── */}
      <Modal visible={uniModal} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: '#000000cc', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg }}>
          <View style={{ backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.lg, width: '100%', borderWidth: 1, borderColor: Colors.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="shuffle-outline" size={18} color="#7c3aed" />
                <Text style={{ color: Colors.textPrimary, fontSize: 17, fontWeight: '700' }}>Random Chat</Text>
              </View>
              <TouchableOpacity onPress={() => setUniModal(false)}><Ionicons name="close" size={22} color={Colors.textMuted} /></TouchableOpacity>
            </View>
            <Text style={{ color: Colors.textMuted, fontSize: 13, marginBottom: Spacing.md }}>Pick a university and we'll match you with a random student there!</Text>
            <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
              {unis.map(uni => (
                <TouchableOpacity key={uni}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm, marginBottom: 3, backgroundColor: selUni === uni ? Colors.primary : 'transparent' }}
                  onPress={() => setSelUni(uni)}
                >
                  <Text style={{ color: selUni === uni ? '#fff' : Colors.textPrimary, fontSize: 14 }}>{uni}</Text>
                  {selUni === uni && <Ionicons name="checkmark" size={16} color="#fff" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={{ borderRadius: Radius.sm, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.md, backgroundColor: '#7c3aed' }} onPress={randomByUni} disabled={finding}>
              {finding ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Find Someone →</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Random Anyone Modal ── */}
      <Modal visible={anyoneModal} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: '#000000cc', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg }}>
          <View style={{ backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.lg, width: '100%', borderWidth: 1, borderColor: Colors.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="globe-outline" size={18} color="#059669" />
                <Text style={{ color: Colors.textPrimary, fontSize: 17, fontWeight: '700' }}>Random Chat with Anyone</Text>
              </View>
              <TouchableOpacity onPress={() => setAnyoneModal(false)}><Ionicons name="close" size={22} color={Colors.textMuted} /></TouchableOpacity>
            </View>
            <Text style={{ color: Colors.textMuted, fontSize: 13, marginBottom: Spacing.md }}>We'll match you with a random active CUlink user from any university!</Text>
            <TouchableOpacity style={{ borderRadius: Radius.sm, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.md, backgroundColor: '#059669' }} onPress={randomAnyone} disabled={finding}>
              {finding ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Find Anyone →</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Conversation({ username, onBack, topInset }: { username: string; onBack: () => void; topInset: number }) {
  const Colors = useTheme();
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

  if (loading) return <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={Colors.primary} size="large" /></View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgCard, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: Spacing.md, paddingBottom: 12, gap: 10, paddingTop: topInset + 10 }}>
        <TouchableOpacity onPress={onBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={Colors.primary} />
        </TouchableOpacity>
        <Avatar url={other?.avatar_url} name={other?.display_name || other?.username || '?'} size={36} />
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={{ color: Colors.textPrimary, fontWeight: '700', fontSize: 15 }}>{other?.display_name || other?.username}</Text>
          <Text style={{ color: Colors.textMuted, fontSize: 12 }}>@{other?.username}</Text>
        </View>
      </View>

      <FlatList ref={listRef} data={msgs} keyExtractor={m => m.id.toString()}
        style={{ backgroundColor: Colors.bg }}
        renderItem={({ item }) => {
          const me = item.sender === user?.username;
          return (
            <View style={{ flexDirection: 'row', marginBottom: 10, justifyContent: me ? 'flex-end' : 'flex-start' }}>
              <View style={[
                { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radius.md },
                me
                  ? { backgroundColor: Colors.primary, borderBottomRightRadius: 4 }
                  : { backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 4 },
              ]}>
                <Text style={{ color: me ? '#fff' : Colors.textPrimary, fontSize: 15, lineHeight: 20 }}>{item.content}</Text>
                <Text style={{ color: me ? 'rgba(255,255,255,0.5)' : Colors.textMuted, fontSize: 10, marginTop: 4, textAlign: 'right' }}>{ts(item.timestamp)}</Text>
              </View>
            </View>
          );
        }}
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: 8 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bgCard }}>
        <TextInput
          style={{ flex: 1, backgroundColor: Colors.bg, color: Colors.textPrimary, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, fontSize: 15, maxHeight: 100, marginRight: 10, borderWidth: 1, borderColor: Colors.border }}
          placeholder="Type a message..." placeholderTextColor={Colors.textMuted}
          value={text} onChangeText={setText} multiline
        />
        <TouchableOpacity style={{ backgroundColor: Colors.primary, borderRadius: Radius.full, width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }} onPress={send} disabled={sending}>
          <Ionicons name="send" size={17} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

export default function ChatScreen() {
  const Colors = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();

  if (!user?.is_verified) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Ionicons name="mail-outline" size={48} color={Colors.textMuted} />
        <Text style={{ color: Colors.textPrimary, fontSize: 16, fontWeight: '700' }}>Verify your email to use Chat</Text>
        <Text style={{ color: Colors.textMuted, fontSize: 13, textAlign: 'center' }}>Check your inbox for the verification link.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      {!selected && (
        <View style={{ backgroundColor: Colors.bgCard, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, paddingTop: insets.top + 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: Radius.sm, backgroundColor: Colors.primary + '22', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chatbubbles" size={20} color={Colors.primary} />
            </View>
            <View>
              <Text style={{ color: Colors.textPrimary, fontSize: 20, fontWeight: '800' }}>Messages</Text>
              <Text style={{ color: Colors.textMuted, fontSize: 13 }}>Your private conversations</Text>
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

// No static StyleSheet — all styles are inline and read from useTheme() per render
