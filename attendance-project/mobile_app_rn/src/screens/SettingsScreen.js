import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { IP_PRESETS } from '../constants/config';
import { COLORS } from '../constants/theme';
import {
  playLocationOffSound,
  playOutsideOfficeSound,
  playOfficeEnteredSound,
} from '../utils/soundHelper';

export default function SettingsScreen({
  serverUrl,
  setServerUrl,
  onTestConnection,
  deviceId,
  onSyncLocation,
  isSyncingZone,
  facultyPin,
  setFacultyPin,
  isFacultyUnlocked,
  setIsFacultyUnlocked,
  onResetApp,
  userRole,
}) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {/* Backend Server Configuration */}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Ionicons name="server-outline" size={17} color="#fff" />
          <Text style={styles.cardHeader}>Backend Server Configuration</Text>
        </View>
        <Text style={styles.helperText}>
          Enter the IP address of your FastAPI backend. Set to your PC's IP when testing on mobile.
        </Text>
        <TextInput
          style={styles.input}
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="http://10.165.124.96:8000"
          placeholderTextColor={COLORS.textDim}
        />
        <View style={styles.presetRow}>
          {IP_PRESETS.map((p, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.presetBtn, { borderColor: p.color }]}
              onPress={() => setServerUrl(p.url)}>
              <Text style={{ color: p.color, fontSize: 11.5, fontWeight: 'bold' }}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.mainButton} onPress={onTestConnection}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="wifi-outline" size={16} color="#fff" />
            <Text style={styles.mainButtonText}>Test Connection</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Office Branch Geofence Sync (HR Admin Protected) */}
      {userRole === 'admin' && (
      <View style={[styles.card, { marginTop: 16 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="business-outline" size={17} color="#fff" />
            <Text style={styles.cardHeader}>Office Branch Geofence Sync</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons
              name={isFacultyUnlocked ? 'lock-open-outline' : 'lock-closed-outline'}
              size={13}
              color={isFacultyUnlocked ? COLORS.accentEmerald : COLORS.accentAmber}
            />
            <Text
              style={{
                color: isFacultyUnlocked ? COLORS.accentEmerald : COLORS.accentAmber,
                fontSize: 11,
                fontWeight: 'bold',
              }}>
              {isFacultyUnlocked ? 'Admin Unlocked' : 'Admin Locked'}
            </Text>
          </View>
        </View>
        <Text style={styles.helperText}>
          Requires HR / Admin authorization. Enter passcode to center corporate office geofence boundary to your current GPS coordinates.
        </Text>
        {!isFacultyUnlocked ? (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Admin PIN (Default: 1234)"
              placeholderTextColor={COLORS.textDim}
              value={facultyPin}
              onChangeText={setFacultyPin}
              secureTextEntry
              keyboardType="numeric"
            />
            <TouchableOpacity
              style={styles.unlockBtn}
              onPress={() => {
                if (facultyPin === '1234' || facultyPin === 'admin123') {
                  setIsFacultyUnlocked(true);
                  Alert.alert('Admin Verified', 'Office Branch Geofence controls unlocked.');
                } else {
                  Alert.alert('Access Denied', 'Incorrect admin passcode.');
                }
              }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Unlock</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.mainButton, { backgroundColor: '#0EA5E9' }]}
            onPress={onSyncLocation}
            disabled={isSyncingZone}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="locate-outline" size={16} color="#fff" />
              <Text style={styles.mainButtonText}>Sync Office Geofence to My Location</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
      )}

      {/* Hardware Signature Binding */}
      <View style={[styles.card, { marginTop: 16 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Ionicons name="finger-print-outline" size={17} color="#fff" />
          <Text style={styles.cardHeader}>Hardware Signature Binding</Text>
        </View>
        <Text style={styles.helperText}>
          This unique identifier locks attendance verification to your personal smartphone:
        </Text>
        <Text style={styles.monoDeviceText}>{deviceId}</Text>
      </View>

      {/* Location Notification Sound Preview & Settings */}
      <View style={[styles.card, { marginTop: 16 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Ionicons name="volume-high-outline" size={17} color="#fff" />
          <Text style={styles.cardHeader}>Location Alert Notification Sounds</Text>
        </View>
        <Text style={styles.helperText}>
          Audible warning chimes trigger automatically when GPS location is turned OFF or when moving outside your allocated office branch. Tap below to preview the sounds:
        </Text>
        <View style={{ gap: 8, marginTop: 8 }}>
          <TouchableOpacity
            style={[styles.soundBtn, { borderColor: '#F59E0B' }]}
            onPress={() => playLocationOffSound()}>
            <Ionicons name="warning-outline" size={20} color="#F59E0B" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#F59E0B', fontSize: 12.5, fontWeight: 'bold' }}>Play Location OFF Sound</Text>
              <Text style={{ color: COLORS.textDim, fontSize: 10.5 }}>Audible warning chime for disabled GPS</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="play" size={11} color="#F59E0B" />
              <Text style={{ color: '#F59E0B', fontSize: 11.5, fontWeight: 'bold' }}>Play</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.soundBtn, { borderColor: COLORS.accentRose }]}
            onPress={() => playOutsideOfficeSound()}>
            <Ionicons name="alert-circle-outline" size={20} color={COLORS.accentRose} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: COLORS.accentRose, fontSize: 12.5, fontWeight: 'bold' }}>Play Outside Office Sound</Text>
              <Text style={{ color: COLORS.textDim, fontSize: 10.5 }}>Triple-pulse boundary warning chime</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="play" size={11} color={COLORS.accentRose} />
              <Text style={{ color: COLORS.accentRose, fontSize: 11.5, fontWeight: 'bold' }}>Play</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.soundBtn, { borderColor: COLORS.accentEmerald }]}
            onPress={() => playOfficeEnteredSound()}>
            <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.accentEmerald} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: COLORS.accentEmerald, fontSize: 12.5, fontWeight: 'bold' }}>Play In-Office Sound</Text>
              <Text style={{ color: COLORS.textDim, fontSize: 10.5 }}>Ascending re-entry confirmation chime</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="play" size={11} color={COLORS.accentEmerald} />
              <Text style={{ color: COLORS.accentEmerald, fontSize: 11.5, fontWeight: 'bold' }}>Play</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Fresh Start: Reset All Data (Strictly HR Admin Only) */}
      {userRole === 'admin' && (
      <View style={[styles.card, { marginTop: 16, borderColor: 'rgba(244,63,94,0.35)' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Ionicons name="warning-outline" size={16} color={COLORS.accentRose} />
          <Text style={[styles.cardHeader, { color: COLORS.accentRose, marginBottom: 0 }]}>
            Fresh App & Database Reset
          </Text>
        </View>
        <Text style={styles.helperText}>
          Permanently wipes all attendance punches, break logs, and enrolled employee profiles. Restores a clean database with HR Admin (admin / admin123).
        </Text>
        <TouchableOpacity
          style={[styles.mainButton, { backgroundColor: '#DC2626' }]}
          onPress={() => {
            Alert.alert(
              'Reset to Fresh App?',
              'This will clear all employee profiles, punches, and timesheets.\n\nOnly the HR Admin (admin) account will be retained.\n\nAre you sure you want to start fresh?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Wipe & Reset Everything',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await fetch(`${serverUrl}/api/office/reset-system`, { method: 'POST' });
                      await AsyncStorage.clear();
                      Alert.alert(
                        'System Reset Complete',
                        'Database reset! All employee records wiped. Clean database ready with Admin (admin / admin123).'
                      );
                      if (onResetApp) onResetApp();
                    } catch (e) {
                      Alert.alert('Reset Error', e.message);
                    }
                  },
                },
              ]
            );
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="trash-outline" size={16} color="#fff" />
            <Text style={styles.mainButtonText}>Wipe Everything & Start Fresh</Text>
          </View>
        </TouchableOpacity>
      </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 18, paddingBottom: 30 },
  card: {
    backgroundColor: COLORS.bgSurface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  cardHeader: { color: COLORS.textMain, fontSize: 15, fontWeight: 'bold' },
  helperText: { color: COLORS.textMuted, fontSize: 11.5, lineHeight: 16, marginBottom: 12 },
  input: {
    backgroundColor: COLORS.bgSurfaceElevated,
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    fontSize: 13,
    marginBottom: 10,
  },
  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  presetBtn: {
    backgroundColor: COLORS.bgSurfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  unlockBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 10,
  },
  mainButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  mainButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  monoDeviceText: {
    fontFamily: 'monospace',
    color: COLORS.accentCyan,
    fontSize: 13,
    backgroundColor: COLORS.bgSurfaceElevated,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.3)',
  },
  soundBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.bgSurfaceElevated,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
});
