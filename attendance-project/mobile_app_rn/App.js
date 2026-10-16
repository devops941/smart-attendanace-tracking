import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import * as ImagePicker from 'expo-image-picker';
import { useCameraPermissions } from 'expo-camera';

// Constants & Theme
import { COLORS } from './src/constants/theme';
import {
  DEFAULT_URL,
  PREF_SERVER_URL,
  PREF_STUDENT_ID,
  PREF_AUTH_TOKEN,
  PREF_USER_ROLE,
  PREF_USER_INFO,
} from './src/constants/config';
import { appendPhotoToFormData } from './src/utils/api';

// Components
import Header from './src/components/Header';
import CameraModal from './src/components/CameraModal';
import ResultModal from './src/components/ResultModal';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import CheckInScreen from './src/screens/CheckInScreen';
import StudentsScreen from './src/screens/StudentsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';

export default function App() {
  // Authentication & Role State
  const [authToken, setAuthToken] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'student' | 'admin'
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // App Navigation & Backend State
  const [activeTab, setActiveTab] = useState('checkin'); // checkin | students | history | settings
  const [serverUrl, setServerUrl] = useState(DEFAULT_URL);
  const [isServerOnline, setIsServerOnline] = useState(true);
  const [savedStudentId, setSavedStudentId] = useState('');
  const [deviceId, setDeviceId] = useState('Detecting...');
  const [currentPosition, setCurrentPosition] = useState(null);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState([]);
  const [zones, setZones] = useState([]);
  const [isSyncingZone, setIsSyncingZone] = useState(false);

  // Timetable Schedule State
  const [scheduleInfo, setScheduleInfo] = useState(null);
  const prevAlertRef = useRef(false);

  // Camera & Verification
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraMode, setCameraMode] = useState('checkin'); // 'checkin' | 'enroll'
  const [checkinSelfie, setCheckinSelfie] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  // Registration Form
  const [regId, setRegId] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhoto, setRegPhoto] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);

  // Faculty Authentication (Settings)
  const [facultyPin, setFacultyPin] = useState('');
  const [isFacultyUnlocked, setIsFacultyUnlocked] = useState(false);

  // 1. Initial Load: Auth, Preferences, GPS, Device ID
  useEffect(() => {
    (async () => {
      try {
        const savedUrl = await AsyncStorage.getItem(PREF_SERVER_URL);
        let defaultHost = DEFAULT_URL;
        if (
          Platform.OS === 'web' &&
          typeof window !== 'undefined' &&
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ) {
          defaultHost = 'http://localhost:8000';
        }
        const urlToUse = savedUrl || defaultHost;
        setServerUrl(urlToUse);

        // Load Auth Session
        const token = await AsyncStorage.getItem(PREF_AUTH_TOKEN);
        const role = await AsyncStorage.getItem(PREF_USER_ROLE);
        const userStr = await AsyncStorage.getItem(PREF_USER_INFO);

        if (token && role && userStr) {
          setAuthToken(token);
          setUserRole(role);
          const parsedUser = JSON.parse(userStr);
          setCurrentUser(parsedUser);
          if (role === 'student' && parsedUser.student_id) {
            setSavedStudentId(parsedUser.student_id);
          }
        }

        const savedId = await AsyncStorage.getItem(PREF_STUDENT_ID);
        if (savedId && !savedStudentId) setSavedStudentId(savedId);

        let devSig = `${Device.brand || 'Device'}-${Device.modelName || 'Mobile'}-${Device.osBuildId || '9921'}`.replace(/\s+/g, '');
        if (devSig.length > 24) devSig = devSig.substring(0, 24);
        setDeviceId(devSig);

        await fetchLocation();
        refreshBackendData(urlToUse);
      } catch (err) {
        console.warn('Initialization error:', err);
      } finally {
        setIsAuthLoading(false);
      }
    })();
  }, []);

  // 2. Periodic Timetable Schedule Poller (every 15 seconds)
  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const stuId = currentUser?.student_id || savedStudentId || '';
        const url = `${serverUrl}/api/schedule/current${stuId ? `?student_id=${encodeURIComponent(stuId)}` : ''}`;
        const res = await fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (res) {
          setScheduleInfo(res);
          // Check for 5-minute pre-alert transition
          if (res.alert_5_min_before && !prevAlertRef.current && res.next_period) {
            prevAlertRef.current = true;
            Alert.alert(
              '🔔 Upcoming Class in 5 Minutes!',
              `${res.next_period.name} starts at ${res.next_period.start_time}.\nPlease prepare to verify your attendance within the classroom boundary.`
            );
          } else if (!res.alert_5_min_before) {
            prevAlertRef.current = false;
          }
        }
      } catch (_) {}
    };

    fetchSchedule();
    const timer = setInterval(fetchSchedule, 15000);
    return () => clearInterval(timer);
  }, [serverUrl, currentUser, savedStudentId]);

  const fetchLocation = async () => {
    setIsGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const lastLoc = await Location.getLastKnownPositionAsync({});
        if (lastLoc) setCurrentPosition(lastLoc.coords);

        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (loc) setCurrentPosition(loc.coords);
      }
    } catch (err) {
      console.warn('Location init warning:', err);
    } finally {
      setIsGpsLoading(false);
    }
  };

  const handleRefreshLocation = async () => {
    setIsGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is required for classroom geofence checking.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (loc) {
        setCurrentPosition(loc.coords);
        Alert.alert('GPS Updated 📍', `Lat: ${loc.coords.latitude.toFixed(5)}\nLon: ${loc.coords.longitude.toFixed(5)}`);
      }
    } catch (err) {
      Alert.alert('GPS Error', err.message);
    } finally {
      setIsGpsLoading(false);
    }
  };

  const refreshBackendData = async (urlToUse) => {
    const base = urlToUse || serverUrl;
    try {
      const res = await fetch(`${base}/api/health`).then((r) => r.json()).catch(() => null);
      setIsServerOnline(res?.status === 'online');

      const stuRes = await fetch(`${base}/api/students`).then((r) => r.json()).catch(() => []);
      if (Array.isArray(stuRes)) setStudents(stuRes);

      const recRes = await fetch(`${base}/api/attendance/records?limit=40`).then((r) => r.json()).catch(() => []);
      if (Array.isArray(recRes)) setRecords(recRes);

      const zoneRes = await fetch(`${base}/api/zones`).then((r) => r.json()).catch(() => []);
      if (Array.isArray(zoneRes)) setZones(zoneRes);
    } catch (_) {
      setIsServerOnline(false);
    }
  };

  // Auth Handlers
  const handleLoginSuccess = async ({ role, token, user }) => {
    setAuthToken(token);
    setUserRole(role);
    setCurrentUser(user);
    await AsyncStorage.setItem(PREF_AUTH_TOKEN, token);
    await AsyncStorage.setItem(PREF_USER_ROLE, role);
    await AsyncStorage.setItem(PREF_USER_INFO, JSON.stringify(user));

    if (role === 'student' && user?.student_id) {
      setSavedStudentId(user.student_id);
      await AsyncStorage.setItem(PREF_STUDENT_ID, user.student_id);
    }
    setActiveTab('checkin');
    refreshBackendData();
  };

  const handleLogout = async () => {
    Alert.alert('Confirm Logout', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem(PREF_AUTH_TOKEN);
          await AsyncStorage.removeItem(PREF_USER_ROLE);
          await AsyncStorage.removeItem(PREF_USER_INFO);
          setAuthToken(null);
          setUserRole(null);
          setCurrentUser(null);
        },
      },
    ]);
  };

  const handleTestConnection = async () => {
    try {
      const trimmedUrl = serverUrl.trim();
      await AsyncStorage.setItem(PREF_SERVER_URL, trimmedUrl);
      const res = await fetch(`${trimmedUrl}/api/health`, { timeout: 6000 });
      const data = await res.json();
      if (data.status === 'online') {
        setIsServerOnline(true);
        Alert.alert(
          'Connected! ✅',
          `FastAPI Server is online.\nFace Engine: ${data.face_engine_ready ? 'Ready' : 'Offline'}\nDB: ${data.database}`
        );
        refreshBackendData(trimmedUrl);
      } else {
        Alert.alert('Response Error', JSON.stringify(data));
      }
    } catch (err) {
      setIsServerOnline(false);
      Alert.alert(
        'Connection Failed',
        `Could not reach ${serverUrl}.\nEnsure phone and PC are on same Wi-Fi.\n\nError: ${err.message}`
      );
    }
  };

  // Haversine distance formula to classroom zones
  const getDistanceToZone = (zoneLat, zoneLon) => {
    if (!currentPosition) return null;
    const R = 6371000;
    const dLat = (zoneLat - currentPosition.latitude) * Math.PI / 180;
    const dLon = (zoneLon - currentPosition.longitude) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(currentPosition.latitude * Math.PI / 180) *
      Math.cos(zoneLat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  };

  const getNearestZone = () => {
    if (!currentPosition || zones.length === 0) return null;
    let nearest = null;
    let minD = Infinity;
    zones.forEach((z) => {
      const d = getDistanceToZone(z.latitude, z.longitude);
      if (d !== null && d < minD) {
        minD = d;
        nearest = { ...z, distance: d };
      }
    });
    return nearest;
  };

  const handleSyncCurrentLocationToZone = async () => {
    setIsSyncingZone(true);
    try {
      let lat = currentPosition?.latitude;
      let lon = currentPosition?.longitude;
      if (!lat || !lon) {
        const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCurrentPosition(fresh.coords);
        lat = fresh.coords.latitude;
        lon = fresh.coords.longitude;
      }

      const res = await fetch(`${serverUrl}/api/zones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          name: 'Classroom Boundary (Synced GPS)',
          latitude: lat,
          longitude: lon,
          radius_meters: 100.0,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        Alert.alert(
          'Classroom Zone Synced! 📍',
          `Boundary centered at your current GPS:\nLat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(5)}\nRadius: 100 meters.`
        );
        refreshBackendData();
      } else {
        Alert.alert('Zone Sync Failed', data.detail || 'Could not save classroom geofence zone.');
      }
    } catch (err) {
      Alert.alert('Zone Sync Error', err.message);
    } finally {
      setIsSyncingZone(false);
    }
  };

  // Open Camera
  const handleOpenLiveCamera = async (mode) => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Camera Permission Required', 'Camera access is required for biometric verification.');
        return;
      }
    }
    setCameraMode(mode);
    setIsCameraActive(true);
  };

  const handleCapturePhoto = (photo) => {
    if (cameraMode === 'enroll') {
      setRegPhoto(photo);
    } else {
      setCheckinSelfie(photo);
    }
    setIsCameraActive(false);
  };

  // Submit Check-In Verification
  const handleSubmitCheckIn = async () => {
    const studentToUse = currentUser?.student_id || savedStudentId.trim() || (students.length > 0 ? students[0].student_id : '');
    if (!studentToUse) {
      Alert.alert('Select Student', 'Please select or log in with your student account first.');
      return;
    }
    if (!checkinSelfie) {
      Alert.alert('Live Selfie Required', 'Please tap "Open Live Camera" to take your live verification selfie in class.');
      return;
    }

    setIsVerifying(true);
    try {
      let lat = currentPosition?.latitude;
      let lon = currentPosition?.longitude;
      if (!lat || !lon) {
        try {
          const freshLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setCurrentPosition(freshLoc.coords);
          lat = freshLoc.coords.latitude;
          lon = freshLoc.coords.longitude;
        } catch (_) {
          lat = currentPosition?.latitude || 28.613939;
          lon = currentPosition?.longitude || 77.209021;
        }
      }

      const formData = new FormData();
      formData.append('student_id', studentToUse);
      formData.append('device_id', deviceId);
      formData.append('latitude', lat.toString());
      formData.append('longitude', lon.toString());

      await appendPhotoToFormData(formData, 'selfie', checkinSelfie, 'selfie');

      const response = await fetch(`${serverUrl}/api/attendance/check-in`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: formData,
      });

      const result = await response.json();
      if (response.ok) {
        setVerificationResult(result);
        setResultModalVisible(true);
        setCheckinSelfie(null);
        refreshBackendData();
      } else {
        Alert.alert('Attendance Rejected', result.detail || 'Attendance check-in failed.');
      }
    } catch (err) {
      Alert.alert('Verification Error', `Server response error: ${err.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  // Pick image from gallery
  const handlePickFromGallery = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Gallery access is required.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setRegPhoto(result.assets[0]);
        Alert.alert('Photo Selected! 🖼️', 'Face photo loaded. Tap Enroll Student to complete.');
      }
    } catch (err) {
      Alert.alert('Gallery Selection Error', err.message);
    }
  };

  const handleUseSamplePhoto = async () => {
    try {
      const sampleUrl = `${serverUrl}/api/test-image/student_enroll`;
      const res = await fetch(sampleUrl);
      if (!res.ok) throw new Error(`Server returned HTTP ${res.status}.`);
      setRegPhoto({ uri: sampleUrl });
      Alert.alert('Sample Face Loaded! 👤', 'Sample portrait loaded. You can now tap Enroll Student!');
    } catch (err) {
      Alert.alert('Could Not Load Sample', `Error: ${err.message}`);
    }
  };

  // Student Enrollment Handler
  const handleRegisterStudent = async () => {
    if (!regId.trim() || !regName.trim()) {
      Alert.alert('Incomplete Form', 'Please enter Student Roll / ID and Full Name.');
      return;
    }
    if (!regPhoto) {
      Alert.alert('Face Photo Missing', 'Please provide a face photo.');
      return;
    }

    const boundDevice = (deviceId && deviceId !== 'Detecting...') ? deviceId : `DEV-${Math.floor(1000 + Math.random() * 9000)}`;

    setIsRegistering(true);
    try {
      const formData = new FormData();
      formData.append('student_id', regId.trim());
      formData.append('name', regName.trim());
      if (regEmail.trim()) formData.append('email', regEmail.trim());
      formData.append('device_id', boundDevice);
      formData.append('password', 'student123');

      await appendPhotoToFormData(formData, 'photo', regPhoto, 'enroll');

      const res = await fetch(`${serverUrl}/api/students/register`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        const enrolledId = regId.trim();
        Alert.alert(
          'Enrolled Successfully! 🎉',
          `Student '${regName}' (${enrolledId}) is enrolled!\n\n• Default Password: student123\n• 128-d Biometric Vector stored\n• Bound Device: ${boundDevice}`
        );
        setSavedStudentId(enrolledId);
        setRegId('');
        setRegName('');
        setRegEmail('');
        setRegPhoto(null);
        refreshBackendData();
        setActiveTab('checkin');
      } else {
        Alert.alert('Registration Failed', data.detail || 'Could not register student.');
      }
    } catch (err) {
      Alert.alert('Error', `Network or server error: ${err.message}`);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleSimulateTime = async (timeStr) => {
    try {
      const res = await fetch(`${serverUrl}/api/schedule/simulate-time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time_str: timeStr }),
      });
      const data = await res.json();
      if (res.ok) {
        const stuId = currentUser?.student_id || savedStudentId || '';
        const schedRes = await fetch(
          `${serverUrl}/api/schedule/current${stuId ? `?student_id=${encodeURIComponent(stuId)}` : ''}`
        ).then((r) => r.json());
        setScheduleInfo(schedRes);
        if (timeStr) {
          Alert.alert(
            'Simulation Active 🧪',
            `Clock set to ${timeStr}.\nStatus: ${schedRes.window_status}\n\n${schedRes.message || ''}`
          );
        } else {
          Alert.alert('Reset to Live Clock 🕒', 'Schedule returned to real system clock.');
        }
      }
    } catch (err) {
      Alert.alert('Simulation Error', err.message);
    }
  };

  const nearestZone = getNearestZone();

  // If user is NOT logged in, show the LoginScreen
  if (!authToken) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#090D16" />
        <LoginScreen
          serverUrl={serverUrl}
          setServerUrl={setServerUrl}
          onLoginSuccess={handleLoginSuccess}
          deviceId={deviceId}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#090D16" />

      {/* Top Header with Role & Logout */}
      <Header
        isOnline={isServerOnline}
        currentUser={currentUser}
        userRole={userRole}
        onLogout={handleLogout}
      />

      {/* Main Screens */}
      <View style={styles.content}>
        {activeTab === 'checkin' && (
          <CheckInScreen
            checkinSelfie={checkinSelfie}
            onOpenLiveCamera={() => handleOpenLiveCamera('checkin')}
            currentPosition={currentPosition}
            isGpsLoading={isGpsLoading}
            onRefreshLocation={handleRefreshLocation}
            deviceId={deviceId}
            nearestZone={nearestZone}
            scheduleInfo={scheduleInfo}
            onRefreshSchedule={() => refreshBackendData()}
            currentUser={currentUser}
            userRole={userRole}
            students={students}
            savedStudentId={savedStudentId}
            onSelectStudent={(id) => {
              setSavedStudentId(id);
              AsyncStorage.setItem(PREF_STUDENT_ID, id);
            }}
            onVerify={handleSubmitCheckIn}
            isVerifying={isVerifying}
            onSyncLocation={handleSyncCurrentLocationToZone}
            isSyncingZone={isSyncingZone}
          />
        )}

        {/* Enrollment screen only accessible by Faculty / Admin */}
        {activeTab === 'students' && userRole === 'admin' && (
          <StudentsScreen
            regId={regId}
            setRegId={setRegId}
            regName={regName}
            setRegName={setRegName}
            regEmail={regEmail}
            setRegEmail={setRegEmail}
            regPhoto={regPhoto}
            onOpenLiveCamera={() => handleOpenLiveCamera('enroll')}
            onPickFromGallery={handlePickFromGallery}
            onUseSamplePhoto={handleUseSamplePhoto}
            onRegister={handleRegisterStudent}
            isRegistering={isRegistering}
            students={students}
          />
        )}

        {activeTab === 'history' && (
          <HistoryScreen
            serverUrl={serverUrl}
            userRole={userRole}
            currentUser={currentUser}
            records={records}
            students={students}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsScreen
            serverUrl={serverUrl}
            setServerUrl={setServerUrl}
            onTestConnection={handleTestConnection}
            deviceId={deviceId}
            onSyncLocation={handleSyncCurrentLocationToZone}
            isSyncingZone={isSyncingZone}
            facultyPin={facultyPin}
            setFacultyPin={setFacultyPin}
            isFacultyUnlocked={isFacultyUnlocked}
            setIsFacultyUnlocked={setIsFacultyUnlocked}
          />
        )}
      </View>

      {/* Fullscreen Camera Modal HUD */}
      <CameraModal
        visible={isCameraActive}
        cameraMode={cameraMode}
        onClose={() => setIsCameraActive(false)}
        onCapture={handleCapturePhoto}
      />

      {/* Verification Result Modal */}
      <ResultModal
        visible={resultModalVisible}
        result={verificationResult}
        onClose={() => setResultModalVisible(false)}
      />

      {/* Bottom Tab Navigation Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('checkin')}>
          <Text style={[styles.tabIcon, activeTab === 'checkin' && styles.tabIconActive]}>📷</Text>
          <Text style={[styles.tabText, activeTab === 'checkin' && styles.tabTextActive]}>Check-In</Text>
        </TouchableOpacity>

        {/* Admin only: Students Tab */}
        {userRole === 'admin' && (
          <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('students')}>
            <Text style={[styles.tabIcon, activeTab === 'students' && styles.tabIconActive]}>👥</Text>
            <Text style={[styles.tabText, activeTab === 'students' && styles.tabTextActive]}>Enroll</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('history')}>
          <Text style={[styles.tabIcon, activeTab === 'history' && styles.tabIconActive]}>📜</Text>
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
            {userRole === 'admin' ? 'Audits' : 'My Day'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('settings')}>
          <Text style={[styles.tabIcon, activeTab === 'settings' && styles.tabIconActive]}>⚙️</Text>
          <Text style={[styles.tabText, activeTab === 'settings' && styles.tabTextActive]}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgBase },
  content: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgSurface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
  },
  tabItem: { flex: 1, alignItems: 'center' },
  tabIcon: { fontSize: 20, opacity: 0.5 },
  tabIconActive: { opacity: 1 },
  tabText: { color: COLORS.textMuted, fontSize: 11, marginTop: 3 },
  tabTextActive: { color: COLORS.primaryLight, fontWeight: 'bold' },
});
