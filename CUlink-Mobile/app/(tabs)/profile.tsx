import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Modal, TextInput, Switch,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
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
  const [loading, setLoading] = useState(false);

  // Edit profile modal
  const [editVisible, setEditVisible] = useState(false);
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [university, setUniversity] = useState(user?.university || '');
  const [saving, setSaving] = useState(false);

  // Change password modal
  const [pwVisible, setPwVisible] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  // Verify email nudge
  const [resending, setResending] = useState(false);

  const refreshProfile = async () => {
    setLoading(true);
    try {
      const res = await profileAPI.getProfile();
      setUser(res.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { refreshProfile(); }, []);

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;

    const uri = result.assets[0].uri;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('avatar', { uri, name: 'avatar.jpg', type: 'image/jpeg' } as any);
      const res = await profileAPI.updateProfile(formData);
      setUser(res.data);
      Alert.alert('✓ Avatar updated!');
    } catch {
      Alert.alert('Error', 'Could not upload avatar.');
    } finally {
      setSaving(false);
    }
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
      Alert.alert('✓ Profile updated!');
    } catch {
      Alert.alert('Error', 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPw || !newPw || !confirmPw) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (newPw !== confirmPw) {
      Alert.alert('Error', 'New passwords do not match.');
      return;
    }
    setChangingPw(true);
    try {
      await profileAPI.changePassword({ old_password: oldPw, new_password: newPw, confirm_password: confirmPw });
      setPwVisible(false);
      setOldPw(''); setNewPw(''); setConfirmPw('');
      Alert.alert('✓ Password changed!');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Could not change password.';
      Alert.alert('Error', msg);
    } finally {
      setChangingPw(false);
    }
  };

  const handleResendVerification = async () => {
    if (!user?.email) return;
    setResending(true);
    try {
      await authAPI.resendVerification(user.email);
      Alert.alert('Sent!', 'Check your email for the verification link.');
    } catch {
      Alert.alert('Error', 'Could not resend verification email.');
    } finally {
      setResending(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => clearAuth() },
    ]);
  };

  const avatarUri = user?.avatar_url;
  const displayNameText = user?.display_name || user?.username || '';
  const roleBadgeColor = user?.role === 'admin' ? Colors.error : user?.role === 'moderator' ? Colors.warning : Colors.primary;

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* Header banner */}
      <View style={styles.banner} />

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={handlePickAvatar} disabled={saving}>
          <View style={styles.avatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>{displayNameText.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Text style={{ fontSize: 12 }}>📷</Text>
            </View>
          </View>
        </TouchableOpacity>

        <Text style={styles.displayName}>{displayNameText}</Text>
        <Text style={styles.username}>@{user?.username}</Text>

        <View style={styles.badgeRow}>
          <View style={[styles.roleBadge, { backgroundColor: roleBadgeColor + '33' }]}>
            <Text style={[styles.roleBadgeText, { color: roleBadgeColor }]}>
              {user?.role?.toUpperCase()}
            </Text>
          </View>
          {user?.university && (
            <View style={styles.uniBadge}>
              <Text style={styles.uniBadgeText}>{user.university}</Text>
            </View>
          )}
          {user?.is_verified ? (
            <View style={[styles.verifiedBadge]}>
              <Text style={styles.verifiedText}>✓ Verified</Text>
            </View>
          ) : (
            <View style={[styles.verifiedBadge, { backgroundColor: Colors.warning + '22' }]}>
              <Text style={[styles.verifiedText, { color: Colors.warning }]}>⚠ Unverified</Text>
            </View>
          )}
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{user?.post_count ?? 0}</Text>
          <Text style={styles.statLabel}>Posts</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{user?.email}</Text>
          <Text style={styles.statLabel}>Email</Text>
        </View>
      </View>

      {/* Email verification nudge */}
      {!user?.is_verified && (
        <View style={styles.verifyCard}>
          <Text style={styles.verifyTitle}>📧 Verify your email</Text>
          <Text style={styles.verifyText}>
            Verify your email to access Chat and the Knowledge Wall.
          </Text>
          <TouchableOpacity style={styles.verifyBtn} onPress={handleResendVerification} disabled={resending}>
            {resending ? (
              <ActivityIndicator color={Colors.warning} size="small" />
            ) : (
              <Text style={styles.verifyBtnText}>Resend Verification Email</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Settings list */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>

        <SettingRow
          icon="✏️"
          label="Edit Profile"
          onPress={() => {
            setDisplayName(user?.display_name || '');
            setUniversity(user?.university || '');
            setEditVisible(true);
          }}
        />
        <SettingRow
          icon="🔒"
          label="Change Password"
          onPress={() => setPwVisible(true)}
        />
        <SettingRow
          icon="🚪"
          label="Sign Out"
          onPress={handleLogout}
          danger
        />
      </View>

      <Text style={styles.version}>CUlink Mobile v1.0.0</Text>

      {/* ── Edit Profile Modal ────────────────────────────────────────────── */}
      <Modal visible={editVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Display Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Your display name"
              placeholderTextColor={Colors.textMuted}
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={60}
            />

            <Text style={styles.fieldLabel}>University</Text>
            {UNIVERSITY_CHOICES.map((u) => (
              <TouchableOpacity
                key={u.value}
                style={[styles.uniOption, university === u.value && styles.uniOptionActive]}
                onPress={() => setUniversity(u.value)}
              >
                <Text style={[styles.uniOptionText, university === u.value && { color: Colors.primary }]}>
                  {u.label}
                </Text>
                {university === u.value && <Text style={{ color: Colors.primary }}>✓</Text>}
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Change Password Modal ─────────────────────────────────────────── */}
      <Modal visible={pwVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setPwVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Current Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter current password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              value={oldPw}
              onChangeText={setOldPw}
            />

            <Text style={styles.fieldLabel}>New Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Min. 8 characters"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              value={newPw}
              onChangeText={setNewPw}
            />

            <Text style={styles.fieldLabel}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Repeat new password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              value={confirmPw}
              onChangeText={setConfirmPw}
            />

            <TouchableOpacity style={styles.saveBtn} onPress={handleChangePassword} disabled={changingPw}>
              {changingPw ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Change Password</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function SettingRow({ icon, label, onPress, danger }: {
  icon: string; label: string; onPress: () => void; danger?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.settingRow} onPress={onPress}>
      <Text style={styles.settingIcon}>{icon}</Text>
      <Text style={[styles.settingLabel, danger && { color: Colors.error }]}>{label}</Text>
      <Text style={styles.settingChevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg },

  banner: {
    height: 120,
    backgroundColor: Colors.primary,
    opacity: 0.15,
  },

  avatarSection: { alignItems: 'center', marginTop: -48, paddingHorizontal: Spacing.lg },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 3, borderColor: Colors.bg,
  },
  avatarFallback: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: Colors.bg,
  },
  avatarFallbackText: { color: '#fff', fontSize: 36, fontWeight: '800' },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: Colors.bgCard, borderRadius: Radius.full,
    width: 28, height: 28, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },

  displayName: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800', marginTop: Spacing.sm },
  username: { color: Colors.textMuted, fontSize: 14, marginTop: 2 },

  badgeRow: { flexDirection: 'row', gap: 8, marginTop: Spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
  roleBadge: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  roleBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  uniBadge: {
    backgroundColor: Colors.bgInput, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  uniBadgeText: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },
  verifiedBadge: {
    backgroundColor: Colors.success + '22', borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  verifiedText: { color: Colors.success, fontSize: 11, fontWeight: '700' },

  statsRow: {
    flexDirection: 'row', backgroundColor: Colors.bgCard,
    margin: Spacing.md, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { color: Colors.textPrimary, fontWeight: '700', fontSize: 16, textAlign: 'center' },
  statLabel: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, height: 36, backgroundColor: Colors.border },

  verifyCard: {
    backgroundColor: Colors.warning + '11',
    borderWidth: 1, borderColor: Colors.warning + '44',
    borderRadius: Radius.md, margin: Spacing.md, padding: Spacing.md,
  },
  verifyTitle: { color: Colors.warning, fontWeight: '700', fontSize: 15, marginBottom: 4 },
  verifyText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: Spacing.sm },
  verifyBtn: { alignSelf: 'flex-start' },
  verifyBtnText: { color: Colors.warning, fontWeight: '700', fontSize: 13 },

  section: {
    marginHorizontal: Spacing.md, marginTop: Spacing.md,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  sectionTitle: {
    color: Colors.textMuted, fontSize: 12, fontWeight: '700',
    letterSpacing: 0.8, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    textTransform: 'uppercase', borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  settingIcon: { fontSize: 18, marginRight: Spacing.sm },
  settingLabel: { flex: 1, color: Colors.textPrimary, fontSize: 15 },
  settingChevron: { color: Colors.textMuted, fontSize: 20 },

  version: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: Spacing.xl },

  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.lg, paddingBottom: 36, maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },
  modalClose: { color: Colors.textMuted, fontSize: 18 },

  fieldLabel: { color: Colors.textSecondary, fontSize: 13, marginBottom: 6, marginTop: Spacing.sm },
  input: {
    backgroundColor: Colors.bgInput, color: Colors.textPrimary,
    borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 12,
    fontSize: 15, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },

  uniOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  uniOptionActive: { backgroundColor: Colors.primary + '11' },
  uniOptionText: { color: Colors.textPrimary, fontSize: 14 },

  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.sm,
    paddingVertical: 14, alignItems: 'center', marginTop: Spacing.md,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
