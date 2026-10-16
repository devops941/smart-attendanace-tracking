import React, { useState, useEffect } from 'react';
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
  onSyncLocation,
  isSyncingZone,
}) {
  // Real-time Live Digital Clock (ticks every 1,000ms)
  const [realTime, setRealTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setRealTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = realTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const dateString = realTime.toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const currentPeriod = scheduleInfo?.current_period;
  const windowStatus = scheduleInfo?.window_status || 'OPEN_ON_TIME';
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
          subtitle: scheduleInfo?.minutes_remaining_in_window > 0
            ? `${Math.round(scheduleInfo.minutes_remaining_in_window)}m remaining in priority window`
            : 'Mark your arrival for this active class period',
        };
      case 'OPEN_LATE':
      case 'LATE_ENTRY':
        return {
          bg: 'rgba(245, 158, 11, 0.15)',
          border: 'rgba(245, 158, 11, 0.35)',
          color: COLORS.accentAmber,
          icon: '🟡',
          title: `LATE ENTRY (${scheduleInfo?.minutes_late || 0}M ELAPSED)`,
          subtitle: 'Attendance permitted — arrival will be recorded with late flag',
        };
      case 'LUNCH_BREAK':
        return {
          bg: 'rgba(56, 189, 248, 0.15)',
          border: 'rgba(56, 189, 248, 0.35)',
          color: COLORS.accentCyan,
          icon: '☕',
          title: 'COLLEGE RECESS / LUNCH BREAK',
          subtitle: `Next period (${nextPeriod?.name || 'Period 5'}) starts at ${nextPeriod?.start_time || '02:00 PM'}`,
        };
      case 'ALREADY_VERIFIED':
        return {
          bg: 'rgba(99, 102, 241, 0.15)',
          border: 'rgba(99, 102, 241, 0.35)',
          color: COLORS.primaryLight,
          icon: '✅',
          title: `ATTENDANCE RECORDED (${currentPeriod?.name || 'Class'})`,
          subtitle: 'Verified present today. Tap below anytime to re-verify.',
        };
      case 'BEFORE_COLLEGE':
        return {
          bg: 'rgba(99, 102, 241, 0.12)',
          border: 'rgba(99, 102, 241, 0.3)',
          color: COLORS.primaryLight,
          icon: '⏳',
          title: 'EARLY CHECK-IN (COLLEGE OPENS AT 09:00 AM)',
          subtitle: `Period 1 begins in ${Math.round(minsUntilNext)} mins. Early check-in accepted.`,
        };
      case 'COLLEGE_CLOSED':
        return {
          bg: 'rgba(245, 158, 11, 0.12)',
          border: 'rgba(245, 158, 11, 0.3)',
          color: COLORS.accentAmber,
          icon: '🏁',
          title: 'EXTRA SESSION / AFTER-HOURS',
          subtitle: 'Scheduled periods completed (09:00 AM - 05:00 PM). Check-in enabled.',
        };
      default:
        return {
          bg: 'rgba(16, 185, 129, 0.12)',
          border: 'rgba(16, 185, 129, 0.3)',
          color: COLORS.accentEmerald,
          icon: '🟢',
          title: 'ATTENDANCE WINDOW ACTIVE',
          subtitle: scheduleInfo?.message || 'Biometric attendance verification ready',
        };
    }
  };

  const badge = getWindowBadge();

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* 1. REAL-TIME LIVE DIGITAL CLOCK CARD */}
      <View style={styles.realtimeClockCard}>
        <View style={styles.clockHeaderRow}>
          <View style={styles.liveIndicatorRow}>
            <View style={styles.pulsingLiveDot} />
            <Text style={styles.liveIndicatorText}>LIVE CLOCK (IST)</Text>
          </View>
          <TouchableOpacity onPress={onRefreshSchedule} style={styles.syncBtn}>
            <Text style={styles.syncBtnText}>Sync ↻</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.realtimeTimeText}>{timeString}</Text>
        <Text style={styles.realtimeDateText}>{dateString}</Text>
      </View>

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

      {/* 2. HOURLY TIMETABLE PERIOD CARD */}
      <View style={styles.scheduleCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.scheduleHeaderLabel}>SCHEDULED COLLEGE PERIOD</Text>
            <Text style={styles.periodName}>
              {currentPeriod
                ? `${currentPeriod.name} (${currentPeriod.start_time} - ${currentPeriod.end_time})`
                : 'Period 7 (16:00 - 17:00)'}
            </Text>
          </View>
        </View>

        {/* Dynamic Status Window Badge */}
        <View style={[styles.windowBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
          <Text style={{ fontSize: 18, marginRight: 8 }}>{badge.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.windowBadgeTitle, { color: badge.color }]}>{badge.title}</Text>
            <Text style={styles.windowBadgeSub}>{badge.subtitle}</Text>
          </View>
        </View>
      </View>

      {/* 3. CAMERA VIEWPORT OR SNAPSHOT PREVIEW */}
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
            <View style={styles.cameraIconCircle}>
              <Text style={{ fontSize: 34 }}>📷</Text>
            </View>
            <Text style={styles.placeholderTitle}>Biometric Face Verification</Text>
            <Text style={styles.placeholderSub}>
              Take a live selfie to verify facial biometrics and anti-spoofing liveness.
            </Text>

            <TouchableOpacity style={styles.openCameraButton} onPress={onOpenLiveCamera}>
              <Text style={styles.openCameraText}>📸 Open Live Camera</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 4. GPS & HARDWARE DEVICE STATUS BADGES */}
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
            {deviceId || 'Mobile Device'}
          </Text>
        </View>
      </View>

      {/* 5. CLASSROOM GEOFENCE PROXIMITY BANNER WITH ONE-TAP SYNC */}
      <View style={styles.zoneBanner}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.zoneBannerTitle}>
            Classroom: {nearestZone ? nearestZone.name : 'College Campus'}
          </Text>
          <Text
            style={[
              styles.zoneBannerSub,
              nearestZone && nearestZone.distance <= (nearestZone.radius_meters + 150)
                ? { color: COLORS.accentEmerald }
                : { color: COLORS.accentAmber },
            ]}>
            {nearestZone
              ? nearestZone.distance <= nearestZone.radius_meters
                ? `✅ Inside classroom (${nearestZone.distance}m / ${nearestZone.radius_meters}m boundary)`
                : `📍 ${nearestZone.distance}m away (within allowable drift tolerance)`
              : 'Classroom GPS boundary active'}
          </Text>
        </View>

        {onSyncLocation && (
          <TouchableOpacity
            style={styles.syncGpsButton}
            onPress={onSyncLocation}
            disabled={isSyncingZone}>
            <Text style={styles.syncGpsButtonText}>
              {isSyncingZone ? '...' : 'Sync GPS 📍'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 6. STUDENT PROFILE INFO */}
      <View style={styles.studentInfoCard}>
        <Text style={styles.studentInfoLabel}>STUDENT ATTENDANCE TARGET</Text>
        <Text style={styles.studentInfoName}>
          {currentUser
            ? `${currentUser.name || currentUser.student_id} (${currentUser.student_id})`
            : savedStudentId || 'Logged In Student'}
        </Text>
      </View>

      {/* 7. SUBMIT CHECK-IN BUTTON */}
      <TouchableOpacity
        style={[
          styles.mainButton,
          isVerifying && styles.mainButtonDisabled,
          !checkinSelfie && styles.mainButtonSecondary,
        ]}
        onPress={() => {
          if (!checkinSelfie) {
            onOpenLiveCamera();
          } else {
            onVerify();
          }
        }}
        disabled={isVerifying}>
        {isVerifying ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.mainButtonText}>Verifying Face, GPS, Device & Timetable...</Text>
          </View>
        ) : (
          <Text style={styles.mainButtonText}>
            {!checkinSelfie
              ? '📷 Snap Selfie To Mark Attendance'
              : '⚡ Verify & Mark Attendance Now'}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 18, paddingBottom: 36 },

  // Real-time Live Clock Card
  realtimeClockCard: {
    backgroundColor: '#0F1626',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    marginBottom: 14,
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  clockHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulsingLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accentEmerald,
  },
  liveIndicatorText: {
    color: COLORS.accentEmerald,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  syncBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  syncBtnText: {
    color: COLORS.accentCyan,
    fontSize: 10.5,
    fontWeight: '700',
  },
  realtimeTimeText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 1.5,
    fontVariant: ['tabular-nums'],
    marginVertical: 2,
  },
  realtimeDateText: {
    color: COLORS.textMuted,
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.3,
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
    fontSize: 15.5,
    fontWeight: 'bold',
    marginTop: 2,
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
    height: 260,
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
  cameraIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  placeholderTitle: { color: COLORS.textMain, fontSize: 15.5, fontWeight: 'bold' },
  placeholderSub: { color: COLORS.textMuted, fontSize: 11.5, marginTop: 4, textAlign: 'center', maxWidth: 280 },
  openCameraButton: {
    marginTop: 14,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  openCameraText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
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
  syncGpsButton: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  syncGpsButtonText: {
    color: COLORS.accentCyan,
    fontSize: 11,
    fontWeight: 'bold',
  },

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
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  mainButtonSecondary: {
    backgroundColor: '#374151',
  },
  mainButtonDisabled: {
    opacity: 0.6,
  },
  mainButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
});
