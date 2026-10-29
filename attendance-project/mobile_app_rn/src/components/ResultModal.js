import React from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

export default function ResultModal({ visible, result, onClose }) {
  if (!result) return null;
  const isPass = result.success;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Ionicons
            name={isPass ? 'checkmark-circle' : 'close-circle'}
            size={52}
            color={isPass ? COLORS.accentEmerald : COLORS.accentRose}
            style={{ alignSelf: 'center', marginBottom: 8 }}
          />
          <Text style={[styles.modalTitle, isPass ? { color: COLORS.accentEmerald } : { color: COLORS.accentRose }]}>
            {isPass ? 'ATTENDANCE CONFIRMED' : 'ATTENDANCE REJECTED'}
          </Text>
          <Text style={styles.modalMessage}>{result.message}</Text>

          {/* 4 Factor Diagnostic Badges */}
          {result.checks && (
            <View style={styles.factorsList}>
              <View style={[styles.factorItem, result.checks.device?.passed ? styles.factorPass : styles.factorFail]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="phone-portrait-outline" size={14} color={COLORS.textMain} />
                  <Text style={styles.factorLabel}>Device ID Binding:</Text>
                </View>
                <Text style={styles.factorVal}>{result.checks.device?.passed ? 'PASSED' : 'REJECTED'}</Text>
              </View>

              <View style={[styles.factorItem, result.checks.location?.passed ? styles.factorPass : styles.factorFail]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="location-outline" size={14} color={COLORS.textMain} />
                  <Text style={styles.factorLabel}>GPS Geofence Proximity:</Text>
                </View>
                <Text style={styles.factorVal}>
                  {result.checks.location?.passed
                    ? `PASSED (${result.checks.location.distance_meters}m)`
                    : 'OUTSIDE ZONE'}
                </Text>
              </View>

              <View style={[styles.factorItem, result.checks.face?.passed ? styles.factorPass : styles.factorFail]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="scan-outline" size={14} color={COLORS.textMain} />
                  <Text style={styles.factorLabel}>128-d Facial Biometrics:</Text>
                </View>
                <Text style={styles.factorVal}>
                  {result.checks.face?.passed
                    ? `MATCH (${result.checks.face.similarity_score}%)`
                    : `MISMATCH (${result.checks.face?.similarity_score ?? 0}%)`}
                </Text>
              </View>

              <View style={[styles.factorItem, result.checks.liveness?.passed ? styles.factorPass : styles.factorFail]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.textMain} />
                  <Text style={styles.factorLabel}>Anti-Spoofing Defense:</Text>
                </View>
                <Text style={styles.factorVal}>
                  {result.checks.liveness?.passed
                    ? `LIVE (${result.checks.liveness.score}%)`
                    : 'SPOOF FLAGGED'}
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
            <Text style={styles.modalCloseText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: COLORS.bgSurface,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: { fontSize: 17, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  modalMessage: { color: COLORS.textMuted, fontSize: 12.5, textAlign: 'center', marginBottom: 18 },
  factorsList: { gap: 8, marginBottom: 20 },
  factorItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  factorPass: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderColor: 'rgba(16,185,129,0.25)',
  },
  factorFail: {
    backgroundColor: 'rgba(244,63,94,0.1)',
    borderColor: 'rgba(244,63,94,0.25)',
  },
  factorLabel: { color: COLORS.textMain, fontSize: 12, fontWeight: 'bold' },
  factorVal: { color: COLORS.textMain, fontSize: 11.5, fontWeight: 'bold' },
  modalCloseBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
});
