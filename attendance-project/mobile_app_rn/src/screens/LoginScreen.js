import React, { useState, useEffect } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PREF_SERVER_URL, IP_PRESETS } from '../constants/config';

export default function LoginScreen({ serverUrl, setServerUrl, onLoginSuccess, deviceId }) {
  const [roleTab, setRoleTab] = useState('employee'); // 'employee' | 'admin'
  const [empCode, setEmpCode] = useState('');
  const [empPassword, setEmpPassword] = useState('');

  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [showServerModal, setShowServerModal] = useState(false);
  const [customServerUrl, setCustomServerUrl] = useState(serverUrl || '');
  const [isTestingUrl, setIsTestingUrl] = useState(false);



  const handleApplyServerUrl = async (newUrl) => {
    const trimmed = (newUrl || customServerUrl).trim().replace(/\/+$/, '');
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
        Alert.alert('Server Connected', `Successfully connected to:\n${trimmed}\n\nFastAPI Engine: Online`);
      } else {
        Alert.alert('Server Returned Error', JSON.stringify(data));
      }
    } catch (err) {
      Alert.alert(
        'Cannot Reach Server',
        `Could not reach:\n${trimmed}\n\n• Check your Wi-Fi/network.\n• Ensure the backend is running.\n\nError: ${err.message}`
      );
    } finally {
      setIsTestingUrl(false);
    }
  };

  const handleEmployeeLogin = async () => {
    if (!empCode.trim()) {
      Alert.alert('Required', 'Please enter your Employee Code / Badge ID.');
      return;
    }
    if (!empPassword.trim()) {
      Alert.alert('Required', 'Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const cleanUrl = (serverUrl || '').trim().replace(/\/+$/, '');
      let res = await fetch(`${cleanUrl}/api/employee/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          emp_code: empCode.trim(),
          password: empPassword.trim(),
          device_id: deviceId || 'Mobile Device',
        }),
      });

      let data = await res.json();
      if (res.ok && data.success) {
        onLoginSuccess({
          role: 'employee',
          token: data.token,
          user: data.employee,
        });
      } else {
        Alert.alert('Login Failed', data.detail || 'Invalid Employee Code or password. (Default: office123)');
      }
    } catch (err) {
      Alert.alert('Network Error', `Could not reach server at ${serverUrl}.\n${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    if (!adminUsername.trim() || !adminPassword.trim()) {
      Alert.alert('Required', 'Please enter HR admin username and password.');
      return;
    }

    setIsLoading(true);
    try {
      const cleanUrl = (serverUrl || '').trim().replace(/\/+$/, '');
      
      // Attempt login via /api/admin/login first, fallback to /api/faculty/login if needed
      let res = await fetch(`${cleanUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          username: adminUsername.trim(),
          password: adminPassword.trim(),
          device_id: deviceId || 'Mobile Device',
        }),
      });

      if (res.status === 404) {
        res = await fetch(`${cleanUrl}/api/faculty/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            username: adminUsername.trim(),
            password: adminPassword.trim(),
            device_id: deviceId || 'Mobile Device',
          }),
        });
      }

      let data = await res.json();
      if (res.ok && data.success) {
        const userObj = data.user || data.admin || {
          username: adminUsername.trim(),
          name: 'HR Administrator',
          full_name: 'HR Administrator',
          role: 'admin',
        };
        onLoginSuccess({
          role: 'admin',
          token: data.token || `admin_token_${Date.now()}`,
          user: userObj,
        });
      } else {
        Alert.alert('Admin Login Failed', data.detail || 'Invalid administrator credentials. (Default: admin / admin123)');
      }
    } catch (err) {
      Alert.alert('Network Error', `Could not reach server at ${serverUrl}.\n${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Top Server Pill */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.serverPill}
            onPress={() => setShowServerModal(true)}>
            <View style={styles.statusDot} />
            <Text style={styles.serverPillText} numberOfLines={1}>
              {serverUrl?.includes('onrender.com') ? 'Cloud Server' : 'Server Online'}
            </Text>
            <Ionicons name="settings-outline" size={13} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Brand Header */}
        <View style={styles.brandBox}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.appLogo}
          />
          <Text style={styles.appTitle}>Smart Office Attendance</Text>
          <Text style={styles.appSubtitle}>Biometric Verification & Live Work Hours Tracking</Text>
        </View>

        {/* Role Selector Tabs */}
        <View style={styles.roleTabs}>
          <TouchableOpacity
            style={[styles.roleTab, roleTab === 'employee' && styles.roleTabActive]}
            onPress={() => setRoleTab('employee')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons
                name="person-outline"
                size={14}
                color={roleTab === 'employee' ? '#fff' : COLORS.textMuted}
              />
              <Text style={[styles.roleTabText, roleTab === 'employee' && styles.roleTabTextActive]}>
                Employee
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roleTab, roleTab === 'admin' && styles.roleTabActive]}
            onPress={() => setRoleTab('admin')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons
                name="shield-outline"
                size={14}
                color={roleTab === 'admin' ? '#fff' : COLORS.textMuted}
              />
              <Text style={[styles.roleTabText, roleTab === 'admin' && styles.roleTabTextActive]}>
                HR / Admin
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Card Form */}
        <View style={styles.card}>
          {roleTab === 'employee' ? (
            <View>
              <Text style={styles.cardHeading}>Employee Sign-In</Text>
              <Text style={styles.cardSub}>Punch in/out and track your daily work hours.</Text>



              <Text style={styles.inputLabel}>EMPLOYEE CODE / BADGE ID</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. EMP003"
                placeholderTextColor={COLORS.textDim}
                value={empCode}
                onChangeText={setEmpCode}
                autoCapitalize="characters"
              />

              <Text style={styles.inputLabel}>PASSWORD</Text>
              <TextInput
                style={styles.input}
                placeholder="Default: office123"
                placeholderTextColor={COLORS.textDim}
                value={empPassword}
                onChangeText={setEmpPassword}
                secureTextEntry
              />

              <TouchableOpacity
                style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                onPress={handleEmployeeLogin}
                disabled={isLoading}>
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.loginButtonText}>Sign In to Employee Portal</Text>
                    <Ionicons name="arrow-forward" size={15} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={styles.cardHeading}>HR Administrator Sign-In</Text>
              <Text style={styles.cardSub}>Manage employee records, office geofences & payroll timesheets.</Text>

              {/* Quick Select Admin */}
              <View style={styles.quickBox}>
                <View style={styles.quickHeader}>
                  <Ionicons name="shield-checkmark" size={13} color="#818CF8" />
                  <Text style={[styles.quickTitle, { color: '#818CF8' }]}>ADMINISTRATOR PROFILE (TAP TO AUTO-FILL)</Text>
                </View>
                <View style={styles.quickChipsWrap}>
                  <TouchableOpacity
                    style={[styles.quickChip, adminUsername === 'admin' && styles.quickChipActiveAdmin]}
                    onPress={() => {
                      setAdminUsername('admin');
                      setAdminPassword('admin123');
                    }}>
                    <Ionicons
                      name="shield"
                      size={16}
                      color={adminUsername === 'admin' ? '#fff' : '#818CF8'}
                    />
                    <View style={{ flexShrink: 1 }}>
                      <Text
                        style={[
                          styles.quickChipName,
                          adminUsername === 'admin' && styles.quickChipTextActive,
                        ]}>
                        HR Administrator
                      </Text>
                      <Text
                        style={[
                          styles.quickChipSub,
                          adminUsername === 'admin' && styles.quickChipSubActive,
                        ]}>
                        admin • admin123
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
                <Text style={styles.quickHint}>Default credentials: admin / admin123</Text>
              </View>

              <Text style={styles.inputLabel}>USERNAME</Text>
              <TextInput
                style={styles.input}
                placeholder="admin"
                placeholderTextColor={COLORS.textDim}
                value={adminUsername}
                onChangeText={setAdminUsername}
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>PASSWORD</Text>
              <TextInput
                style={styles.input}
                placeholder="admin123"
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="lock-open-outline" size={16} color="#fff" />
                    <Text style={styles.loginButtonText}>Unlock HR Dashboard</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Corporate Shift Overview Footer */}
        <View style={styles.timetablePreview}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Ionicons name="business-outline" size={14} color="#94A3B8" />
            <Text style={styles.timetableTitle}>CORPORATE SHIFT (09:00 AM – 06:00 PM)</Text>
          </View>
          <Text style={styles.timetableRow}>• Standard Work Shift: 9.0 Hours (incl. 1 Hr Lunch)</Text>
          <Text style={[styles.timetableRow, { color: COLORS.accentAmber }]}>• Flexible Lunch / Tea Break Tracking</Text>
          <Text style={styles.timetableRow}>• Overtime auto-calculated when Net Hours &gt; 8.0 hrs</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
            <Ionicons name="shield-checkmark-outline" size={13} color={COLORS.accentCyan} />
            <Text style={[styles.timetableRow, { color: COLORS.accentCyan, marginVertical: 0 }]}>
              128-d Biometric Scan + GPS Geofence + Mock GPS Protection
            </Text>
          </View>
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
                <Ionicons name="close" size={18} color={COLORS.textMuted} />
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
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Ionicons name="wifi-outline" size={15} color="#fff" />
                  <Text style={styles.saveServerBtnText}>Test & Connect Server</Text>
                </View>
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
    gap: 6,
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
  },
  serverPillText: {
    color: COLORS.textMuted,
    fontSize: 11,
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
    marginBottom: 16,
  },
  quickBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    marginBottom: 16,
  },
  quickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  quickTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.accentCyan,
    letterSpacing: 0.6,
  },
  quickChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.bgSurfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flex: 1,
    minWidth: 120,
  },
  quickChipActive: {
    borderColor: COLORS.accentCyan,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
  },
  quickChipActiveAdmin: {
    borderColor: '#818CF8',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  quickChipName: {
    color: '#fff',
    fontSize: 11.5,
    fontWeight: '700',
  },
  quickChipSub: {
    color: COLORS.textDim,
    fontSize: 9.5,
    marginTop: 1,
  },
  quickChipTextActive: {
    color: '#fff',
  },
  quickChipSubActive: {
    color: '#E2E8F0',
  },
  quickHint: {
    color: COLORS.textDim,
    fontSize: 10,
    marginTop: 6,
    fontStyle: 'italic',
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
    justifyContent: 'center',
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
    justifyContent: 'center',
  },
  saveServerBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
});
