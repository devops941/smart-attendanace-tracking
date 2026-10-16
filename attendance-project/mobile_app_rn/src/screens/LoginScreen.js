import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { COLORS } from '../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PREF_SERVER_URL, IP_PRESETS } from '../constants/config';

export default function LoginScreen({ serverUrl, setServerUrl, onLoginSuccess }) {
  const [roleTab, setRoleTab] = useState('student'); // 'student' | 'admin'
  const [studentId, setStudentId] = useState('');
  const [studentPassword, setStudentPassword] = useState('student123');

  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('admin123');

  const [isLoading, setIsLoading] = useState(false);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [customServerUrl, setCustomServerUrl] = useState(serverUrl || '');
  const [isTestingUrl, setIsTestingUrl] = useState(false);

  const handleApplyServerUrl = async (newUrl) => {
    const trimmed = (newUrl || customServerUrl).trim().replace(/\/$/, '');
    if (!trimmed) {
      Alert.alert('Invalid URL', 'Please enter a valid HTTP/HTTPS address.');
      return;
    }
    setIsTestingUrl(true);
    try {
      const res = await fetch(`${trimmed}/api/health`, { timeout: 5000 });
      const data = await res.json();
      if (data.status === 'online') {
        if (setServerUrl) setServerUrl(trimmed);
        await AsyncStorage.setItem(PREF_SERVER_URL, trimmed);
        setCustomServerUrl(trimmed);
        setShowServerConfig(false);
        Alert.alert('Server Connected! 🟢', `Successfully connected to:\n${trimmed}\n\nFastAPI Engine: Online`);
      } else {
        Alert.alert('Server Returned Error', JSON.stringify(data));
      }
    } catch (err) {
      Alert.alert(
        'Cannot Reach Server',
        `Could not reach:\n${trimmed}\n\n• If using local Wi-Fi, ensure PC & Phone are on the same Wi-Fi.\n• Check if backend is running.\n\nError: ${err.message}`
      );
    } finally {
      setIsTestingUrl(false);
    }
  };

  const handleStudentLogin = async () => {
    if (!studentId.trim()) {
      Alert.alert('Required', 'Please enter your Student Roll Number / ID.');
      return;
    }
    if (!studentPassword.trim()) {
      Alert.alert('Required', 'Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${serverUrl}/api/student/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          student_id: studentId.trim(),
          password: studentPassword.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onLoginSuccess({
          role: 'student',
          token: data.token,
          user: data.student,
        });
      } else {
        Alert.alert('Login Failed', data.detail || 'Invalid Student ID or password.');
      }
    } catch (err) {
      Alert.alert('Network Error', `Could not reach backend server at ${serverUrl}.\n${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    if (!adminUsername.trim() || !adminPassword.trim()) {
      Alert.alert('Required', 'Please enter username and password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${serverUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          username: adminUsername.trim(),
          password: adminPassword.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onLoginSuccess({
          role: 'admin',
          token: data.token,
          user: data.admin,
        });
      } else {
        Alert.alert('Admin Access Denied', data.detail || 'Invalid faculty credentials.');
      }
    } catch (err) {
      Alert.alert('Network Error', `Could not connect to ${serverUrl}.\n${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Brand Header */}
        <View style={styles.brandBox}>
          <View style={styles.logoBadge}>
            <Text style={{ fontSize: 32 }}>🎓</Text>
          </View>
          <Text style={styles.appTitle}>Smart Campus</Text>
          <Text style={styles.appSubtitle}>8-Hour College Timetable & Facial Biometrics</Text>

          {/* Server Config Trigger Bar */}
          <TouchableOpacity
            style={styles.serverStatusBadge}
            onPress={() => setShowServerConfig(!showServerConfig)}>
            <View style={styles.serverDot} />
            <Text style={styles.serverStatusText} numberOfLines={1}>
              {serverUrl || 'No Server URL Set'}
            </Text>
            <Text style={styles.serverEditLabel}>{showServerConfig ? '▲ Close' : '⚙️ Change IP'}</Text>
          </TouchableOpacity>
        </View>

        {/* Expandable Server Config Panel */}
        {showServerConfig && (
          <View style={styles.serverPanel}>
            <Text style={styles.serverPanelTitle}>🌐 BACKEND SERVER CONNECTION</Text>
            <Text style={styles.serverPanelHelp}>
              Enter your PC's IP address (e.g. http://10.165.124.96:8000) or cloud server URL:
            </Text>

            <TextInput
              style={styles.serverInput}
              value={customServerUrl}
              onChangeText={setCustomServerUrl}
              placeholder="http://10.165.124.96:8000"
              placeholderTextColor={COLORS.textDim}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Quick Presets */}
            <View style={styles.presetsRow}>
              {IP_PRESETS.map((preset, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.presetChip}
                  onPress={() => {
                    setCustomServerUrl(preset.url);
                    handleApplyServerUrl(preset.url);
                  }}>
                  <Text style={[styles.presetChipText, { color: preset.color }]}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.saveServerBtn, isTestingUrl && styles.loginButtonDisabled]}
              onPress={() => handleApplyServerUrl(customServerUrl)}
              disabled={isTestingUrl}>
              {isTestingUrl ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveServerBtnText}>Test & Connect to Server ✓</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Role Selector Tabs */}
        <View style={styles.roleTabs}>
          <TouchableOpacity
            style={[styles.roleTab, roleTab === 'student' && styles.roleTabActive]}
            onPress={() => setRoleTab('student')}>
            <Text style={[styles.roleTabText, roleTab === 'student' && styles.roleTabTextActive]}>
              👨‍🎓 Student Portal
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roleTab, roleTab === 'admin' && styles.roleTabActive]}
            onPress={() => setRoleTab('admin')}>
            <Text style={[styles.roleTabText, roleTab === 'admin' && styles.roleTabTextActive]}>
              🏛️ Faculty / Admin
            </Text>
          </TouchableOpacity>
        </View>

        {/* Card Form */}
        <View style={styles.card}>
          {roleTab === 'student' ? (
            <View>
              <Text style={styles.cardHeading}>Student Attendance Sign-In</Text>
              <Text style={styles.cardSub}>
                Hourly attendance verification (09:00 AM - 05:00 PM).
              </Text>

              <Text style={styles.inputLabel}>STUDENT ID / ROLL NO</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. STU101"
                placeholderTextColor={COLORS.textDim}
                value={studentId}
                onChangeText={setStudentId}
                autoCapitalize="characters"
              />

              <Text style={styles.inputLabel}>PASSWORD</Text>
              <TextInput
                style={styles.input}
                placeholder="Default: student123"
                placeholderTextColor={COLORS.textDim}
                value={studentPassword}
                onChangeText={setStudentPassword}
                secureTextEntry
              />

              <View style={styles.infoBanner}>
                <Text style={styles.infoBannerText}>
                  💡 <Text style={{ fontWeight: 'bold' }}>Default Password:</Text> student123 (or your enrollment PIN).
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                onPress={handleStudentLogin}
                disabled={isLoading}>
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.loginButtonText}>Sign In as Student →</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={styles.cardHeading}>Faculty & Admin Sign-In</Text>
              <Text style={styles.cardSub}>
                Manage student enrollment, GPS geofencing & master audit logs.
              </Text>

              <Text style={styles.inputLabel}>ADMIN USERNAME</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. admin"
                placeholderTextColor={COLORS.textDim}
                value={adminUsername}
                onChangeText={setAdminUsername}
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>PASSWORD</Text>
              <TextInput
                style={styles.input}
                placeholder="Default: admin123"
                placeholderTextColor={COLORS.textDim}
                value={adminPassword}
                onChangeText={setAdminPassword}
                secureTextEntry
              />

              <View style={[styles.infoBanner, { borderColor: 'rgba(56,189,248,0.3)', backgroundColor: 'rgba(56,189,248,0.08)' }]}>
                <Text style={[styles.infoBannerText, { color: COLORS.accentCyan }]}>
                  🛡️ Default Faculty credentials: <Text style={{ fontWeight: 'bold' }}>admin / admin123</Text>
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.loginButton, styles.adminLoginButton, isLoading && styles.loginButtonDisabled]}
                onPress={handleAdminLogin}
                disabled={isLoading}>
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.loginButtonText}>Unlock Admin Dashboard 🔓</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Timetable Overview Footer */}
        <View style={styles.timetablePreview}>
          <Text style={styles.timetableTitle}>COLLEGE TIMETABLE (9:00 AM - 5:00 PM)</Text>
          <Text style={styles.timetableRow}>• Periods 1-4: 09:00 AM – 01:00 PM</Text>
          <Text style={[styles.timetableRow, { color: COLORS.accentAmber }]}>• Lunch Break: 01:00 PM – 02:00 PM (1 Hour)</Text>
          <Text style={styles.timetableRow}>• Periods 5-7: 02:00 PM – 05:00 PM</Text>
          <Text style={[styles.timetableRow, { color: COLORS.accentCyan, marginTop: 4 }]}>
            ⏱️ 0-10m On-Time | 10-30m Late | &gt;30m Locked Out
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgBase,
  },
  scroll: {
    padding: 22,
    justifyContent: 'center',
    minHeight: '100%',
  },
  brandBox: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  appTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  appSubtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  roleTabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgSurface,
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  roleTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  roleTabActive: {
    backgroundColor: COLORS.primary,
  },
  roleTabText: {
    color: COLORS.textMuted,
    fontSize: 12.5,
    fontWeight: '600',
  },
  roleTabTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  cardHeading: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardSub: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  inputLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#fff',
    fontSize: 14,
    marginBottom: 14,
  },
  infoBanner: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  infoBannerText: {
    color: COLORS.primaryLight,
    fontSize: 11.5,
    lineHeight: 16,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  adminLoginButton: {
    backgroundColor: '#4338CA',
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  timetablePreview: {
    marginTop: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  timetableTitle: {
    color: COLORS.textDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  timetableRow: {
    color: COLORS.textMuted,
    fontSize: 11.5,
    marginVertical: 1,
  },
  serverStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 10,
    maxWidth: '90%',
  },
  serverDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  serverStatusText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flexShrink: 1,
  },
  serverEditLabel: {
    color: COLORS.accentCyan,
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 8,
  },
  serverPanel: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    padding: 14,
    marginBottom: 16,
  },
  serverPanelTitle: {
    color: COLORS.accentCyan,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  serverPanelHelp: {
    color: COLORS.textDim,
    fontSize: 11,
    marginBottom: 10,
  },
  serverInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 10,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  presetChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  presetChipText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  saveServerBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveServerBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
});
