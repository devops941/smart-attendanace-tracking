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
import { IP_PRESETS } from '../constants/config';
import { COLORS } from '../constants/theme';

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
}) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {/* Backend Server Configuration */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>Backend Server Configuration</Text>
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
          <Text style={styles.mainButtonText}>Test Connection</Text>
        </TouchableOpacity>
      </View>

      {/* Classroom Geofence Sync (Faculty Protected) */}
      <View style={[styles.card, { marginTop: 16 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <Text style={styles.cardHeader}>Classroom Geofence Sync</Text>
          {isFacultyUnlocked ? (
            <Text style={{ color: COLORS.accentEmerald, fontSize: 11, fontWeight: 'bold' }}>👨‍🏫 Faculty Unlocked</Text>
          ) : (
            <Text style={{ color: COLORS.accentAmber, fontSize: 11, fontWeight: 'bold' }}>🔒 Faculty Locked</Text>
          )}
        </View>
        <Text style={styles.helperText}>
          Requires faculty authorization. Enter faculty passcode to center classroom GPS boundary to your location.
        </Text>
        {!isFacultyUnlocked ? (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Faculty PIN (Default: 1234)"
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
                  Alert.alert('Faculty Verified ✅', 'Classroom Geofence controls unlocked.');
                } else {
                  Alert.alert('Access Denied ❌', 'Incorrect faculty passcode.');
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
            <Text style={styles.mainButtonText}>📍 Sync Geofence to My Location</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Hardware Signature Binding */}
      <View style={[styles.card, { marginTop: 16 }]}>
        <Text style={styles.cardHeader}>Hardware Signature Binding</Text>
        <Text style={styles.helperText}>
          This unique identifier locks attendance verification to your personal smartphone:
        </Text>
        <Text style={styles.monoDeviceText}>{deviceId}</Text>
      </View>
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
  cardHeader: { color: COLORS.textMain, fontSize: 15, fontWeight: 'bold', marginBottom: 6 },
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
    marginTop: 4,
  },
  mainButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
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
});
