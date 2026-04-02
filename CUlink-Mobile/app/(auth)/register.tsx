import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { authAPI } from '../../services/api';
import { useAuthStore } from '../../store';
import { Colors, Spacing, Radius } from '../../constants';

export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password || !password2) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (password !== password2) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await authAPI.register({
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password,
        password2,
      });
      await setAuth(res.data.user, res.data.access, res.data.refresh);
      Alert.alert(
        'Account Created!',
        'Please check your email and verify your account to access all features.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/wall') }]
      );
    } catch (err: any) {
      const data = err.response?.data;
      let msg = 'Registration failed. Please try again.';
      if (data) {
        const firstKey = Object.keys(data)[0];
        if (firstKey && Array.isArray(data[firstKey])) {
          msg = `${firstKey}: ${data[firstKey][0]}`;
        } else if (typeof data === 'string') {
          msg = data;
        }
      }
      Alert.alert('Registration Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>CU</Text>
          </View>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join the CUlink community</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign Up</Text>

          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="Choose a username"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="your@email.com"
            placeholderTextColor={Colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Min. 8 characters"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Repeat password"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
            value={password2}
            onChangeText={setPassword2}
            onSubmitEditing={handleRegister}
          />

          <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={styles.link}>Sign In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg },
  header: { alignItems: 'center', marginBottom: Spacing.xl },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 16, elevation: 12,
  },
  logoText: { color: '#fff', fontSize: 26, fontWeight: '800' },
  title: { color: Colors.textPrimary, fontSize: 28, fontWeight: '800' },
  subtitle: { color: Colors.textSecondary, fontSize: 14, marginTop: 4 },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: Spacing.sm },
  label: { color: Colors.textSecondary, fontSize: 13, marginBottom: 6, marginTop: Spacing.sm },
  input: {
    backgroundColor: Colors.bgInput, color: Colors.textPrimary,
    borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 14,
    fontSize: 15, borderWidth: 1, borderColor: Colors.border,
  },
  btn: {
    backgroundColor: Colors.primary, borderRadius: Radius.sm,
    paddingVertical: 15, alignItems: 'center', marginTop: Spacing.lg,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.md },
  footerText: { color: Colors.textSecondary, fontSize: 14 },
  link: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
});
