import React, { useState, useEffect } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function HistoryScreen({
  serverUrl,
  userRole,
  currentUser,
  records,
  employees,
  onRefreshHistory,
}) {
  const staffList = employees || [];
  const [officeTimesheets, setOfficeTimesheets] = useState([]);
  const [isLoadingTimesheets, setIsLoadingTimesheets] = useState(false);
  const [selectedEmpCode, setSelectedEmpCode] = useState(
    currentUser?.emp_code || (staffList.length > 0 ? staffList[0].emp_code : '')
  );
  const [viewMode, setViewMode] = useState('timesheets'); // 'timesheets' | 'audit'
  const handleDeleteTimesheetRecord = (id, empName, date) => {
    Alert.alert(
      'Delete Timesheet Record',
      `Permanently delete timesheet log #${id} for ${empName || 'Employee'} on ${date}?\n\nThis will remove the shift and its punch logs.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${serverUrl}/api/office/timesheets/${id}`, {
                method: 'DELETE',
                adminDeleteRecordBtn: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(244,63,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.25)',
  },
});
              const data = await res.json();
              if (res.ok) {
                setOfficeTimesheets((prev) => prev.filter((item) => item.id !== id));
                if (onRefreshHistory) onRefreshHistory();
              } else {
                Alert.alert('Delete Failed', data.detail || 'Could not delete timesheet record.');
              }
            } catch (err) {
              Alert.alert('Network Error', err.message);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAuditRecord = (id, name, timestamp) => {
    Alert.alert(
      'Delete Audit Record',
      `Delete raw verification audit log #${id} (${name || 'Staff Member'} - ${timestamp})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${serverUrl}/api/attendance/records/${id}`, {
                method: 'DELETE',
                adminDeleteRecordBtn: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(244,63,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.25)',
  },
});
              const data = await res.json();
              if (res.ok) {
                if (onRefreshHistory) onRefreshHistory();
              } else {
                Alert.alert('Delete Failed', data.detail || 'Could not delete audit record.');
              }
            } catch (err) {
              Alert.alert('Network Error', err.message);
            }
          },
        },
      ]
    );
  };


  useEffect(() => {
    fetchTimesheets();
  }, [selectedEmpCode, serverUrl]);

  const fetchTimesheets = async () => {
    setIsLoadingTimesheets(true);
    try {
      let url = `${serverUrl}/api/office/timesheets`;
      if (userRole !== 'admin' && selectedEmpCode) {
        url += `?emp_code=${encodeURIComponent(selectedEmpCode)}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setOfficeTimesheets(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Failed to fetch office timesheets:', err);
    } finally {
      setIsLoadingTimesheets(false);
    }
  };

  const formatIsoTime = (isoStr) => {
    if (!isoStr) return '--:--';
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch (_) {
      return isoStr.substring(11, 16) || isoStr;
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {/* Navigation Mode Bar */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, viewMode === 'timesheets' && styles.toggleBtnActive]}
          onPress={() => setViewMode('timesheets')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons
              name="briefcase-outline"
              size={14}
              color={viewMode === 'timesheets' ? '#fff' : COLORS.textMuted}
            />
            <Text style={[styles.toggleText, viewMode === 'timesheets' && styles.toggleTextActive]}>
              Work Timesheets
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleBtn, viewMode === 'audit' && styles.toggleBtnActive]}
          onPress={() => setViewMode('audit')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons
              name="shield-checkmark-outline"
              size={14}
              color={viewMode === 'audit' ? '#fff' : COLORS.textMuted}
            />
            <Text style={[styles.toggleText, viewMode === 'audit' && styles.toggleTextActive]}>
              Master Audits
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Admin Employee Filter Switcher */}
      {userRole === 'admin' && staffList.length > 0 && viewMode === 'timesheets' && (
        <View style={styles.employeeSwitcher}>
          <Text style={styles.switcherLabel}>FILTER BY EMPLOYEE:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
            <TouchableOpacity
              style={[
                styles.employeeChip,
                !selectedEmpCode && styles.employeeChipActive,
              ]}
              onPress={() => setSelectedEmpCode('')}>
              <Text
                style={[
                  styles.employeeChipText,
                  !selectedEmpCode && styles.employeeChipTextActive,
                ]}>
                All Staff
              </Text>
            </TouchableOpacity>
            {staffList.map((s) => {
              const code = s.emp_code || s.student_id;
              return (
                <TouchableOpacity
                  key={code}
                  style={[
                    styles.employeeChip,
                    selectedEmpCode === code && styles.employeeChipActive,
                  ]}
                  onPress={() => setSelectedEmpCode(code)}>
                  <Text
                    style={[
                      styles.employeeChipText,
                      selectedEmpCode === code && styles.employeeChipTextActive,
                    ]}>
                    {s.name} ({code})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* VIEW 1: CORPORATE WORK TIMESHEETS */}
      {viewMode === 'timesheets' && (
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={styles.timelineSectionTitle}>Daily Timesheet Logs ({officeTimesheets.length})</Text>
            <TouchableOpacity onPress={fetchTimesheets} style={styles.refreshPill}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="refresh" size={12} color={COLORS.accentCyan} />
                <Text style={{ color: COLORS.accentCyan, fontSize: 11.5, fontWeight: 'bold' }}>Refresh</Text>
              </View>
            </TouchableOpacity>
          </View>

          {isLoadingTimesheets ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={COLORS.accentCyan} size="large" />
              <Text style={styles.loadingText}>Loading Daily Timesheets...</Text>
            </View>
          ) : officeTimesheets.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="time-outline" size={38} color={COLORS.textMuted} style={{ alignSelf: 'center', marginBottom: 8 }} />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold', textAlign: 'center' }}>
                No Timesheet Records Found
              </Text>
              <Text style={{ color: COLORS.textMuted, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                Perform morning Clock-In from the Check-In tab inside the office geofence to record your shift.
              </Text>
            </View>
          ) : (
            officeTimesheets.map((t, idx) => {
              const isCompleted = t.clock_out_time !== null;
              const isLate = t.arrival_status === 'LATE';
              const isOvertime = t.is_overtime === 1;

              return (
                <View key={t.id || idx} style={styles.timesheetCard}>
                  {/* Header: Date + Status Badge */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ color: '#fff', fontSize: 14.5, fontWeight: 'bold' }}>
                        {t.date} {t.emp_name ? `• ${t.emp_name}` : ''}
                      </Text>
                      <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 1 }}>
                        {t.department || 'Operations'} • {t.emp_code}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {userRole === 'admin' && (
                        <TouchableOpacity
                          style={styles.adminDeleteRecordBtn}
                          onPress={() => handleDeleteTimesheetRecord(t.id, t.emp_name || t.emp_code, t.date)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="trash-outline" size={14} color={COLORS.accentRose} />
                        </TouchableOpacity>
                      )}

                      <View
                        style={[
                          styles.statusBadge,
                        isCompleted
                          ? { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: COLORS.accentEmerald }
                          : { backgroundColor: 'rgba(6,182,212,0.15)', borderColor: COLORS.accentCyan },
                        { flexDirection: 'row', alignItems: 'center', gap: 4 },
                      ]}>
                      <Ionicons
                        name={isCompleted ? 'checkmark-done' : 'radio-button-on'}
                        size={11}
                        color={isCompleted ? COLORS.accentEmerald : COLORS.accentCyan}
                      />
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: isCompleted ? COLORS.accentEmerald : COLORS.accentCyan },
                        ]}>
                        {isCompleted ? 'COMPLETED' : 'IN OFFICE'}
                      </Text>
                    </View>
                  </View>
                  </View>

                  {/* Working Hours Metric Highlight */}
                  <View style={styles.timesheetMetricsGrid}>
                    <View style={styles.timesheetMetricItem}>
                      <Text style={styles.timesheetMetricLabel}>NET WORK TIME</Text>
                      <Text style={[styles.timesheetMetricValue, { color: COLORS.accentEmerald }]}>
                        {t.net_work_hours ? `${Number(t.net_work_hours).toFixed(2)} hrs` : 'In Progress'}
                      </Text>
                    </View>

                    <View style={styles.timesheetMetricItem}>
                      <Text style={styles.timesheetMetricLabel}>BREAK DURATION</Text>
                      <Text style={[styles.timesheetMetricValue, { color: COLORS.accentAmber }]}>
                        {t.total_break_minutes || 0} mins
                      </Text>
                    </View>

                    <View style={styles.timesheetMetricItem}>
                      <Text style={styles.timesheetMetricLabel}>PUNCTUALITY</Text>
                      <Text
                        style={[
                          styles.timesheetMetricValue,
                          { color: isLate ? COLORS.accentAmber : COLORS.accentCyan },
                        ]}>
                        {isLate ? `Late (+${t.minutes_late}m)` : 'On-Time'}
                      </Text>
                    </View>
                  </View>

                  {/* Clock In / Out Timeline details */}
                  <View style={styles.timesheetTimeRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="sunny-outline" size={15} color={COLORS.accentCyan} />
                      <View>
                        <Text style={{ color: COLORS.textMuted, fontSize: 10 }}>CLOCK-IN</Text>
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
                          {formatIsoTime(t.clock_in_time)}
                        </Text>
                      </View>
                    </View>

                    <View style={{ height: 24, width: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="moon-outline" size={15} color={COLORS.primaryLight} />
                      <View>
                        <Text style={{ color: COLORS.textMuted, fontSize: 10 }}>CLOCK-OUT</Text>
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
                          {t.clock_out_time ? formatIsoTime(t.clock_out_time) : 'Active Inside'}
                        </Text>
                      </View>
                    </View>

                    {isOvertime && (
                      <>
                        <View style={{ height: 24, width: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="flash-outline" size={15} color={COLORS.accentAmber} />
                          <View>
                            <Text style={{ color: COLORS.accentAmber, fontSize: 10 }}>OVERTIME</Text>
                            <Text style={{ color: COLORS.accentAmber, fontSize: 12, fontWeight: 'bold' }}>
                              +{t.overtime_hours || 0} hrs
                            </Text>
                          </View>
                        </View>
                      </>
                    )}
                  </View>

                  {/* Geofence Branch Info */}
                  <View style={styles.timesheetFooter}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="location-outline" size={12} color={COLORS.textDim} />
                      <Text style={{ color: COLORS.textDim, fontSize: 10.5 }}>
                        {t.branch_name || t.clock_in_zone_name || 'Main Corporate HQ'}
                      </Text>
                    </View>
                    {t.audit_notes ? (
                      <Text style={{ color: COLORS.textDim, fontSize: 10.5, fontStyle: 'italic' }}>
                        {t.audit_notes}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {/* VIEW 2: MASTER AUDIT LOGS */}
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
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13.5, flex: 1 }}>
                      {r.name || r.emp_name || r.student_name || 'Staff Member'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {userRole === 'admin' && (
                        <TouchableOpacity
                          style={styles.adminDeleteRecordBtn}
                          onPress={() => handleDeleteAuditRecord(r.id, r.name || r.student_id, r.timestamp)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="trash-outline" size={13} color={COLORS.accentRose} />
                        </TouchableOpacity>
                      )}
                      <View style={[styles.auditTag, isPass ? styles.tagPass : styles.tagFail]}>
                      <Text style={[styles.tagText, { color: isPass ? COLORS.accentEmerald : COLORS.accentRose }]}>
                        {r.status}
                      </Text>
                    </View>
                  </View>
                  </View>

                  <Text style={{ color: COLORS.textMuted, fontSize: 11.5, marginTop: 2 }}>
                    ID: {r.emp_code || r.student_id} • {r.timestamp}
                  </Text>

                  <View style={styles.metricsRow}>
                    <Text style={styles.metricText}>
                      Match: <Text style={{ color: '#fff', fontWeight: 'bold' }}>{r.confidence_score}%</Text>
                    </Text>
                    <Text style={styles.metricText}>
                      Liveness: <Text style={{ color: '#fff', fontWeight: 'bold' }}>{r.liveness_score}%</Text>
                    </Text>
                    <Text style={styles.metricText}>
                      Device: <Text style={{ color: '#fff', fontWeight: 'bold' }}>{r.device_id || 'OK'}</Text>
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
  scrollContent: { padding: 18, paddingBottom: 35 },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgSurface,
    padding: 4,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toggleBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 8 },
  toggleBtnActive: { backgroundColor: COLORS.primary },
  toggleText: { color: COLORS.textMuted, fontSize: 12, fontWeight: 'bold' },
  toggleTextActive: { color: '#fff' },

  employeeSwitcher: {
    backgroundColor: COLORS.bgSurface,
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  switcherLabel: { color: COLORS.textDim, fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  employeeChip: {
    backgroundColor: COLORS.bgSurfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  employeeChipActive: {
    borderColor: COLORS.accentCyan,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
  },
  employeeChipText: { color: COLORS.textMuted, fontSize: 11.5 },
  employeeChipTextActive: { color: COLORS.accentCyan, fontWeight: 'bold' },

  timelineSectionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  refreshPill: {
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  // Corporate Timesheet Cards
  timesheetCard: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeText: { fontSize: 10.5, fontWeight: 'bold' },

  timesheetMetricsGrid: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgSurfaceElevated,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  timesheetMetricItem: {
    flex: 1,
    alignItems: 'center',
  },
  timesheetMetricLabel: {
    color: COLORS.textDim,
    fontSize: 9.5,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  timesheetMetricValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },

  timesheetTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  timesheetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },

  // Audits
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

  loadingBox: { padding: 30, alignItems: 'center' },
  loadingText: { color: COLORS.textMuted, fontSize: 12, marginTop: 8 },
  emptyCard: {
    backgroundColor: COLORS.bgSurface,
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  adminDeleteRecordBtn: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(244,63,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.25)',
  },
});
