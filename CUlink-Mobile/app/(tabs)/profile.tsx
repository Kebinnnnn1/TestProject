import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { profileAPI, authAPI } from '../../services/api';
import { useAuthStore } from '../../store';
import { Colors, Spacing, Radius } from '../../constants';

const UNIVERSITY_CHOICES = [
  { value: 'CTU', label: 'CTU - Cebu Technological University' },
  { value: 'CEC', label: 'CEC - Cebu Eastern College' },
  { value: 'SWU', label: 'SWU - Southwestern University' },
  { value: 'ACT', label: 'ACT - Asian College of Technology' },
  { value: 'UV',  label: 'UV - University of the Visayas' },
  { value: '',    label: 'None / Unset' },
];

export default function ProfileScreen() {
  const { user, setUser, clearAuth } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  const [editVisible, setEditVisible] = useState(false);
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [university, setUniversity] = useState(user?.university || '');
  const [saving, setSaving] = useState(false);

  const [pwVisible, setPwVisible] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  const [resending, setResending] = useState(false);

  const refreshProfile = async () => {
    setLoading(true);
    try { const res = await profileAPI.getProfile(); setUser(res.data); } catch {}
    setLoading(false);
  };
  useEffect(() => { refreshProfile(); }, []);

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (result.canceled) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('avatar', { uri: result.assets[0].uri, name: 'avatar.jpg', type: 'image/jpeg' } as any);
      const res = await profileAPI.updateProfile(formData);
      setUser(res.data);
    } catch { Alert.alert('Error', 'Could not upload avatar.'); }
    setSaving(false);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('display_name', displayName.trim());
      formData.append('university', university);
      const res = await profileAPI.updateProfile(formData);
      setUser(res.data);
      setEditVisible(false);
    } catch { Alert.alert('Error', 'Could not update profile.'); }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!oldPw || !newPw || !confirmPw) { Alert.alert('Error', 'Fill in all fields.'); return; }
    if (newPw !== confirmPw) { Alert.alert('Error', 'Passwords do not match.'); return; }
    setChangingPw(true);
    try {
      await profileAPI.changePassword({ old_password: oldPw, new_password: newPw, confirm_password: confirmPw });
      setPwVisible(false); setOldPw(''); setNewPw(''); setConfirmPw('');
      Alert.alert('Password changed!');
    } catch (err: any) { Alert.alert('Error', err.response?.data?.error || 'Could not change password.'); }
    setChangingPw(false);
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => clearAuth() },
    ]);
  };

  const handleResendVerification = async () => {
    if (!user?.email) return;
    setResending(true);
    try {
      await authAPI.resendVerification(user.email);
      Alert.alert('Sent!', 'Check your email for the verification link.');
    } catch { Alert.alert('Error', 'Could not resend.'); }
    setResending(false);
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;

  const displayNameText = user?.display_name || user?.username || '';
  const roleBadgeColor = user?.role === 'admin' ? '#ef4444' : user?.role === 'moderator' ? '#f59e0b' : Colors.primary;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
      {/* ── Header Banner ──────────────────────────────────── */}
      <View style={[s.banner, { paddingTop: insets.top + 16 }]}>
        <View style={s.bannerGlow} pointerEvents="none" />

        <View style={s.bannerContent}>
          <TouchableOpacity onPress={handlePickAvatar} disabled={saving} style={s.avatarWrap}>
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={s.avatar} contentFit="cover" />
            ) : (
              <View style={s.avatarFallback}>
                <Text style={s.avatarFallbackText}>{displayNameText.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={s.avatarCameraBtn}>
              <Ionicons name="camera" size={12} color={Colors.textSecondary} />
            </View>
          </TouchableOpacity>

          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <Text style={s.bannerName}>{displayNameText}</Text>
            <View style={s.badgeRow}>
              {user?.is_verified ? (
                <View style={[s.badge, { backgroundColor: '#22c55e22', borderColor: '#22c55e44' }]}>
                  <Ionicons name="shield-checkmark" size={11} color="#22c55e" />
                  <Text style={[s.badgeText, { color: '#22c55e' }]}>Verified</Text>
                </View>
              ) : (
                <View style={[s.badge, { backgroundColor: '#f59e0b22', borderColor: '#f59e0b44' }]}>
                  <Ionicons name="alert-circle" size={11} color="#f59e0b" />
                  <Text style={[s.badgeText, { color: '#f59e0b' }]}>Unverified</Text>
                </View>
              )}
              {user?.role && (
                <View style={[s.badge, { backgroundColor: roleBadgeColor + '22', borderColor: roleBadgeColor + '44' }]}>
                  <Text style={[s.badgeText, { color: roleBadgeColor }]}>{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</Text>
                </View>
              )}
              {user?.university && (
                <View style={[s.badge, { backgroundColor: Colors.border, borderColor: Colors.borderLight }]}>
                  <Text style={[s.badgeText, { color: Colors.textSecondary }]}>{user.university}</Text>
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={s.editProfileBtn}
            onPress={() => { setDisplayName(user?.display_name || ''); setUniversity(user?.university || ''); setEditVisible(true); }}
          >
            <Ionicons name="create-outline" size={14} color={Colors.textPrimary} />
            <Text style={s.editProfileBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.body}>
        {/* ── Email verification nudge ──────────────────────── */}
        {!user?.is_verified && (
          <View style={s.verifyCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="mail-outline" size={16} color="#f59e0b" />
              <Text style={s.verifyTitle}>Verify your email</Text>
            </View>
            <Text style={s.verifyText}>Verify your email to access Chat and the Knowledge Wall.</Text>
            <TouchableOpacity onPress={handleResendVerification} disabled={resending}>
              {resending
                ? <ActivityIndicator color="#f59e0b" size="small" />
                : <Text style={s.verifyLink}>Resend verification email →</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Account Details ─────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="person-circle-outline" size={16} color={Colors.primary} />
            <Text style={s.cardTitle}>ACCOUNT DETAILS</Text>
          </View>
          <DetailRow label="Username" value={user?.username} />
          <DetailRow label="Email" value={user?.email} />
          {user?.university && <DetailRow label="University" value={UNIVERSITY_CHOICES.find(u => u.value === user.university)?.label || user.university} />}
          <DetailRow label="Role" value={user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : ''} />
          <DetailRow label="Email Verified" value={user?.is_verified ? 'Yes' : 'No'} valueColor={user?.is_verified ? '#22c55e' : '#ef4444'} />
        </View>

        {/* ── Quick Actions ────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="flash-outline" size={16} color={Colors.primary} />
            <Text style={s.cardTitle}>QUICK ACTIONS</Text>
          </View>
          <ActionRow
            icon="create-outline"
            label="Edit Profile"
            onPress={() => { setDisplayName(user?.display_name || ''); setUniversity(user?.university || ''); setEditVisible(true); }}
            accent
          />
          <ActionRow icon="lock-closed-outline" label="Change Password" onPress={() => setPwVisible(true)} />
          {user?.role === 'admin' && (
            <ActionRow icon="shield-outline" label="Admin Dashboard" onPress={() => Alert.alert('Admin', 'Open the web admin panel at culink.me/admin')} />
          )}
          <ActionRow icon="log-out-outline" label="Sign Out" onPress={handleLogout} danger />
        </View>

        <Text style={s.version}>CUlink Mobile v1.0.0</Text>
      </View>

      {/* ── Edit Profile Modal ──────────────────────────────────────────── */}
      <Modal visible={editVisible} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={s.fieldLabel}>Display Name</Text>
            <TextInput style={s.input} placeholder="Your display name" placeholderTextColor={Colors.textMuted}
              value={displayName} onChangeText={setDisplayName} maxLength={60} />

            <Text style={s.fieldLabel}>University</Text>
            {UNIVERSITY_CHOICES.map((u) => (
              <TouchableOpacity key={u.value}
                style={[s.uniRow, university === u.value && s.uniRowActive]}
                onPress={() => setUniversity(u.value)}
              >
                <Text style={[s.uniRowText, university === u.value && { color: Colors.primary }]}>{u.label}</Text>
                {university === u.value && <Ionicons name="checkmark" size={16} color={Colors.primary} />}
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={s.primaryBtn} onPress={handleSaveProfile} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Change Password Modal ───────────────────────────────────────── */}
      <Modal visible={pwVisible} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setPwVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={s.fieldLabel}>Current Password</Text>
            <TextInput style={s.input} secureTextEntry placeholder="Current password" placeholderTextColor={Colors.textMuted} value={oldPw} onChangeText={setOldPw} />
            <Text style={s.fieldLabel}>New Password</Text>
            <TextInput style={s.input} secureTextEntry placeholder="Min. 8 characters" placeholderTextColor={Colors.textMuted} value={newPw} onChangeText={setNewPw} />
            <Text style={s.fieldLabel}>Confirm New Password</Text>
            <TextInput style={s.input} secureTextEntry placeholder="Repeat new password" placeholderTextColor={Colors.textMuted} value={confirmPw} onChangeText={setConfirmPw} />
            <TouchableOpacity style={s.primaryBtn} onPress={handleChangePassword} disabled={changingPw}>
              {changingPw ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Change Password</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function DetailRow({ label, value, valueColor }: { label: string; value?: string | null; valueColor?: string }) {
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={[s.detailValue, valueColor ? { color: valueColor } : {}]} numberOfLines={1}>{value || '—'}</Text>
    </View>
  );
}

function ActionRow({ icon, label, onPress, danger, accent }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string; onPress: () => void; danger?: boolean; accent?: boolean;
}) {
  const color = danger ? '#ef4444' : accent ? Colors.primary : Colors.textPrimary;
  return (
    <TouchableOpacity
      style={[s.actionRow, accent && { backgroundColor: Colors.primary + '18', borderRadius: Radius.sm }, danger && { backgroundColor: '#ef444410', borderRadius: Radius.sm }]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={18} color={color} style={{ marginRight: Spacing.sm }} />
      <Text style={[s.actionRowLabel, { color }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={accent ? color : Colors.textMuted} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },

  // Banner
  banner: {
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg,
    overflow: 'hidden',
  },
  bannerGlow: {
    position: 'absolute', right: -40, top: -40,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: Colors.primary, opacity: 0.07,
  },
  bannerContent: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm },
  avatarWrap: { position: 'relative' },
  avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: Colors.border },
  avatarFallback: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.border,
  },
  avatarFallbackText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  avatarCameraBtn: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: Colors.bgCardAlt || Colors.bgInput,
    borderRadius: 10, width: 20, height: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  bannerName: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 6 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: Radius.full, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  editProfileBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.bgCardAlt || Colors.bgInput,
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 10, paddingVertical: 7,
    alignSelf: 'flex-start',
  },
  editProfileBtnText: { color: Colors.textPrimary, fontSize: 12, fontWeight: '600' },

  body: { padding: Spacing.md, gap: Spacing.md },

  verifyCard: {
    backgroundColor: '#f59e0b11', borderWidth: 1, borderColor: '#f59e0b33',
    borderRadius: Radius.md, padding: Spacing.md, gap: 6,
  },
  verifyTitle: { color: '#f59e0b', fontWeight: '700', fontSize: 14 },
  verifyText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  verifyLink: { color: '#f59e0b', fontWeight: '700', fontSize: 13 },

  card: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  cardTitle: {
    color: Colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1,
  },

  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12,
  },
  detailLabel: { color: Colors.textMuted, fontSize: 13, paddingTop: 1 },
  detailValue: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right', flexWrap: 'wrap' },

  actionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  actionRowLabel: { flex: 1, fontSize: 14, fontWeight: '500' },

  version: {
    color: Colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: Spacing.xl,
  },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.lg, paddingBottom: 40, maxHeight: '90%',
    borderTopWidth: 1, borderColor: Colors.border,
  },
  modalHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },
  fieldLabel: { color: Colors.textMuted, fontSize: 12, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: Colors.bg, color: Colors.textPrimary,
    borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 12,
    fontSize: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 4,
  },
  uniRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  uniRowActive: { },
  uniRowText: { color: Colors.textPrimary, fontSize: 14 },
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.sm,
    paddingVertical: 14, alignItems: 'center', marginTop: Spacing.lg,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
