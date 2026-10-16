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
  Image,
  Modal,
} from 'react-native';
import { COLORS } from '../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PREF_SERVER_URL, IP_PRESETS } from '../constants/config';

export default function LoginScreen({ serverUrl, setServerUrl, onLoginSuccess, deviceId }) {
  const [roleTab, setRoleTab] = useState('student'); // 'student' | 'admin'
  const [studentId, setStudentId] = useState('');
  const [studentPassword, setStudentPassword] = useState('');

  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [showServerModal, setShowServerModal] = useState(false);
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
      const res = await fetch(`${trimmed}/api/health`, { timeout: 6000 });
      const data = await res.json();
      if (data.status === 'online') {
        if (setServerUrl) setServerUrl(trimmed);
        await AsyncStorage.setItem(PREF_SERVER_URL, trimmed);
        setCustomServerUrl(trimmed);
        setShowServerModal(false);
        Alert.alert('Server Connected! 🟢', `Successfully connected to:\n${trimmed}\n\nFastAPI Engine: Online`);
      } else {
        Alert.alert('Server Returned Error', JSON.stringify(data));
      }
    } catch (err) {
      Alert.alert(
        'Cannot Reach Server',
        `Could not reach:\n${trimmed}\n\n• Check your internet connection.\n• Verify the server is running.\n\nError: ${err.message}`
      );
    } finally {
      setIsTestingUrl(false);
    }
  };

  const handleStudentLogin = async () => {
    if (!studentId.trim()) {
      Alert.alert('Required', 'Please enter your Student ID / Roll Number.');
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
          device_id: deviceId || 'Mobile Device',
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
      Alert.alert('Network Error', `Could not reach server at ${serverUrl}.\n${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    if (!adminUsername.trim() || !adminPassword.trim()) {
      Alert.alert('Required', 'Please enter your username and password.');
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
        Alert.alert('Access Denied', data.detail || 'Invalid faculty credentials.');
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
        {/* Top Minimal Server Status Bar */}
        <View style={styles.topBar}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={styles.serverPill}
            onPress={() => setShowServerModal(true)}>
            <View style={styles.statusDot} />
            <Text style={styles.serverPillText} numberOfLines={1}>
              {serverUrl?.includes('onrender.com') ? 'Cloud Server' : 'Server Online'}
            </Text>
            <Text style={styles.gearIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Brand Header */}
        <View style={styles.brandBox}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.appLogo}
          />
          <Text style={styles.appTitle}>Smart Attendance</Text>
          <Text style={styles.appSubtitle}>Facial Biometrics & Campus Geofencing</Text>
        </View>

        {/* Role Selector Tabs */}
        <View style={styles.roleTabs}>
          <TouchableOpacity
            style={[styles.roleTab, roleTab === 'student' && styles.roleTabActive]}
            onPress={() => setRoleTab('student')}>
            <Text style={[styles.roleTabText, roleTab === 'student' && styles.roleTabTextActive]}>
              👨‍🎓 Student
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
              <Text style={styles.cardHeading}>Student Portal</Text>
              <Text style={styles.cardSub}>Sign in to verify your hourly attendance.</Text>

              <Text style={styles.inputLabel}>STUDENT ROLL NUMBER / ID</Text>
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
                placeholder="Enter password"
                placeholderTextColor={COLORS.textDim}
                value={studentPassword}
                onChangeText={setStudentPassword}
                secureTextEntry
              />

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
              <Text style={styles.cardSub}>Manage enrollments, GPS boundaries & master audits.</Text>

              <Text style={styles.inputLabel}>USERNAME</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter username"
                placeholderTextColor={COLORS.textDim}
                value={adminUsername}
                onChangeText={setAdminUsername}
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>PASSWORD</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter password"
                placeholderTextColor={COLORS.textDim}
                value={adminPassword}
                onChangeText={setAdminPassword}
                secureTextEntry
              />

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
          <Text style={styles.timetableTitle}>ACADEMIC TIMETABLE (09:00 AM – 05:00 PM)</Text>
          <Text style={styles.timetableRow}>• Morning Sessions: 09:00 AM – 01:00 PM (Periods 1-4)</Text>
          <Text style={[styles.timetableRow, { color: COLORS.accentAmber }]}>• Lunch Break: 01:00 PM – 02:00 PM (1 Hour)</Text>
          <Text style={styles.timetableRow}>• Afternoon Sessions: 02:00 PM – 05:00 PM (Periods 5-7)</Text>
          <Text style={[styles.timetableRow, { color: COLORS.accentCyan, marginTop: 4 }]}>
            ⏱️ 0-10m On-Time | 10-30m Late | &gt;30m Locked Out
          </Text>
        </View>
      </ScrollView>

      {/* Clean Server Settings Modal */}
      <Modal
        visible={showServerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowServerModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Server Configuration</Text>
              <TouchableOpacity onPress={() => setShowServerModal(false)} style={styles.closeBtn}>
                <Text style={{ color: COLORS.textMuted, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              Current backend server connection:
            </Text>

            <TextInput
              style={styles.serverInput}
              value={customServerUrl}
              onChangeText={setCustomServerUrl}
              placeholder="https://..."
              placeholderTextColor={COLORS.textDim}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Presets */}
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
                <Text style={styles.saveServerBtnText}>Test & Connect Server</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  topBar: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  serverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  serverPillText: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginRight: 4,
  },
  gearIcon: {
    fontSize: 10,
  },
  brandBox: {
    alignItems: 'center',
    marginBottom: 24,
  },
  appLogo: {
    width: 82,
    height: 82,
    borderRadius: 22,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5,
  },
  appSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  roleTabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgSurfaceElevated,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  roleTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  roleTabActive: {
    backgroundColor: COLORS.primary,
  },
  roleTabText: {
    color: COLORS.textMuted,
    fontWeight: '600',
    fontSize: 13,
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  cardHeading: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  cardSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
    marginBottom: 18,
  },
  inputLabel: {
    color: COLORS.textDim,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.bgSurfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 14,
    marginBottom: 16,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
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
    marginTop: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  timetableTitle: {
    color: COLORS.textDim,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  timetableRow: {
    color: COLORS.textMuted,
    fontSize: 11.5,
    marginVertical: 1.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: COLORS.bgSurface,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 4,
  },
  modalDesc: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginBottom: 12,
  },
  serverInput: {
    backgroundColor: COLORS.bgSurfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 13,
    marginBottom: 12,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  presetChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  saveServerBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveServerBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
});
