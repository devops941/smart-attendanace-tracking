import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

export default function Header({ isOnline = true, currentUser, userRole, onLogout }) {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <Image
          source={require('../../assets/icon.png')}
          style={[styles.brandIconImage, { width: 36, height: 36 }]}
          resizeMode="cover"
        />
        <View style={styles.brandTextContainer}>
          <Text style={styles.brandTitle} numberOfLines={1} ellipsizeMode="tail">
            Smart Office Attendance
          </Text>
          <View style={styles.subtitleRow}>
            <Ionicons
              name={userRole === 'admin' ? 'shield-checkmark-outline' : 'person-circle-outline'}
              size={12}
              color={COLORS.textMuted}
            />
            <Text style={styles.brandSubtitle} numberOfLines={1} ellipsizeMode="tail">
              {userRole === 'admin'
                ? 'HR Administrator Portal'
                : currentUser
                ? `${currentUser.name || currentUser.emp_code || 'Employee'} (${currentUser.department || 'Operations'})`
                : 'Work Hours & Biometrics'}
            </Text>
          </View>
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
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={onLogout}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="log-out-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.logoutText}>Logout</Text>
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
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  brandIconImage: {
    width: 36,
    height: 36,
    borderRadius: 9,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    backgroundColor: COLORS.bgSurfaceElevated,
  },
  brandTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  brandTitle: {
    color: COLORS.textMain,
    fontSize: 15,
    fontWeight: 'bold',
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  brandSubtitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    flexShrink: 1,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
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
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.accentEmerald,
  },
  liveDotOffline: {
    backgroundColor: COLORS.accentRose,
  },
  serverPillText: {
    color: COLORS.accentEmerald,
    fontSize: 10,
    fontWeight: 'bold',
  },
  serverPillTextOffline: {
    color: COLORS.accentRose,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 5,
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
