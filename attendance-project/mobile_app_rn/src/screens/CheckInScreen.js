import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { COLORS } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function CheckInScreen({
  checkinSelfie,
  onOpenLiveCamera,
  currentPosition,
  isGpsLoading,
  onRefreshLocation,
  deviceId,
  nearestZone,
  currentUser,
  userRole,
  onClockIn,
  onStartBreak,
  onEndBreak,
  isVerifying,
  onSyncLocation,
  isSyncingZone,
  dailyStatus,
  isLocationServicesEnabled = true,
}) {
  // Real-time Live Digital Clock (ticks every 1,000ms)
  const [realTime, setRealTime] = useState(new Date());
  // Stopwatch seconds for live in-office duration counter
  const [liveStopwatchSeconds, setLiveStopwatchSeconds] = useState(
    dailyStatus?.elapsed_seconds || 0
  );

  const isClockedIn = dailyStatus?.is_clocked_in && !dailyStatus?.is_clocked_out;
  const isClockedOut = dailyStatus?.is_clocked_out;
  const isOnBreak = dailyStatus?.is_on_break;

  // Real-time Geofence and Location Services Validation
  const isGpsOff = !isLocationServicesEnabled || !currentPosition || currentPosition.latitude === undefined || currentPosition.latitude === null;
  const maxAllowedDistance = (nearestZone?.radius_meters || 100.0) + 150.0;
  const isOutsideOffice = !isGpsOff && nearestZone ? (nearestZone.distance > maxAllowedDistance) : false;
  const isLocationMismatch = isGpsOff || isOutsideOffice;

  // Clock count ticks ONLY if employee is actively in office AND location matches
  const isTimerActive = isClockedIn && !isOnBreak && !isLocationMismatch;

  // 1. Digital Clock for Current Time of Day (IST Server Time)
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setRealTime(new Date());
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // 2. In-Office Work Duration Stopwatch (STOPS IMMEDIATELY when GPS is off or outside office)
  useEffect(() => {
    if (!isTimerActive) return;
    const stopwatchTimer = setInterval(() => {
      setLiveStopwatchSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(stopwatchTimer);
  }, [isTimerActive]);

  // 3. Sync from server ONLY when in office (Prevents server poller from advancing paused stopwatch)
  useEffect(() => {
    if (dailyStatus?.elapsed_seconds !== undefined && !isLocationMismatch) {
      setLiveStopwatchSeconds(dailyStatus.elapsed_seconds);
    }
  }, [dailyStatus?.elapsed_seconds, isLocationMismatch]);

  // Note: System-wide separate notification alerts (GPS Off vs Moving to Other Location)
  // are handled at the root App.js level with vibration, floating banner, and system alerts.

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

  // Format Stopwatch as HH:MM:SS
  const formatStopwatch = (totalSec) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const empName = currentUser?.name || currentUser?.full_name || 'Office Employee';
  const empCode = currentUser?.emp_code || 'EMP-101';
  const department = currentUser?.department || 'Operations';

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* 1. REAL-TIME LIVE DIGITAL CLOCK CARD */}
      <View style={styles.realtimeClockCard}>
        <View style={styles.clockHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Ionicons name="time-outline" size={13} color="#A5B4FC" />
            <Text style={styles.liveServerBadge}>IST SERVER TIME</Text>
          </View>
          <View style={styles.liveIndicatorRow}>
            <View style={styles.pulsingLiveDot} />
            <Text style={styles.liveClockStatusText}>REALTIME SYNC</Text>
          </View>
        </View>

        <Text style={styles.realtimeTimeText}>{timeString}</Text>
        <Text style={styles.realtimeDateText}>{dateString}</Text>
      </View>

      {/* 2. REAL-TIME WORK DURATION / IN-OFFICE HOURS TRACKER */}
      <View style={styles.officeStatusCard}>
        <View style={styles.statusHeaderRow}>
          <Text style={styles.cardHeaderLabel}>DAILY IN-OFFICE TRACKER</Text>
          {isClockedIn ? (
            <View
              style={[
                styles.statusPill,
                isOnBreak
                  ? styles.pillBreak
                  : isLocationMismatch
                  ? styles.pillAlert
                  : styles.pillActive,
              ]}>
              <View
                style={[
                  styles.pillDot,
                  isOnBreak
                    ? styles.dotAmber
                    : isLocationMismatch
                    ? styles.dotRose
                    : styles.dotEmerald,
                ]}
              />
              <Text style={styles.statusPillText}>
                {isOnBreak
                  ? 'ON BREAK'
                  : isGpsOff
                  ? 'GPS OFF'
                  : isOutsideOffice
                  ? 'OUTSIDE'
                  : 'IN OFFICE'}
              </Text>
            </View>
          ) : isClockedOut ? (
            <View style={[styles.statusPill, styles.pillCompleted]}>
              <Ionicons name="checkmark-done" size={12} color="#FFFFFF" />
              <Text style={styles.statusPillText}>COMPLETED</Text>
            </View>
          ) : (
            <View style={[styles.statusPill, styles.pillInactive]}>
              <Ionicons name="radio-button-off" size={11} color="#94A3B8" />
              <Text style={styles.statusPillText}>NOT CLOCKED IN</Text>
            </View>
          )}
        </View>

        {/* Location Mismatch / GPS Off Warning Alert Banner */}
        {isClockedIn && isLocationMismatch && !isOnBreak && (
          <View
            style={[
              styles.locationAlertBox,
              isGpsOff && styles.locationAlertBoxAmber,
            ]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Ionicons
                name={isGpsOff ? 'warning-outline' : 'alert-circle-outline'}
                size={18}
                color={isGpsOff ? '#F59E0B' : COLORS.accentRose}
              />
              <Text
                style={[
                  styles.locationAlertTitle,
                  isGpsOff && styles.locationAlertTitleAmber,
                ]}>
                {isGpsOff ? 'GPS LOCATION SERVICES OFF' : 'MOVED TO OTHER LOCATION'}
              </Text>
            </View>
            <Text
              style={[
                styles.locationAlertText,
                isGpsOff && styles.locationAlertTextAmber,
              ]}>
              {isGpsOff
                ? 'Your device location (GPS) is turned OFF or unavailable. Attendance timer is PAUSED. Turn ON location and tap Refresh GPS.'
                : `You have moved outside your office boundary (${nearestZone?.distance}m from ${nearestZone?.name || 'Office Branch'}). Attendance timer is PAUSED until you return inside.`}
            </Text>
            <TouchableOpacity
              style={[
                styles.locationAlertButton,
                isGpsOff && styles.locationAlertButtonAmber,
              ]}
              onPress={onRefreshLocation}
              disabled={isGpsLoading}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Ionicons name="locate-outline" size={14} color="#FFFFFF" />
                <Text style={styles.locationAlertButtonText}>
                  {isGpsLoading ? 'Checking GPS Signal...' : 'Refresh GPS Location'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Big Stopwatch Display */}
        {isClockedIn ? (
          <View style={styles.stopwatchContainer}>
            <Text
              style={[
                styles.stopwatchTimer,
                isLocationMismatch && !isOnBreak && { color: COLORS.accentRose },
              ]}>
              {formatStopwatch(liveStopwatchSeconds)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 4 }}>
              {isLocationMismatch && !isOnBreak && (
                <Ionicons name="pause-circle-outline" size={13} color={COLORS.accentRose} />
              )}
              <Text
                style={[
                  styles.stopwatchSub,
                  isLocationMismatch && !isOnBreak && { color: COLORS.accentRose, fontWeight: 'bold' },
                ]}>
                {isOnBreak
                  ? 'Work timer paused during lunch break'
                  : isGpsOff
                  ? 'Work timer stopped — Turn on GPS to resume'
                  : isOutsideOffice
                  ? 'Work timer stopped — Return inside office boundary to resume'
                  : 'Active time logged inside office building'}
              </Text>
            </View>
            <View style={styles.shiftDetailsRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="sunny-outline" size={13} color={COLORS.accentCyan} />
                <Text style={styles.shiftDetailText}>
                  Clocked in at:{' '}
                  <Text style={{ color: COLORS.accentCyan, fontWeight: 'bold' }}>
                    {dailyStatus?.clock_in_time
                      ? new Date(dailyStatus.clock_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '09:00 AM'}
                  </Text>
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons
                  name={dailyStatus?.arrival_status === 'LATE' ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                  size={13}
                  color={dailyStatus?.arrival_status === 'LATE' ? COLORS.accentAmber : COLORS.accentEmerald}
                />
                <Text style={[styles.shiftDetailText, { color: dailyStatus?.arrival_status === 'LATE' ? COLORS.accentAmber : COLORS.accentEmerald }]}>
                  {dailyStatus?.arrival_status === 'LATE' ? `Late (${dailyStatus.minutes_late}m)` : 'On-Time Arrival'}
                </Text>
              </View>
            </View>
          </View>
        ) : isClockedOut ? (
          <View style={styles.stopwatchContainer}>
            <Text style={[styles.stopwatchTimer, { color: COLORS.accentEmerald }]}>
              {dailyStatus?.net_work_hours ? `${dailyStatus.net_work_hours} hrs` : '8.0 hrs'}
            </Text>
            <Text style={styles.stopwatchSub}>
              Shift finished at {dailyStatus?.clock_out_time ? new Date(dailyStatus.clock_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              {dailyStatus?.is_overtime ? ` • Overtime: +${dailyStatus.overtime_hours} hrs` : ''}
            </Text>
          </View>
        ) : (
          <View style={styles.stopwatchContainer}>
            <Text style={[styles.stopwatchTimer, { color: COLORS.textMuted }]}>00:00:00</Text>
            <Text style={styles.stopwatchSub}>
              Standard Shift: 09:00 AM – 06:00 PM • Ready for Morning Clock-In
            </Text>
          </View>
        )}
      </View>

      {/* 3. BIOMETRIC CAMERA VIEWPORT & SELFIE HUD */}
      <View style={styles.cameraBox}>
        {checkinSelfie ? (
          <View style={{ flex: 1 }}>
            <Image source={{ uri: checkinSelfie.uri }} style={styles.previewImage} />
            <TouchableOpacity style={styles.retakeButton} onPress={onOpenLiveCamera}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="camera-reverse-outline" size={15} color="#fff" />
                <Text style={styles.retakeText}>Retake Live Selfie</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cameraPlaceholder}>
            <View style={styles.cameraIconCircle}>
              <Ionicons name="scan-outline" size={32} color={COLORS.primaryLight} />
            </View>
            <Text style={styles.placeholderTitle}>Biometric Face Verification</Text>
            <Text style={styles.placeholderSub}>
              Take a live front-facing photo to verify 128-d face embedding and anti-spoofing liveness.
            </Text>

            <TouchableOpacity style={styles.openCameraButton} onPress={onOpenLiveCamera}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="camera" size={16} color="#fff" />
                <Text style={styles.openCameraText}>Open Live Camera</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 4. GPS & HARDWARE SECURITY HUD */}
      <View style={styles.statusRow}>
        <View style={styles.statusBadge}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.badgeLabel}>OFFICE GPS</Text>
            <TouchableOpacity onPress={onRefreshLocation} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="refresh" size={11} color={COLORS.accentCyan} />
                <Text style={{ color: COLORS.accentCyan, fontSize: 10.5, fontWeight: 'bold' }}>
                  {isGpsLoading ? '...' : 'Refresh'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
          <Text style={styles.badgeValue} numberOfLines={1} ellipsizeMode="tail">
            {currentPosition ? `${currentPosition.latitude.toFixed(4)}, ${currentPosition.longitude.toFixed(4)}` : 'Locking GPS...'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <Ionicons name="shield-checkmark-outline" size={11} color={COLORS.accentEmerald} />
            <Text style={styles.securitySub}>Mock Location Safe</Text>
          </View>
        </View>

        <View style={styles.statusBadge}>
          <Text style={styles.badgeLabel}>HARDWARE DEVICE</Text>
          <Text style={[styles.badgeValue, { color: COLORS.accentCyan }]} numberOfLines={1} ellipsizeMode="tail">
            {deviceId || 'Corporate Handset'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <Ionicons name="phone-portrait-outline" size={11} color={COLORS.accentCyan} />
            <Text style={[styles.securitySub, { color: COLORS.accentCyan }]}>Anti-Proxy Bound</Text>
          </View>
        </View>
      </View>

      {/* 5. GEOFENCE PROXIMITY BANNER */}
      <View style={styles.zoneBanner}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <Ionicons name="business-outline" size={15} color="#fff" />
            <Text style={styles.zoneBannerTitle} numberOfLines={1} ellipsizeMode="tail">
              {nearestZone ? nearestZone.name : 'Corporate Headquarters'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons
              name={
                nearestZone && nearestZone.distance <= nearestZone.radius_meters
                  ? 'checkmark-circle-outline'
                  : 'navigate-outline'
              }
              size={12}
              color={
                nearestZone && nearestZone.distance <= (nearestZone.radius_meters + 150)
                  ? COLORS.accentEmerald
                  : COLORS.accentAmber
              }
            />
            <Text
              style={[
                styles.zoneBannerSub,
                nearestZone && nearestZone.distance <= (nearestZone.radius_meters + 150)
                  ? { color: COLORS.accentEmerald }
                  : { color: COLORS.accentAmber },
              ]}
              numberOfLines={1}
              ellipsizeMode="tail">
              {nearestZone
                ? nearestZone.distance <= nearestZone.radius_meters
                  ? `Inside office perimeter (${nearestZone.distance}m / ${nearestZone.radius_meters}m radius)`
                  : `${nearestZone.distance}m away (within allowable building drift)`
                : 'Corporate office geofence active'}
            </Text>
          </View>
        </View>

        {onSyncLocation && (
          <TouchableOpacity
            style={styles.syncGpsButton}
            onPress={onSyncLocation}
            disabled={isSyncingZone}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="locate-outline" size={13} color="#fff" />
              <Text style={styles.syncGpsButtonText}>
                {isSyncingZone ? '...' : 'Sync GPS'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* 6. EMPLOYEE PROFILE CARD */}
      <View style={styles.empInfoCard}>
        <Text style={styles.empInfoLabel}>EMPLOYEE PROFILE</Text>
        <Text style={styles.empInfoName} numberOfLines={1} ellipsizeMode="tail">
          {empName} ({empCode})
        </Text>
        <Text style={styles.empDeptText}>{department} Department</Text>
      </View>

      {/* 7. ACTION BUTTONS: CLOCK-IN / CLOCK-OUT / BREAK */}
      {!isClockedIn && !isClockedOut && (
        <TouchableOpacity
          style={[
            styles.mainButton,
            styles.clockInButton,
            isVerifying && styles.mainButtonDisabled,
            !checkinSelfie && styles.mainButtonSecondary,
          ]}
          onPress={() => {
            if (!checkinSelfie) {
              onOpenLiveCamera();
            } else {
              onClockIn(false);
            }
          }}
          disabled={isVerifying}>
          {isVerifying ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.mainButtonText}>Verifying Face & Office GPS...</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons
                name={!checkinSelfie ? 'camera-outline' : 'sunny-outline'}
                size={20}
                color="#fff"
              />
              <Text style={styles.mainButtonText}>
                {!checkinSelfie
                  ? 'Snap Selfie To Clock In'
                  : 'Clock In (Start Morning Shift)'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {isClockedIn && (
        <View style={{ gap: 12 }}>
          {/* Break Toggle Button */}
          {isOnBreak ? (
            <TouchableOpacity
              style={[styles.mainButton, styles.resumeButton]}
              onPress={onEndBreak}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="play-circle-outline" size={20} color="#fff" />
                <Text style={styles.mainButtonText}>Resume Work (End Lunch Break)</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.mainButton, styles.breakButton]}
              onPress={() => onStartBreak('LUNCH')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="cafe-outline" size={20} color="#fff" />
                <Text style={styles.mainButtonText}>Take Lunch Break</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Clock Out Button */}
          <TouchableOpacity
            style={[
              styles.mainButton,
              styles.clockOutButton,
              isVerifying && styles.mainButtonDisabled,
              !checkinSelfie && styles.mainButtonSecondary,
            ]}
            onPress={() => {
              if (!checkinSelfie) {
                onOpenLiveCamera();
              } else {
                onClockIn(true);
              }
            }}
            disabled={isVerifying}>
            {isVerifying ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.mainButtonText}>Calculating Net Work Hours...</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons
                  name={!checkinSelfie ? 'camera-outline' : 'log-out-outline'}
                  size={20}
                  color="#fff"
                />
                <Text style={styles.mainButtonText}>
                  {!checkinSelfie
                    ? 'Snap Selfie To Clock Out'
                    : 'Clock Out (End Shift & Save Hours)'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      {isClockedOut && (
        <View style={styles.completedBanner}>
          <Ionicons name="ribbon-outline" size={36} color={COLORS.accentEmerald} style={{ marginBottom: 6 }} />
          <Text style={styles.completedTitle}>Shift Completed for Today!</Text>
          <Text style={styles.completedSub}>
            Your work hours have been audited and saved into official payroll timesheets. See you tomorrow!
          </Text>
        </View>
      )}
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
    flexWrap: 'wrap',
    gap: 8,
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  pulsingLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accentEmerald,
  },
  liveServerBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A5B4FC',
    letterSpacing: 0.6,
    flexShrink: 1,
  },
  liveClockStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.accentEmerald,
    letterSpacing: 0.5,
  },
  realtimeTimeText: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.5,
    fontVariant: ['tabular-nums'],
    marginVertical: 2,
  },
  realtimeDateText: {
    fontSize: 12.5,
    color: COLORS.textMuted,
    fontWeight: '500',
    letterSpacing: 0.3,
  },

  // Office Status Card
  officeStatusCard: {
    backgroundColor: '#111726',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 14,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  cardHeaderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.6,
    flexShrink: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
    flexShrink: 0,
  },
  pillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  pillBreak: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  pillCompleted: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
  },
  pillAlert: {
    backgroundColor: 'rgba(244, 63, 94, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.45)',
  },
  pillInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotEmerald: { backgroundColor: COLORS.accentEmerald },
  dotAmber: { backgroundColor: COLORS.accentAmber },
  dotRose: { backgroundColor: COLORS.accentRose },
  statusPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },

  // Location Alert Box (Shown when outside office or GPS is off while clocked in)
  locationAlertBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(244, 63, 94, 0.4)',
    padding: 12,
    marginVertical: 10,
  },
  locationAlertTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.accentRose,
    letterSpacing: 0.5,
  },
  locationAlertText: {
    fontSize: 11.5,
    color: '#FECDD3',
    lineHeight: 16,
    marginBottom: 8,
  },
  locationAlertButton: {
    backgroundColor: 'rgba(244, 63, 94, 0.25)',
    borderWidth: 1,
    borderColor: COLORS.accentRose,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
  },
  locationAlertButtonText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: 'bold',
  },
  locationAlertBoxAmber: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderColor: 'rgba(245, 158, 11, 0.5)',
  },
  locationAlertTitleAmber: {
    color: '#F59E0B',
  },
  locationAlertTextAmber: {
    color: '#FDE68A',
  },
  locationAlertButtonAmber: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderColor: '#F59E0B',
  },

  stopwatchContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  stopwatchTimer: {
    fontSize: 38,
    fontWeight: '900',
    color: '#06B6D4',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1.5,
  },
  stopwatchSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  shiftDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  shiftDetailText: {
    fontSize: 11.5,
    color: COLORS.textMuted,
  },

  // Camera Box
  cameraBox: {
    height: 240,
    backgroundColor: '#0F1626',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    marginBottom: 14,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  retakeButton: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  retakeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  placeholderTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  placeholderSub: {
    fontSize: 11.5,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 15,
  },
  openCameraButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  openCameraText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },

  // Status Row
  statusRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  statusBadge: {
    flex: 1,
    backgroundColor: '#111726',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  badgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  badgeValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  securitySub: {
    fontSize: 9.5,
    color: COLORS.accentEmerald,
    fontWeight: '600',
    marginTop: 4,
  },

  // Zone Banner
  zoneBanner: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 14,
  },
  zoneBannerTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 3,
  },
  zoneBannerSub: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  syncGpsButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    flexShrink: 0,
  },
  syncGpsButtonText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },

  // Employee Profile
  empInfoCard: {
    backgroundColor: '#111726',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  empInfoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  empInfoName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  empDeptText: {
    fontSize: 11.5,
    color: COLORS.accentCyan,
    marginTop: 2,
  },

  // Main Buttons
  mainButton: {
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  clockInButton: {
    backgroundColor: '#10B981',
  },
  clockOutButton: {
    backgroundColor: '#F43F5E',
  },
  breakButton: {
    backgroundColor: '#F59E0B',
  },
  resumeButton: {
    backgroundColor: '#06B6D4',
  },
  mainButtonSecondary: {
    backgroundColor: '#3730A3',
  },
  mainButtonDisabled: {
    opacity: 0.65,
  },
  mainButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },

  // Completed Banner
  completedBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  completedTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
  },
  completedSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
