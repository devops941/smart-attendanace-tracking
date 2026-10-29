import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { COLORS } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function LocationNotificationBanner({
  notification,
  onDismiss,
  onRefreshGps,
  isGpsLoading = false,
}) {
  const slideAnim = useRef(new Animated.Value(-120)).current;

  useEffect(() => {
    if (notification) {
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -120,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [notification]);

  if (!notification) return null;

  const isGpsOff = notification.type === 'gps_off';
  const isOutside = notification.type === 'outside_office';
  const isBack = notification.type === 'back_in_office';

  const borderColor = isGpsOff
    ? '#F59E0B'
    : isOutside
    ? COLORS.accentRose
    : COLORS.accentEmerald;

  const bgColor = isGpsOff
    ? 'rgba(245, 158, 11, 0.14)'
    : isOutside
    ? 'rgba(244, 63, 94, 0.15)'
    : 'rgba(16, 185, 129, 0.15)';

  const badgeBg = isGpsOff
    ? '#F59E0B'
    : isOutside
    ? COLORS.accentRose
    : COLORS.accentEmerald;

  return (
    <Animated.View
      style={[
        styles.bannerWrapper,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}>
      <View
        style={[
          styles.card,
          {
            borderColor,
            backgroundColor: bgColor,
          },
        ]}>
        <View style={styles.topRow}>
          <View style={styles.badgeContainer}>
            <View style={[styles.badge, { backgroundColor: badgeBg, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
              <Ionicons
                name={
                  isGpsOff
                    ? 'warning-outline'
                    : isOutside
                    ? 'alert-circle-outline'
                    : 'checkmark-circle-outline'
                }
                size={12}
                color="#fff"
              />
              <Text style={styles.badgeText}>
                {isGpsOff
                  ? 'GPS LOCATION OFF'
                  : isOutside
                  ? 'MOVED OUTSIDE OFFICE'
                  : 'IN OFFICE BRANCH'}
              </Text>
            </View>
            <Text style={styles.title}>{notification.title}</Text>
          </View>

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={styles.message}>{notification.message}</Text>

        {(isGpsOff || isOutside) && onRefreshGps && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor }]}
              onPress={onRefreshGps}
              disabled={isGpsLoading}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Ionicons name="locate-outline" size={14} color={borderColor} />
                <Text style={[styles.actionBtnText, { color: borderColor }]}>
                  {isGpsLoading ? 'Checking GPS Signal...' : 'Refresh GPS Location'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bannerWrapper: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 4,
    backgroundColor: 'transparent',
    zIndex: 9999,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  badgeContainer: {
    flex: 1,
    paddingRight: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    marginBottom: 5,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  title: {
    color: COLORS.textMain,
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: 'bold',
  },
  message: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  actionRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
});
