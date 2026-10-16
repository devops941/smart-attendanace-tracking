import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../constants/theme';

export default function CheckInScreen({
  checkinSelfie,
  onOpenLiveCamera,
  currentPosition,
  isGpsLoading,
  onRefreshLocation,
  deviceId,
  nearestZone,
  scheduleInfo,
  onRefreshSchedule,
  currentUser,
  userRole,
  students,
  savedStudentId,
  onSelectStudent,
  onVerify,
  isVerifying,
}) {
  const currentPeriod = scheduleInfo?.current_period;
  const windowStatus = scheduleInfo?.window_status || 'LOADING';
  const canCheckIn = scheduleInfo?.can_check_in ?? false;
  const alert5Min = scheduleInfo?.alert_5_min_before ?? false;
  const minsUntilNext = scheduleInfo?.minutes_until_next ?? 0;
  const nextPeriod = scheduleInfo?.next_period;

  // Determine Window Badge Styling
  const getWindowBadge = () => {
    switch (windowStatus) {
      case 'OPEN_ON_TIME':
        return {
          bg: 'rgba(16, 185, 129, 0.15)',
          border: 'rgba(16, 185, 129, 0.35)',
          color: COLORS.accentEmerald,
          icon: '🟢',
          title: 'ON-TIME WINDOW (0 - 10 MINS)',
          subtitle: `${Math.round(scheduleInfo.minutes_remaining_in_window)}m left to mark attendance`,
        };
      case 'OPEN_LATE':
        return {
          bg: 'rgba(245, 158, 11, 0.15)',
          border: 'rgba(245, 158, 11, 0.35)',
          color: COLORS.accentAmber,
          icon: '🟡',
          title: `LATE ENTRY (${scheduleInfo.minutes_late || 0}M LATE)`,
          subtitle: `${Math.round(scheduleInfo.minutes_remaining_in_window)}m left before 30m lockout`,
        };
      case 'LOCKED_OUT':
        return {
          bg: 'rgba(244, 63, 94, 0.15)',
          border: 'rgba(244, 63, 94, 0.35)',
          color: COLORS.accentRose,
          icon: '🔴',
          title: 'ATTENDANCE CLOSED (> 30 MINS LATE)',
          subtitle: `Locked out of ${currentPeriod?.name || 'class'}. Join next class at ${nextPeriod?.start_time || 'next hour'}.`,
        };
      case 'LUNCH_BREAK':
        return {
          bg: 'rgba(56, 189, 248, 0.15)',
          border: 'rgba(56, 189, 248, 0.35)',
          color: COLORS.accentCyan,
          icon: '☕',
          title: 'COLLEGE LUNCH BREAK (1:00 PM - 2:00 PM)',
          subtitle: `Recess hour. Next class (${nextPeriod?.name || 'Period 5'}) starts at 02:00 PM.`,
        };
      case 'ALREADY_VERIFIED':
        return {
          bg: 'rgba(99, 102, 241, 0.15)',
          border: 'rgba(99, 102, 241, 0.35)',
          color: COLORS.primaryLight,
          icon: '✅',
          title: `ATTENDANCE VERIFIED (${currentPeriod?.name})`,
          subtitle: 'You are marked present for this hourly period.',
        };
      case 'BEFORE_COLLEGE':
        return {
          bg: 'rgba(255, 255, 255, 0.05)',
          border: 'rgba(255, 255, 255, 0.1)',
          color: COLORS.textMuted,
          icon: '⏳',
          title: 'COLLEGE OPENS AT 09:00 AM',
          subtitle: `Period 1 begins in ${Math.round(minsUntilNext)} mins`,
        };
      case 'COLLEGE_CLOSED':
        return {
          bg: 'rgba(255, 255, 255, 0.05)',
          border: 'rgba(255, 255, 255, 0.1)',
          color: COLORS.textMuted,
          icon: '🏁',
          title: 'COLLEGE COMPLETED FOR TODAY',
          subtitle: 'Academic hours (09:00 AM - 05:00 PM) have ended.',
        };
      default:
        return {
          bg: 'rgba(255, 255, 255, 0.05)',
          border: 'rgba(255, 255, 255, 0.1)',
          color: COLORS.textMuted,
          icon: '⏱️',
          title: 'CHECKING TIMETABLE...',
          subtitle: 'Connecting to server schedule',
        };
    }
  };

  const badge = getWindowBadge();

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {/* 5-Minute Pre-Class Alert Banner */}
      {alert5Min && (
        <View style={styles.preClassAlert}>
          <Text style={{ fontSize: 20, marginRight: 10 }}>🔔</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.preClassTitle}>Upcoming Class Alert (Starts in {Math.round(minsUntilNext)}m)!</Text>
            <Text style={styles.preClassSub}>
              {nextPeriod ? `${nextPeriod.name} begins at ${nextPeriod.start_time}.` : 'Next period starts soon.'} Get ready inside the classroom boundary.
            </Text>
          </View>
        </View>
      )}

      {/* Hourly Timetable Schedule Card */}
      <View style={styles.scheduleCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={styles.scheduleHeaderLabel}>ACTIVE COLLEGE PERIOD</Text>
            <Text style={styles.periodName}>
              {currentPeriod ? `${currentPeriod.name} (${currentPeriod.start_time} - ${currentPeriod.end_time})` : 'College Recess / Outside Hours'}
            </Text>
          </View>
          <TouchableOpacity onPress={onRefreshSchedule} style={styles.refreshScheduleBtn}>
            <Text style={styles.refreshScheduleText}>Sync ↻</Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Status Badge */}
        <View style={[styles.windowBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
          <Text style={{ fontSize: 18, marginRight: 8 }}>{badge.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.windowBadgeTitle, { color: badge.color }]}>{badge.title}</Text>
            <Text style={styles.windowBadgeSub}>{badge.subtitle}</Text>
          </View>
        </View>
      </View>

      {/* Camera Viewport or Snapshot Preview */}
      <View style={styles.cameraBox}>
        {checkinSelfie ? (
          <View style={{ flex: 1 }}>
            <Image source={{ uri: checkinSelfie.uri }} style={styles.previewImage} />
            <TouchableOpacity style={styles.retakeButton} onPress={onOpenLiveCamera}>
              <Text style={styles.retakeText}>🔄 Retake Live Selfie</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cameraPlaceholder}>
            <Text style={{ fontSize: 44, marginBottom: 8 }}>📷</Text>
            <Text style={styles.placeholderTitle}>Biometric Face Verification</Text>
            <Text style={styles.placeholderSub}>
              {canCheckIn
                ? 'Period attendance window is currently OPEN. Take your live selfie now.'
                : scheduleInfo?.message || 'Check-in is currently locked for this period.'}
            </Text>

            {canCheckIn ? (
              <TouchableOpacity style={styles.openCameraButton} onPress={onOpenLiveCamera}>
                <Text style={styles.openCameraText}>Open Live Camera</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.disabledCameraBox}>
                <Text style={styles.disabledCameraText}>
                  {windowStatus === 'LOCKED_OUT'
                    ? '🔒 Late by > 30 Mins (Join Next Class)'
                    : windowStatus === 'ALREADY_VERIFIED'
                    ? '✅ Already Verified For This Class'
                    : windowStatus === 'LUNCH_BREAK'
                    ? '☕ Lunch Break (1:00 PM - 2:00 PM)'
                    : '🔒 Attendance Closed'}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* GPS & Hardware Device Status Badges */}
      <View style={styles.statusRow}>
        <View style={styles.statusBadge}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.badgeLabel}>GPS LOCATION</Text>
            <TouchableOpacity onPress={onRefreshLocation}>
              <Text style={{ color: COLORS.accentCyan, fontSize: 10.5, fontWeight: 'bold' }}>
                {isGpsLoading ? '...' : 'Refresh ↻'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.badgeValue}>
            {currentPosition ? `${currentPosition.latitude.toFixed(4)}, ${currentPosition.longitude.toFixed(4)}` : 'Locking GPS...'}
          </Text>
        </View>

        <View style={styles.statusBadge}>
          <Text style={styles.badgeLabel}>HARDWARE DEVICE</Text>
          <Text style={[styles.badgeValue, { color: COLORS.accentCyan }]} numberOfLines={1}>
            {deviceId}
          </Text>
        </View>
      </View>

      {/* Classroom Geofence Proximity Banner */}
      <View style={styles.zoneBanner}>
        <View style={{ flex: 1 }}>
          <Text style={styles.zoneBannerTitle}>
            Classroom Geofence: {nearestZone ? nearestZone.name : 'Detecting...'}
          </Text>
          <Text
            style={[
              styles.zoneBannerSub,
              nearestZone && nearestZone.distance <= nearestZone.radius_meters
                ? { color: COLORS.accentEmerald }
                : { color: COLORS.accentRose },
            ]}>
            {nearestZone
              ? nearestZone.distance <= nearestZone.radius_meters
                ? `✅ Inside classroom (${nearestZone.distance}m / ${nearestZone.radius_meters}m radius)`
                : `❌ ${nearestZone.distance}m away (Outside ${nearestZone.radius_meters}m boundary)`
              : 'Syncing geofence boundaries...'}
          </Text>
        </View>
      </View>

      {/* Student Profile Info (If logged in as student, displays student badge) */}
      <View style={styles.studentInfoCard}>
        <Text style={styles.studentInfoLabel}>STUDENT ATTENDANCE TARGET</Text>
        <Text style={styles.studentInfoName}>
          {currentUser ? `${currentUser.name || currentUser.student_id} (${currentUser.student_id})` : savedStudentId || 'No Student Selected'}
        </Text>
      </View>

      {/* Submit Check-In Button */}
      <TouchableOpacity
        style={[
          styles.mainButton,
          (!checkinSelfie || !canCheckIn || isVerifying) && styles.mainButtonDisabled,
        ]}
        onPress={onVerify}
        disabled={!checkinSelfie || !canCheckIn || isVerifying}>
        {isVerifying ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.mainButtonText}>Verifying Face, GPS, Device & Timetable...</Text>
          </View>
        ) : (
          <Text style={styles.mainButtonText}>
            {!canCheckIn
              ? 'Attendance Locked'
              : !checkinSelfie
              ? 'Snap Selfie To Verify'
              : 'Verify & Mark Period Attendance'}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 18, paddingBottom: 34 },
  simulatorCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 14,
  },
  simulatorTitle: {
    color: COLORS.primaryLight,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  simulatorDesc: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  simActiveBadge: {
    backgroundColor: 'rgba(244, 63, 94, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.4)',
  },
  simActiveText: {
    color: COLORS.accentRose,
    fontSize: 9.5,
    fontWeight: 'bold',
  },
  simBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
  },
  simBtnRed: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderColor: 'rgba(244, 63, 94, 0.35)',
  },
  simBtnAmber: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  simBtnGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  simBtnBlue: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  simBtnReset: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  simBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  preClassAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  preClassTitle: { color: COLORS.accentAmber, fontWeight: 'bold', fontSize: 13 },
  preClassSub: { color: COLORS.textMuted, fontSize: 11.5, marginTop: 2 },
  scheduleCard: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  scheduleHeaderLabel: {
    color: COLORS.textDim,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  periodName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
  refreshScheduleBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  refreshScheduleText: {
    color: COLORS.accentCyan,
    fontSize: 11,
    fontWeight: 'bold',
  },
  windowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
  },
  windowBadgeTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  windowBadgeSub: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  cameraBox: {
    width: '100%',
    height: 270,
    backgroundColor: '#000',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 14,
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bgSurface,
    padding: 20,
  },
  placeholderTitle: { color: COLORS.textMain, fontSize: 16, fontWeight: 'bold' },
  placeholderSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 4, textAlign: 'center', maxWidth: 280 },
  openCameraButton: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 10,
  },
  openCameraText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  disabledCameraBox: {
    marginTop: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  disabledCameraText: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: '700',
  },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  retakeButton: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  retakeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  statusRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statusBadge: {
    flex: 1,
    backgroundColor: COLORS.bgSurface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  badgeLabel: { color: COLORS.textMuted, fontSize: 9.5, fontWeight: '600', letterSpacing: 0.5 },
  badgeValue: { color: COLORS.textMain, fontSize: 12, fontWeight: 'bold', marginTop: 2 },
  zoneBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bgSurface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  zoneBannerTitle: { color: COLORS.textMain, fontSize: 13, fontWeight: 'bold' },
  zoneBannerSub: { fontSize: 11, marginTop: 2 },
  studentInfoCard: {
    backgroundColor: COLORS.bgSurface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  studentInfoLabel: {
    color: COLORS.textDim,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  studentInfoName: {
    color: COLORS.primaryLight,
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  mainButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainButtonDisabled: {
    opacity: 0.45,
    backgroundColor: '#374151',
  },
  mainButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
});
