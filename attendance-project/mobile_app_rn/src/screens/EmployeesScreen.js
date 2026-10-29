import React, { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';

export default function EmployeesScreen({
  regId,
  setRegId,
  regName,
  setRegName,
  regEmail,
  setRegEmail,
  regDept,
  setRegDept,
  regDesignation,
  setRegDesignation,
  regBranchId,
  setRegBranchId,
  branches,
  regPhoto,
  onOpenLiveCamera,
  onPickFromGallery,
  onUseSamplePhoto,
  onRegister,
  isRegistering,
  employees,
  serverUrl,
  onRefresh,
}) {
  const staffList = (employees || []).filter(
    (s) => s.is_active === undefined || s.is_active === 1 || s.is_active === true
  );
  const branchList = branches || [];

  const handleDeleteSingleEmployee = (empCode, name) => {
    if (!empCode) return;
    const cleanCode = empCode.trim();
    Alert.alert(
      'Delete Employee Account?',
      `Are you sure you want to permanently delete employee ${name || cleanCode} (${cleanCode})?\n\nThis will remove their profile, device binding, and all timesheets.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Permanently Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const base = (serverUrl || '').trim().replace(/\/+$/, '');
              const res = await fetch(`${base}/api/employees/${encodeURIComponent(cleanCode)}`, {
                method: 'DELETE',
                headers: { 'Accept': 'application/json' },
              });
              const data = await res.json().catch(() => ({}));
              if (res.ok) {
                Alert.alert('Employee Deleted', data.message || `Employee ${cleanCode} was removed.`);
                if (onRefresh) onRefresh();
              } else {
                Alert.alert('Delete Failed', data.detail || 'Could not delete employee record.');
              }
            } catch (err) {
              Alert.alert('Network Error', `Could not reach server: ${err.message}`);
            }
          },
        },
      ]
    );
  };

  const handleResetSingleEmployee = (empCode, name) => {
    if (!empCode) return;
    const cleanCode = empCode.trim();
    Alert.alert(
      'Reset User Punches?',
      `This will wipe all attendance punches, timesheets, and break logs for ${name || cleanCode} (${cleanCode}).\n\nThe employee account will remain active.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Punches',
          style: 'destructive',
          onPress: async () => {
            try {
              const base = (serverUrl || '').trim().replace(/\/+$/, '');
              const res = await fetch(`${base}/api/office/reset-employee-data/${encodeURIComponent(cleanCode)}`, {
                method: 'POST',
                headers: { 'Accept': 'application/json' },
              });
              const data = await res.json().catch(() => ({}));
              if (res.ok) {
                Alert.alert('Punches Reset', data.message || `Attendance data cleared for ${name || cleanCode}.`);
                if (onRefresh) onRefresh();
              } else {
                Alert.alert('Error', data.detail || 'Could not reset user punches.');
              }
            } catch (err) {
              Alert.alert('Network Error', `Could not reach server: ${err.message}`);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {/* Corporate Employee Enrollment Form */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>Enroll Corporate Employee</Text>
        <Text style={styles.helperText}>
          Enrolls an employee with 128-dimensional biometric facial embeddings and allocates their authorized office branch. Raw photos are NEVER stored (Zero-Storage Privacy Policy).
        </Text>

        <Text style={styles.fieldLabel}>Employee Code / ID *</Text>
        <TextInput
          style={styles.input}
          value={regId}
          onChangeText={setRegId}
          placeholder="Employee Code (e.g. EMP-101, EMP-102)"
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

        <Text style={styles.fieldLabel}>Corporate Email Address (Optional)</Text>
        <TextInput
          style={styles.input}
          value={regEmail}
          onChangeText={setRegEmail}
          placeholder="Work Email (e.g. name@company.com)"
          placeholderTextColor={COLORS.textDim}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        {/* Assigned Office Branch Selector */}
        <Text style={[styles.fieldLabel, { marginTop: 4 }]}>Assigned Office Branch * (Geofence Target)</Text>
        {branchList.length > 0 ? (
          <View style={{ marginBottom: 12 }}>
            {branchList.map((b) => {
              const isSelected = regBranchId === b.id || (!regBranchId && branchList[0].id === b.id);
              return (
                <TouchableOpacity
                  key={b.id}
                  style={[
                    styles.branchOption,
                    isSelected && styles.branchOptionSelected,
                  ]}
                  onPress={() => setRegBranchId && setRegBranchId(b.id)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="business-outline" size={14} color={isSelected ? COLORS.accentCyan : '#fff'} />
                      <Text style={[styles.branchOptionText, isSelected && styles.branchOptionTextSelected]}>
                        {b.name}
                      </Text>
                    </View>
                    {isSelected && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Ionicons name="checkmark-circle" size={13} color={COLORS.accentCyan} />
                        <Text style={{ color: COLORS.accentCyan, fontSize: 11, fontWeight: 'bold' }}>
                          Allocated
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.branchCoords}>
                    {b.latitude ? b.latitude.toFixed(4) : '--'}, {b.longitude ? b.longitude.toFixed(4) : '--'} • Radius: {b.radius_meters || 100}m
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.noBranchWarning}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="warning-outline" size={14} color={COLORS.accentAmber} />
              <Text style={{ color: COLORS.accentAmber, fontSize: 12 }}>
                No office branches found. Configure an office branch in Settings first.
              </Text>
            </View>
          </View>
        )}

        {/* Photo Box */}
        <Text style={[styles.fieldLabel, { marginTop: 4 }]}>Biometric Reference Face Photo *</Text>
        <TouchableOpacity
          style={styles.enrollPhotoBox}
          onPress={() => {
            Alert.alert(
              'Biometric Reference Photo',
              'Choose how to capture employee face photo:',
              [
                { text: 'Live Camera', onPress: onOpenLiveCamera },
                { text: 'Phone Gallery', onPress: onPickFromGallery },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}>
          {regPhoto ? (
            <View style={{ width: '100%', height: '100%', position: 'relative' }}>
              <Image source={{ uri: regPhoto.uri }} style={{ width: '100%', height: '100%', borderRadius: 12 }} />
              <View style={styles.retakeOverlay}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="camera-reverse-outline" size={14} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Tap to Change Photo</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Ionicons name="person-circle-outline" size={44} color={COLORS.accentCyan} style={{ marginBottom: 6 }} />
              <Text style={{ color: COLORS.accentCyan, fontSize: 13.5, fontWeight: 'bold' }}>
                Capture Employee Face Profile
              </Text>
              <Text style={{ color: COLORS.textDim, fontSize: 11, marginTop: 4 }}>
                Frontal portrait in good lighting (Camera or Gallery)
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Action Buttons: Live Camera or Mobile Gallery */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: COLORS.accentCyan }]} onPress={onOpenLiveCamera}>
            <Ionicons name="camera-outline" size={20} color={COLORS.accentCyan} style={{ marginBottom: 3 }} />
            <Text style={{ color: COLORS.accentCyan, fontSize: 12, fontWeight: 'bold' }}>Take Live Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, { borderColor: COLORS.primary }]} onPress={onPickFromGallery}>
            <Ionicons name="images-outline" size={20} color={COLORS.primaryLight} style={{ marginBottom: 3 }} />
            <Text style={{ color: COLORS.primaryLight, fontSize: 12, fontWeight: 'bold' }}>Upload From Gallery</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.mainButton} onPress={onRegister} disabled={isRegistering}>
          {isRegistering ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.mainButtonText}>Extracting 128-d Biometrics...</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="person-add-outline" size={17} color="#fff" />
              <Text style={styles.mainButtonText}>Save & Allocate Employee Profile</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Enrolled Staff Directory */}
      <Text style={[styles.cardHeader, { marginTop: 16, marginBottom: 8 }]}>
        Enrolled Staff Directory ({staffList.length})
      </Text>
      {staffList.map((s) => {
        const code = s.emp_code || s.student_id;
        const branchTitle = s.branch_name || (s.branch_id ? `Branch #${s.branch_id}` : 'Corporate Branch');
        return (
          <View key={code} style={styles.employeeCardWrapper}>
            <View style={styles.employeeItem}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>{s.name}</Text>
                <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 2 }}>
                  {s.department || 'Operations'} • ID: {code}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                  <Ionicons name="business-outline" size={12} color={COLORS.accentCyan} />
                  <Text style={{ color: COLORS.accentCyan, fontSize: 11 }}>
                    {branchTitle}
                  </Text>
                </View>
              </View>
              <Text style={styles.deviceChip}>{s.device_id || 'BOUND'}</Text>
            </View>

            {/* Admin Management Row: Reset Single User Data & Delete Single User */}
            <View style={styles.adminActionRow}>
              <TouchableOpacity
                style={styles.adminResetBtn}
                onPress={() => handleResetSingleEmployee(code, s.name)}>
                <Ionicons name="refresh-outline" size={13} color={COLORS.accentAmber} />
                <Text style={styles.adminResetText}>Reset Punches</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.adminDeleteBtn}
                onPress={() => handleDeleteSingleEmployee(code, s.name)}>
                <Ionicons name="trash-outline" size={13} color={COLORS.accentRose} />
                <Text style={styles.adminDeleteText}>Delete User</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
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
  mainButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  mainButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  employeeItem: {
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
  branchOption: {
    backgroundColor: COLORS.bgSurfaceElevated,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 8,
  },
  branchOptionSelected: {
    borderColor: COLORS.accentCyan,
    backgroundColor: 'rgba(6,182,212,0.1)',
  },
  branchOptionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  branchOptionTextSelected: {
    color: COLORS.accentCyan,
    fontWeight: 'bold',
  },
  branchCoords: {
    color: COLORS.textDim,
    fontSize: 11,
    marginTop: 3,
  },
  noBranchWarning: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  employeeCardWrapper: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  adminActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  adminResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
  },
  adminResetText: {
    color: COLORS.accentAmber,
    fontSize: 11,
    fontWeight: 'bold',
  },
  adminDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(244,63,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.25)',
  },
  adminDeleteText: {
    color: COLORS.accentRose,
    fontSize: 11,
    fontWeight: 'bold',
  },
});
