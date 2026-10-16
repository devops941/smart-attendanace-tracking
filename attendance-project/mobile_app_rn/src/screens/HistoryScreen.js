import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { COLORS } from '../constants/theme';

export default function HistoryScreen({
  serverUrl,
  userRole,
  currentUser,
  records,
  students,
}) {
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [dayHistory, setDayHistory] = useState(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(
    currentUser?.student_id || (students.length > 0 ? students[0].student_id : '')
  );
  const [viewMode, setViewMode] = useState(userRole === 'admin' ? 'audit' : 'student'); // 'student' | 'audit'

  useEffect(() => {
    if (selectedStudentId) {
      fetchDayHistory(selectedStudentId, selectedDate);
    }
  }, [selectedStudentId, selectedDate]);

  const fetchDayHistory = async (stuId, dateStr) => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(
        `${serverUrl}/api/attendance/student-day-history?student_id=${encodeURIComponent(
          stuId
        )}&date=${encodeURIComponent(dateStr)}`
      );
      if (res.ok) {
        const data = await res.json();
        setDayHistory(data);
      }
    } catch (err) {
      console.warn('Failed to fetch day history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleShiftDate = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const setDateToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const setDateYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {/* Admin Mode Toggle */}
      {userRole === 'admin' && (
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'student' && styles.toggleBtnActive]}
            onPress={() => setViewMode('student')}>
            <Text style={[styles.toggleText, viewMode === 'student' && styles.toggleTextActive]}>
              📅 Day Attendance View
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'audit' && styles.toggleBtnActive]}
            onPress={() => setViewMode('audit')}>
            <Text style={[styles.toggleText, viewMode === 'audit' && styles.toggleTextActive]}>
              📑 Master Audit Logs
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* VIEW MODE 1: DAY ATTENDANCE TIMELINE */}
      {viewMode === 'student' && (
        <View>
          {/* Admin Student Switcher */}
          {userRole === 'admin' && students.length > 0 && (
            <View style={styles.studentSwitcher}>
              <Text style={styles.switcherLabel}>SELECT STUDENT TO INSPECT:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                {students.map((s) => (
                  <TouchableOpacity
                    key={s.student_id}
                    style={[
                      styles.studentChip,
                      selectedStudentId === s.student_id && styles.studentChipActive,
                    ]}
                    onPress={() => setSelectedStudentId(s.student_id)}>
                    <Text
                      style={[
                        styles.studentChipText,
                        selectedStudentId === s.student_id && styles.studentChipTextActive,
                      ]}>
                      {s.name} ({s.student_id})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Date Selector Navigation Bar */}
          <View style={styles.dateBar}>
            <View style={styles.dateNavButtons}>
              <TouchableOpacity style={styles.dateShiftBtn} onPress={() => handleShiftDate(-1)}>
                <Text style={styles.dateShiftText}>◀ Previous</Text>
              </TouchableOpacity>

              <Text style={styles.currentDateText}>{selectedDate}</Text>

              <TouchableOpacity style={styles.dateShiftBtn} onPress={() => handleShiftDate(1)}>
                <Text style={styles.dateShiftText}>Next ▶</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.quickPills}>
              <TouchableOpacity style={styles.quickPill} onPress={setDateToday}>
                <Text style={styles.quickPillText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickPill} onPress={setDateYesterday}>
                <Text style={styles.quickPillText}>Yesterday</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Day Scoreboard Summary Card */}
          {isLoadingHistory ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={COLORS.primaryLight} size="large" />
              <Text style={styles.loadingText}>Computing Day Attendance...</Text>
            </View>
          ) : dayHistory ? (
            <View>
              <View style={styles.scoreCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={styles.scoreCardLabel}>HOURLY ATTENDANCE SCORE</Text>
                    <Text style={styles.scoreCardMain}>
                      {dayHistory.attended_count} / {dayHistory.total_periods} Hours Attended
                    </Text>
                  </View>
                  <View style={styles.percentBadge}>
                    <Text style={styles.percentText}>{dayHistory.attendance_percentage}%</Text>
                  </View>
                </View>

                {/* Visual Progress Bar */}
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${dayHistory.attendance_percentage}%` },
                      dayHistory.attendance_percentage >= 75
                        ? { backgroundColor: COLORS.accentEmerald }
                        : dayHistory.attendance_percentage >= 50
                        ? { backgroundColor: COLORS.accentAmber }
                        : { backgroundColor: COLORS.accentRose },
                    ]}
                  />
                </View>

                {/* Score Breakdown Pills */}
                <View style={styles.breakdownRow}>
                  <View style={[styles.kpiPill, { borderColor: 'rgba(16,185,129,0.3)' }]}>
                    <Text style={[styles.kpiValue, { color: COLORS.accentEmerald }]}>
                      {dayHistory.on_time_count}
                    </Text>
                    <Text style={styles.kpiLabel}>On-Time</Text>
                  </View>
                  <View style={[styles.kpiPill, { borderColor: 'rgba(245,158,11,0.3)' }]}>
                    <Text style={[styles.kpiValue, { color: COLORS.accentAmber }]}>
                      {dayHistory.late_count}
                    </Text>
                    <Text style={styles.kpiLabel}>Late (&lt;30m)</Text>
                  </View>
                  <View style={[styles.kpiPill, { borderColor: 'rgba(244,63,94,0.3)' }]}>
                    <Text style={[styles.kpiValue, { color: COLORS.accentRose }]}>
                      {dayHistory.missed_count}
                    </Text>
                    <Text style={styles.kpiLabel}>Missed / Locked</Text>
                  </View>
                </View>
              </View>

              {/* 8-Hour Timetable Breakdown */}
              <Text style={styles.timelineSectionTitle}>Period Breakdown (8-Hour Campus Schedule)</Text>
              {dayHistory.timeline.map((item, idx) => {
                const isBreak = item.is_break;
                const isPresent = item.status === 'ON_TIME';
                const isLate = item.status === 'LATE';
                const isMissed = item.status === 'MISSED' || item.status === 'LOCKED_OUT';

                let cardBorder = COLORS.border;
                let badgeColor = COLORS.textMuted;
                let badgeBg = 'rgba(255,255,255,0.05)';

                if (isBreak) {
                  badgeColor = COLORS.accentCyan;
                  badgeBg = 'rgba(56,189,248,0.15)';
                } else if (isPresent) {
                  cardBorder = COLORS.accentEmerald;
                  badgeColor = COLORS.accentEmerald;
                  badgeBg = 'rgba(16,185,129,0.15)';
                } else if (isLate) {
                  cardBorder = COLORS.accentAmber;
                  badgeColor = COLORS.accentAmber;
                  badgeBg = 'rgba(245,158,11,0.15)';
                } else if (isMissed) {
                  cardBorder = COLORS.accentRose;
                  badgeColor = COLORS.accentRose;
                  badgeBg = 'rgba(244,63,94,0.15)';
                }

                return (
                  <View
                    key={idx}
                    style={[
                      styles.periodCard,
                      { borderLeftColor: isBreak ? COLORS.accentCyan : cardBorder },
                    ]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 16 }}>
                          {isBreak ? '☕' : isPresent ? '🟢' : isLate ? '🟡' : isMissed ? '🔴' : '⏳'}
                        </Text>
                        <View>
                          <Text style={styles.periodCardName}>{item.name}</Text>
                          <Text style={styles.periodCardTime}>
                            {item.start_time} - {item.end_time}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.periodStatusTag, { backgroundColor: badgeBg }]}>
                        <Text style={[styles.periodStatusText, { color: badgeColor }]}>
                          {item.status_label}
                        </Text>
                      </View>
                    </View>

                    {item.timestamp && (
                      <Text style={styles.verifiedTimestamp}>
                        Verified at: {item.timestamp}
                        {item.minutes_late > 0 ? ` (${item.minutes_late}m late)` : ' (On-Time)'}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={{ color: COLORS.textMuted, fontSize: 13, textAlign: 'center' }}>
                No attendance records for this date.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* VIEW MODE 2: MASTER AUDIT LOGS (Admin / Faculty) */}
      {viewMode === 'audit' && (
        <View>
          <Text style={styles.timelineSectionTitle}>Master Verification Audit Trail ({records.length})</Text>
          {records.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={{ color: COLORS.textMuted, fontSize: 13, textAlign: 'center' }}>
                No attendance logs found on server.
              </Text>
            </View>
          ) : (
            records.map((r, i) => {
              const isPass = r.status === 'SUCCESS';
              return (
                <View key={i} style={[styles.auditCard, isPass ? styles.auditPass : styles.auditFail]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13.5 }}>
                      {r.student_name}
                    </Text>
                    <View style={[styles.auditTag, isPass ? styles.tagPass : styles.tagFail]}>
                      <Text style={[styles.tagText, isPass ? { color: COLORS.accentEmerald } : { color: COLORS.accentRose }]}>
                        {r.arrival_status || r.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 2 }}>
                    {r.student_id} • {r.period_name || 'Period'} • {r.timestamp}
                  </Text>
                  <View style={styles.metricsRow}>
                    <Text style={styles.metricText}>
                      GPS: {r.distance_to_zone_meters != null ? `${r.distance_to_zone_meters}m` : 'N/A'}
                    </Text>
                    <Text style={styles.metricText}>
                      Face: {r.face_similarity_score != null ? `${r.face_similarity_score}%` : 'N/A'}
                    </Text>
                    <Text style={styles.metricText}>
                      PAD: {r.liveness_score != null ? `${r.liveness_score}%` : 'N/A'}
                    </Text>
                    <Text style={styles.metricText}>
                      Device: {r.device_verified ? 'OK' : 'Proxy'}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 18, paddingBottom: 34 },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgSurface,
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
  },
  toggleBtnActive: {
    backgroundColor: COLORS.primary,
  },
  toggleText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  studentSwitcher: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  switcherLabel: {
    color: COLORS.textDim,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  studentChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  studentChipActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: COLORS.primaryLight,
  },
  studentChipText: { color: COLORS.textMuted, fontSize: 11 },
  studentChipTextActive: { color: '#fff', fontWeight: 'bold' },
  dateBar: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  dateNavButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateShiftBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
  },
  dateShiftText: {
    color: COLORS.accentCyan,
    fontSize: 11.5,
    fontWeight: 'bold',
  },
  currentDateText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  quickPills: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  quickPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  quickPillText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  loadingBox: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 10,
  },
  scoreCard: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  scoreCardLabel: {
    color: COLORS.textDim,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scoreCardMain: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 2,
  },
  percentBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  percentText: {
    color: COLORS.primaryLight,
    fontWeight: '800',
    fontSize: 16,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 4,
    marginVertical: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiPill: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  kpiValue: { fontSize: 16, fontWeight: 'bold' },
  kpiLabel: { color: COLORS.textDim, fontSize: 10, marginTop: 1 },
  timelineSectionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  periodCard: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  periodCardName: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  periodCardTime: { color: COLORS.textDim, fontSize: 11, marginTop: 1 },
  periodStatusTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  periodStatusText: { fontSize: 10.5, fontWeight: '700' },
  verifiedTimestamp: {
    color: COLORS.textDim,
    fontSize: 10.5,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
  },
  auditCard: {
    backgroundColor: COLORS.bgSurface,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  auditPass: { borderLeftColor: COLORS.accentEmerald },
  auditFail: { borderLeftColor: COLORS.accentRose },
  auditTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagPass: { backgroundColor: 'rgba(16,185,129,0.15)' },
  tagFail: { backgroundColor: 'rgba(244,63,94,0.15)' },
  tagText: { fontSize: 10.5, fontWeight: 'bold' },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  metricText: { color: COLORS.textDim, fontSize: 10.5 },
  emptyCard: {
    backgroundColor: COLORS.bgSurface,
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});
