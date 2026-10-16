import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { COLORS } from '../constants/theme';

export default function Header({ isOnline = true, currentUser, userRole, onLogout }) {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <View style={styles.brandIcon}>
          <Text style={{ fontSize: 18 }}>📍</Text>
        </View>
        <View>
          <Text style={styles.brandTitle}>Smart Attendance</Text>
          <Text style={styles.brandSubtitle}>
            {userRole === 'admin'
              ? '🏛️ Faculty / Admin Portal'
              : currentUser
              ? `🎓 ${currentUser.name || currentUser.student_id}`
              : '8-Hr Timetable & Biometrics'}
          </Text>
        </View>
      </View>

      <View style={styles.rightActions}>
        <View style={[styles.serverPill, !isOnline && styles.serverPillOffline]}>
          <View style={[styles.liveDot, !isOnline && styles.liveDotOffline]} />
          <Text style={[styles.serverPillText, !isOnline && styles.serverPillTextOffline]}>
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </Text>
        </View>

        {currentUser && (
          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
            <Text style={styles.logoutText}>Logout 🚪</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bgBase,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  brandIcon: {
    width: 36,
    height: 36,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: { color: COLORS.textMain, fontSize: 15, fontWeight: 'bold' },
  brandSubtitle: { color: COLORS.textMuted, fontSize: 11, marginTop: 1 },
  rightActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  serverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16,185,129,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  serverPillOffline: {
    backgroundColor: 'rgba(244,63,94,0.15)',
    borderColor: 'rgba(244,63,94,0.3)',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.accentEmerald },
  liveDotOffline: { backgroundColor: COLORS.accentRose },
  serverPillText: { color: COLORS.accentEmerald, fontSize: 10, fontWeight: 'bold' },
  serverPillTextOffline: { color: COLORS.accentRose },
  logoutBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  logoutText: {
    color: COLORS.textMuted,
    fontSize: 10.5,
    fontWeight: 'bold',
  },
});
