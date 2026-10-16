import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { COLORS } from '../constants/theme';

export default function StudentsScreen({
  regId,
  setRegId,
  regName,
  setRegName,
  regEmail,
  setRegEmail,
  regPhoto,
  onOpenLiveCamera,
  onPickFromGallery,
  onUseSamplePhoto,
  onRegister,
  isRegistering,
  students,
}) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {/* Student Registration Form */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>Enroll Biometric Profile</Text>
        <Text style={styles.helperText}>
          Enrolls a student with 128-dimensional facial embeddings and binds this smartphone. Raw photos are NEVER stored (Zero-Storage Privacy Policy).
        </Text>

        <Text style={styles.fieldLabel}>Student ID / Roll Number *</Text>
        <TextInput
          style={styles.input}
          value={regId}
          onChangeText={setRegId}
          placeholder="Roll No. (e.g. STU-2026-001)"
          placeholderTextColor={COLORS.textDim}
          autoCapitalize="characters"
        />

        <Text style={styles.fieldLabel}>Full Name *</Text>
        <TextInput
          style={styles.input}
          value={regName}
          onChangeText={setRegName}
          placeholder="Full Name (e.g. Jordan Vance)"
          placeholderTextColor={COLORS.textDim}
        />

        <Text style={styles.fieldLabel}>Email Address (Optional)</Text>
        <TextInput
          style={styles.input}
          value={regEmail}
          onChangeText={setRegEmail}
          placeholder="Email Address"
          placeholderTextColor={COLORS.textDim}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        {/* Photo Box */}
        <Text style={[styles.fieldLabel, { marginTop: 4 }]}>Biometric Reference Photo *</Text>
        <TouchableOpacity
          style={styles.enrollPhotoBox}
          onPress={() => {
            Alert.alert(
              'Reference Face Photo',
              'Choose how to provide your enrollment face photo:',
              [
                { text: '📷 Live Camera', onPress: onOpenLiveCamera },
                { text: '🖼️ Phone Gallery', onPress: onPickFromGallery },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}>
          {regPhoto ? (
            <View style={{ width: '100%', height: '100%', position: 'relative' }}>
              <Image source={{ uri: regPhoto.uri }} style={{ width: '100%', height: '100%', borderRadius: 12 }} />
              <View style={styles.retakeOverlay}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>🔄 Tap to Change Photo</Text>
              </View>
            </View>
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 32, marginBottom: 6 }}>👤</Text>
              <Text style={{ color: COLORS.accentCyan, fontSize: 13.5, fontWeight: 'bold' }}>
                Add Enrollment Face Photo
              </Text>
              <Text style={{ color: COLORS.textDim, fontSize: 11, marginTop: 4 }}>
                Tap to choose from Gallery or Camera
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Action Buttons: Live Camera or Mobile Gallery */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: COLORS.accentCyan }]} onPress={onOpenLiveCamera}>
            <Text style={{ fontSize: 18, marginBottom: 2 }}>📷</Text>
            <Text style={{ color: COLORS.accentCyan, fontSize: 12, fontWeight: 'bold' }}>Take Live Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, { borderColor: COLORS.primary }]} onPress={onPickFromGallery}>
            <Text style={{ fontSize: 18, marginBottom: 2 }}>🖼️</Text>
            <Text style={{ color: COLORS.primaryLight, fontSize: 12, fontWeight: 'bold' }}>Upload From Gallery</Text>
          </TouchableOpacity>
        </View>

        {/* Sample Face Helper for Instant Testing */}
        <TouchableOpacity style={styles.sampleFaceBtn} onPress={onUseSamplePhoto}>
          <Text style={{ color: COLORS.textMuted, fontSize: 11.5 }}>⚡ Or test with sample verified face</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.mainButton} onPress={onRegister} disabled={isRegistering}>
          {isRegistering ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.mainButtonText}>Extracting 128-d Vector...</Text>
            </View>
          ) : (
            <Text style={styles.mainButtonText}>Save Biometric Profile</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Enrolled Students Directory */}
      <Text style={[styles.cardHeader, { marginTop: 16, marginBottom: 8 }]}>Enrolled Students ({students.length})</Text>
      {students.map((s) => (
        <View key={s.student_id} style={styles.studentItem}>
          <View>
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>{s.name}</Text>
            <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>ID: {s.student_id}</Text>
          </View>
          <Text style={styles.deviceChip}>{s.device_id}</Text>
        </View>
      ))}
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
  fieldLabel: { color: COLORS.textMuted, fontSize: 11.5, marginBottom: 4 },
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
  enrollPhotoBox: {
    height: 150,
    backgroundColor: COLORS.bgSurfaceElevated,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(6,182,212,0.4)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  retakeOverlay: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: COLORS.bgSurfaceElevated,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  sampleFaceBtn: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  mainButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  mainButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  studentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bgSurface,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  deviceChip: {
    color: COLORS.accentCyan,
    fontSize: 11,
    backgroundColor: 'rgba(6,182,212,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
});
