import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Modal, TextInput, useColorScheme,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { profileAPI, authAPI } from '../../services/api';
import { useAuthStore, useThemeStore } from '../../store';
import { useTheme, ThemeColors, Spacing, Radius } from '../../constants';

const UNIVERSITY_CHOICES = [
  { value: 'CTU', label: 'CTU - Cebu Technological University' },
  { value: 'CEC', label: 'CEC - Cebu Eastern College' },
  { value: 'SWU', label: 'SWU - Southwestern University' },
  { value: 'ACT', label: 'ACT - Asian College of Technology' },
  { value: 'UV',  label: 'UV - University of the Visayas' },
  { value: '',    label: 'None / Unset' },
];

export default function ProfileScreen() {
  const C = useTheme();
  const { user, setUser, clearAuth } = useAuthStore();
  const { isDark, toggle: toggleTheme } = useThemeStore();
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
      Alert.alert('Success', 'Password changed!');
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

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={C.primary} size="large" />
    </View>
  );

  const displayNameText = user?.display_name || user?.username || '';
  const roleBadgeColor = user?.role === 'admin' ? '#ef4444' : user?.role === 'moderator' ? '#f59e0b' : C.primary;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header Banner ──────────────────────────────────── */}
      <View style={[{
        backgroundColor: C.bgCard,
        borderBottomWidth: 1, borderBottomColor: C.border,
        paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg,
        paddingTop: insets.top + 16,
        overflow: 'hidden',
      }]}>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm }}>
          {/* Avatar — fixed: just the image/fallback with camera overlay, no misaligned glow */}
          <TouchableOpacity onPress={handlePickAvatar} disabled={saving} style={{ position: 'relative' }}>
            {user?.avatar_url ? (
              <Image
                source={{ uri: user.avatar_url }}
                style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: C.primary }}
                contentFit="cover"
              />
            ) : (
              <View style={{
                width: 76, height: 76, borderRadius: 38,
                backgroundColor: C.primary,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 2, borderColor: C.primaryDark,
              }}>
                <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800' }}>
                  {displayNameText.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {/* Camera badge */}
            <View style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 22, height: 22, borderRadius: 11,
              backgroundColor: C.bgCard,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1.5, borderColor: C.border,
            }}>
              <Ionicons name="camera" size={11} color={C.textSecondary} />
            </View>
          </TouchableOpacity>

          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <Text style={{ color: C.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 6 }}>
              {displayNameText}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {user?.is_verified ? (
                <View style={[badge, { backgroundColor: '#22c55e22', borderColor: '#22c55e44' }]}>
                  <Ionicons name="shield-checkmark" size={11} color="#22c55e" />
                  <Text style={[badgeText, { color: '#22c55e' }]}>Verified</Text>
                </View>
              ) : (
                <View style={[badge, { backgroundColor: '#f59e0b22', borderColor: '#f59e0b44' }]}>
                  <Ionicons name="alert-circle" size={11} color="#f59e0b" />
                  <Text style={[badgeText, { color: '#f59e0b' }]}>Unverified</Text>
                </View>
              )}
              {user?.role && (
                <View style={[badge, { backgroundColor: roleBadgeColor + '22', borderColor: roleBadgeColor + '44' }]}>
                  <Text style={[badgeText, { color: roleBadgeColor }]}>{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</Text>
                </View>
              )}
              {user?.university && (
                <View style={[badge, { backgroundColor: C.border, borderColor: C.borderLight }]}>
                  <Text style={[badgeText, { color: C.textSecondary }]}>{user.university}</Text>
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              backgroundColor: C.bgCardAlt, borderRadius: Radius.sm,
              borderWidth: 1, borderColor: C.border,
              paddingHorizontal: 10, paddingVertical: 7, alignSelf: 'flex-start',
            }}
            onPress={() => { setDisplayName(user?.display_name || ''); setUniversity(user?.university || ''); setEditVisible(true); }}
          >
            <Ionicons name="create-outline" size={14} color={C.textPrimary} />
            <Text style={{ color: C.textPrimary, fontSize: 12, fontWeight: '600' }}>Edit Profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ padding: Spacing.md, gap: Spacing.md }}>
        {/* ── Email verification nudge ── */}
        {!user?.is_verified && (
          <View style={{ backgroundColor: '#f59e0b11', borderWidth: 1, borderColor: '#f59e0b33', borderRadius: Radius.md, padding: Spacing.md, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="mail-outline" size={16} color="#f59e0b" />
              <Text style={{ color: '#f59e0b', fontWeight: '700', fontSize: 14 }}>Verify your email</Text>
            </View>
            <Text style={{ color: C.textSecondary, fontSize: 13, lineHeight: 18 }}>Verify your email to access Chat and the Knowledge Wall.</Text>
            <TouchableOpacity onPress={handleResendVerification} disabled={resending}>
              {resending
                ? <ActivityIndicator color="#f59e0b" size="small" />
                : <Text style={{ color: '#f59e0b', fontWeight: '700', fontSize: 13 }}>Resend verification email →</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Account Details ── */}
        <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: Spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <Ionicons name="person-circle-outline" size={16} color={C.primary} />
            <Text style={{ color: C.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>ACCOUNT DETAILS</Text>
          </View>
          <DetailRow label="Username" value={user?.username} C={C} />
          <DetailRow label="Email" value={user?.email} C={C} />
          {user?.university && <DetailRow label="University" value={UNIVERSITY_CHOICES.find(u => u.value === user.university)?.label || user.university} C={C} />}
          <DetailRow label="Role" value={user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : ''} C={C} />
          <DetailRow label="Email Verified" value={user?.is_verified ? 'Yes' : 'No'} valueColor={user?.is_verified ? '#22c55e' : '#ef4444'} C={C} />
        </View>

        {/* ── Quick Actions ── */}
        <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: Spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <Ionicons name="flash-outline" size={16} color={C.primary} />
            <Text style={{ color: C.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>QUICK ACTIONS</Text>
          </View>
          <ActionRow icon="create-outline" label="Edit Profile" onPress={() => { setDisplayName(user?.display_name || ''); setUniversity(user?.university || ''); setEditVisible(true); }} accent C={C} />
          <ActionRow icon="lock-closed-outline" label="Change Password" onPress={() => setPwVisible(true)} C={C} />
          {user?.role === 'admin' && (
            <ActionRow icon="shield-outline" label="Admin Dashboard" onPress={() => Alert.alert('Admin', 'Open the web admin panel at culink.me/admin')} C={C} />
          )}
          {/* Dark / Light mode toggle */}
          <TouchableOpacity
            style={[{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border }]}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isDark ? 'moon' : 'sunny-outline'}
              size={18}
              color={isDark ? '#a78bfa' : '#64748b'}
              style={{ marginRight: Spacing.sm }}
            />
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '500', color: C.textPrimary }}>
              Dark Mode
            </Text>
            {/* Toggle pill — circle moves RIGHT when ON */}
            <View style={{
              width: 44, height: 26, borderRadius: 13,
              backgroundColor: isDark ? '#a78bfa' : C.border,
              justifyContent: 'center',
              paddingHorizontal: 3,
            }}>
              <View style={{
                width: 20, height: 20, borderRadius: 10,
                backgroundColor: '#fff',
                transform: [{ translateX: isDark ? 18 : 0 }],
              }} />
            </View>
          </TouchableOpacity>
          <ActionRow icon="log-out-outline" label="Sign Out" onPress={handleLogout} danger C={C} />
        </View>

        <Text style={{ color: C.textMuted, fontSize: 12, textAlign: 'center', marginTop: Spacing.xl }}>CUlink Mobile v1.0.0</Text>
      </View>

      {/* ── Edit Profile Modal ── */}
      <Modal visible={editVisible} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: 40, maxHeight: '90%', borderTopWidth: 1, borderColor: C.border }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg }}>
                <Text style={{ color: C.textPrimary, fontSize: 18, fontWeight: '700' }}>Edit Profile</Text>
                <TouchableOpacity onPress={() => setEditVisible(false)} hitSlop={8}>
                  <Ionicons name="close" size={22} color={C.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={{ color: C.textMuted, fontSize: 12, marginBottom: 6, marginTop: 4 }}>Display Name</Text>
              <TextInput
                style={{ backgroundColor: C.bg, color: C.textPrimary, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 14, borderWidth: 1, borderColor: C.border, marginBottom: 4 }}
                placeholder="Your display name" placeholderTextColor={C.textMuted}
                value={displayName} onChangeText={setDisplayName} maxLength={60}
              />

              <Text style={{ color: C.textMuted, fontSize: 12, marginBottom: 6, marginTop: 12 }}>University</Text>
              {UNIVERSITY_CHOICES.map((u) => (
                <TouchableOpacity key={u.value}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.border }}
                  onPress={() => setUniversity(u.value)}
                >
                  <Text style={{ color: university === u.value ? C.primary : C.textPrimary, fontSize: 14 }}>{u.label}</Text>
                  {university === u.value && <Ionicons name="checkmark" size={16} color={C.primary} />}
                </TouchableOpacity>
              ))}

              <TouchableOpacity style={{ backgroundColor: C.primary, borderRadius: Radius.sm, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.lg }} onPress={handleSaveProfile} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Save Changes</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Change Password Modal ── */}
      <Modal visible={pwVisible} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: 40, borderTopWidth: 1, borderColor: C.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg }}>
              <Text style={{ color: C.textPrimary, fontSize: 18, fontWeight: '700' }}>Change Password</Text>
              <TouchableOpacity onPress={() => setPwVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={C.textMuted} />
              </TouchableOpacity>
            </View>
            {[
              { label: 'Current Password', val: oldPw, set: setOldPw, ph: 'Current password' },
              { label: 'New Password', val: newPw, set: setNewPw, ph: 'Min. 8 characters' },
              { label: 'Confirm New Password', val: confirmPw, set: setConfirmPw, ph: 'Repeat new password' },
            ].map(({ label, val, set, ph }) => (
              <View key={label}>
                <Text style={{ color: C.textMuted, fontSize: 12, marginBottom: 6, marginTop: 12 }}>{label}</Text>
                <TextInput
                  style={{ backgroundColor: C.bg, color: C.textPrimary, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 14, borderWidth: 1, borderColor: C.border }}
                  secureTextEntry placeholder={ph} placeholderTextColor={C.textMuted}
                  value={val} onChangeText={set}
                />
              </View>
            ))}
            <TouchableOpacity style={{ backgroundColor: C.primary, borderRadius: Radius.sm, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.lg }} onPress={handleChangePassword} disabled={changingPw}>
              {changingPw ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Change Password</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ── Shared static styles ────────────────────────────────────────────────────
const badge: object = {
  flexDirection: 'row', alignItems: 'center', gap: 4,
  borderRadius: Radius.full, borderWidth: 1,
  paddingHorizontal: 8, paddingVertical: 3,
};
const badgeText: object = { fontSize: 11, fontWeight: '700' };

function DetailRow({ label, value, valueColor, C }: { label: string; value?: string | null; valueColor?: string; C: ThemeColors }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: Spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, gap: 12 }}>
      <Text style={{ color: C.textMuted, fontSize: 13, paddingTop: 1 }}>{label}</Text>
      <Text style={{ color: valueColor || C.textPrimary, fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' }} numberOfLines={1}>
        {value || '—'}
      </Text>
    </View>
  );
}

function ActionRow({ icon, label, onPress, danger, accent, C }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string; onPress: () => void; danger?: boolean; accent?: boolean; C: ThemeColors;
}) {
  const color = danger ? '#ef4444' : accent ? C.primary : C.textPrimary;
  return (
    <TouchableOpacity
      style={[{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border },
        accent && { backgroundColor: C.primary + '18' },
        danger  && { backgroundColor: '#ef444410' },
      ]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={18} color={color} style={{ marginRight: Spacing.sm }} />
      <Text style={{ flex: 1, fontSize: 14, fontWeight: '500', color }}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={accent ? color : C.textMuted} />
    </TouchableOpacity>
  );
}
