
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  StatusBar,
  Alert,
  Platform,
  TouchableOpacity,
  Text,
  Vibration,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

// Constants & Theme
import { COLORS } from './src/constants/theme';
import {
  DEFAULT_URL,
  PREF_SERVER_URL,
  PREF_EMPLOYEE_CODE,
  PREF_AUTH_TOKEN,
  PREF_USER_ROLE,
  PREF_USER_INFO,
} from './src/constants/config';

// Components
import Header from './src/components/Header';
import CameraModal from './src/components/CameraModal';
import ResultModal from './src/components/ResultModal';
import LocationNotificationBanner from './src/components/LocationNotificationBanner';

// Sound & Audio Alerts
import {
  playLocationOffSound,
  playOutsideOfficeSound,
  playOfficeEnteredSound,
} from './src/utils/soundHelper';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import CheckInScreen from './src/screens/CheckInScreen';
import EmployeesScreen from './src/screens/EmployeesScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';

export default function App() {
  // Authentication & Role State
  const [authToken, setAuthToken] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'employee' | 'admin'
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // App Navigation & Backend State
  const [activeTab, setActiveTab] = useState('checkin'); // checkin | employees | history | settings
  const [serverUrl, setServerUrl] = useState(DEFAULT_URL);
  const [isServerOnline, setIsServerOnline] = useState(true);
  const [savedEmpCode, setSavedEmpCode] = useState('');
  const [deviceId, setDeviceId] = useState('Detecting...');
  const [currentPosition, setCurrentPosition] = useState(null);
  const [isLocationServicesEnabled, setIsLocationServicesEnabled] = useState(true);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);
  const [zones, setZones] = useState([]);
  const [isSyncingZone, setIsSyncingZone] = useState(false);
  const [dailyStatus, setDailyStatus] = useState(null);
  const [activeLocationAlert, setActiveLocationAlert] = useState(null);
  const prevSentinelStateRef = useRef(null);

  // Camera & Verification
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraMode, setCameraMode] = useState('checkin'); // 'checkin' | 'enroll'
  const [checkinSelfie, setCheckinSelfie] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  // Enrollment Form State (HR Admin)
  const [regId, setRegId] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhoto, setRegPhoto] = useState(null);
  const [regBranchId, setRegBranchId] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);

  // Faculty/Admin PIN Gate
  const [facultyPin, setFacultyPin] = useState('');
  const [isFacultyUnlocked, setIsFacultyUnlocked] = useState(false);

  // 1. Initial Device, Auth & Preferences Setup
  useEffect(() => {
    (async () => {
      try {
        // One-time auto-wipe of legacy student cache from phone AsyncStorage
        const FRESH_FLAG = 'smart_attendance_office_fresh_2026';
        const hasBeenCleaned = await AsyncStorage.getItem(FRESH_FLAG);
        if (hasBeenCleaned !== 'true') {
          await AsyncStorage.clear();
          await AsyncStorage.setItem(FRESH_FLAG, 'true');
          await AsyncStorage.setItem(PREF_SERVER_URL, DEFAULT_URL);
        }

        let urlToUse = DEFAULT_URL;
        const storedUrl = await AsyncStorage.getItem(PREF_SERVER_URL);
        if (storedUrl && !storedUrl.includes('onrender.com')) {
          setServerUrl(storedUrl);
          urlToUse = storedUrl;
        } else {
          setServerUrl(DEFAULT_URL);
          await AsyncStorage.setItem(PREF_SERVER_URL, DEFAULT_URL);
          urlToUse = DEFAULT_URL;
        }

        // Restore auth session
        const token = await AsyncStorage.getItem(PREF_AUTH_TOKEN);
        const role = await AsyncStorage.getItem(PREF_USER_ROLE);
        const userStr = await AsyncStorage.getItem(PREF_USER_INFO);

        if (token && role && userStr) {
          try {
            const parsedUser = JSON.parse(userStr);
            const code = parsedUser.emp_code;
            // Purge legacy student accounts that don't have corporate emp_code
            if (!code && role === 'employee') {
              await AsyncStorage.multiRemove([
                PREF_AUTH_TOKEN,
                PREF_USER_ROLE,
                PREF_USER_INFO,
                PREF_EMPLOYEE_CODE,
              ]);
            } else if (role === 'employee' && code) {
              const res = await fetch(`${urlToUse}/api/employee/status/${code}`).then(r => r.json()).catch(() => null);
              if (!res || res.status === 'NOT_FOUND' || res.exists === false) {
                // If not found in fresh database, clear stored credentials
                await AsyncStorage.multiRemove([
                  PREF_AUTH_TOKEN,
                  PREF_USER_ROLE,
                  PREF_USER_INFO,
                  PREF_EMPLOYEE_CODE,
                ]);
              } else {
                setAuthToken(token);
                setUserRole(role);
                setCurrentUser(parsedUser);
                setSavedEmpCode(code);
              }
            } else if (role === 'admin') {
              setAuthToken(token);
              setUserRole(role);
              setCurrentUser(parsedUser);
            }
          } catch (_) {}
        }

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

  // 2. Periodic Real-Time Office Work Status Poller (every 12 seconds)
  useEffect(() => {
    if (authToken) {
      fetchEmployeeStatus();
      const timer = setInterval(fetchEmployeeStatus, 12000);
      return () => clearInterval(timer);
    }
  }, [serverUrl, currentUser, savedEmpCode, authToken]);

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
        Alert.alert('Permission Required', 'Location permission is required for office geofence verification.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (loc) {
        setCurrentPosition(loc.coords);
        Alert.alert('GPS Location Updated', `Lat: ${loc.coords.latitude.toFixed(5)}\nLon: ${loc.coords.longitude.toFixed(5)}`);
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

      // Fetch corporate employees only
      const empRes = await fetch(`${base}/api/employees`).then((r) => r.json()).catch(() => []);
      setEmployees(Array.isArray(empRes) ? empRes : []);

      const recRes = await fetch(`${base}/api/attendance/records?limit=40`).then((r) => r.json()).catch(() => []);
      if (Array.isArray(recRes)) setRecords(recRes);

      const zoneRes = await fetch(`${base}/api/zones`).then((r) => r.json()).catch(() => []);
      if (Array.isArray(zoneRes)) {
        setZones(zoneRes);
        if (zoneRes.length > 0) {
          setRegBranchId((prev) => prev || zoneRes[0].id);
        }
      }
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

    const codeToSave = user?.emp_code || user?.student_id;
    if (codeToSave) {
      setSavedEmpCode(codeToSave);
      await AsyncStorage.setItem(PREF_EMPLOYEE_CODE, codeToSave);
    }
    if (role === 'admin') {
      setActiveTab('employees');
    } else {
      setActiveTab('checkin');
    }
    refreshBackendData();
    setTimeout(() => fetchEmployeeStatus(), 300);
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

  const handleResetApp = async () => {
    await AsyncStorage.clear();
    setAuthToken(null);
    setUserRole(null);
    setCurrentUser(null);
    setSavedEmpCode('');
    setEmployees([]);
    setRecords([]);
    setDailyStatus(null);
    refreshBackendData();
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
          'Connected!',
          `Office Attendance Server is online.\nFace Engine: ${data.face_engine_ready ? 'Ready' : 'Offline'}\nDatabase: Active`
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

  // Haversine distance formula to office zones
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
    const assignedBranchId = currentUser?.branch_id;
    if (assignedBranchId) {
      const assigned = zones.find((z) => Number(z.id) === Number(assignedBranchId));
      if (assigned) {
        const d = getDistanceToZone(assigned.latitude, assigned.longitude);
        return { ...assigned, distance: d, is_assigned: true };
      }
    }

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

  const nearestZone = getNearestZone();

  // Continuous Geofence & Location Sentinel while Clocked In
  useEffect(() => {
    let watcherSub = null;
    let intervalChecker = null;
    let isMounted = true;

    const checkService = async () => {
      try {
        const hasServices = await Location.hasServicesEnabledAsync();
        if (isMounted) {
          setIsLocationServicesEnabled(hasServices);
          if (!hasServices) {
            setCurrentPosition(null);
          }
        }
        return hasServices;
      } catch (_) {
        if (isMounted) {
          setIsLocationServicesEnabled(false);
          setCurrentPosition(null);
        }
        return false;
      }
    };

    if (dailyStatus?.is_clocked_in && !dailyStatus?.is_clocked_out) {
      (async () => {
        try {
          const enabled = await checkService();
          const { status } = await Location.getForegroundPermissionsAsync();

          if (status === 'granted' && enabled) {
            watcherSub = await Location.watchPositionAsync(
              {
                accuracy: Location.Accuracy.Balanced,
                timeInterval: 3000,
                distanceInterval: 2,
              },
              (newLoc) => {
                if (isMounted && newLoc?.coords) {
                  setIsLocationServicesEnabled(true);
                  setCurrentPosition(newLoc.coords);
                }
              },
              (err) => {
                if (isMounted) {
                  setIsLocationServicesEnabled(false);
                  setCurrentPosition(null);
                }
              }
            );
          }

          // Active 2-second device GPS service poll
          intervalChecker = setInterval(checkService, 2000);
        } catch (e) {
          console.warn('Geofence sentinel error:', e);
        }
      })();
    }

    return () => {
      isMounted = false;
      if (watcherSub) watcherSub.remove();
      if (intervalChecker) clearInterval(intervalChecker);
    };
  }, [dailyStatus?.is_clocked_in, dailyStatus?.is_clocked_out]);

  // Dedicated Separate Notifications: (1) GPS Location OFF, (2) Moved to Other Location, (3) Back in Office
  useEffect(() => {
    const isClockedIn = dailyStatus?.is_clocked_in && !dailyStatus?.is_clocked_out;
    const isOnBreak = dailyStatus?.is_on_break;

    if (!isClockedIn || isOnBreak) {
      if (prevSentinelStateRef.current !== null) {
        prevSentinelStateRef.current = null;
        setActiveLocationAlert(null);
      }
      return;
    }

    const isGpsOff =
      !isLocationServicesEnabled ||
      !currentPosition ||
      currentPosition.latitude === undefined ||
      currentPosition.latitude === null;
    const maxAllowedDistance = (nearestZone?.radius_meters || 100.0) + 150.0;
    const isOutsideOffice = !isGpsOff && nearestZone ? nearestZone.distance > maxAllowedDistance : false;

    let currentState = 'OK';
    if (isGpsOff) {
      currentState = 'GPS_OFF';
    } else if (isOutsideOffice) {
      currentState = 'OUTSIDE_OFFICE';
    }

    const prevState = prevSentinelStateRef.current;

    // First evaluation after clocking in
    if (prevState === null) {
      prevSentinelStateRef.current = currentState;
      if (currentState === 'GPS_OFF') {
        setActiveLocationAlert({
          type: 'gps_off',
          title: 'Location Services Disabled',
          message: 'Device GPS is turned OFF. Real-time attendance timer is PAUSED. Turn ON location to resume tracking.',
        });
        try {
          playLocationOffSound();
        } catch (_) {}
        try {
          Vibration.vibrate([0, 500, 200, 500]);
        } catch (_) {}
        Alert.alert(
          'GPS Location Is Turned Off',
          'Your mobile device location (GPS) is turned off or unavailable.\n\nWork hours timer has been PAUSED.\nPlease enable GPS location services to resume your shift duration tracking.',
          [{ text: 'OK' }]
        );
      } else if (currentState === 'OUTSIDE_OFFICE') {
        setActiveLocationAlert({
          type: 'outside_office',
          title: 'Moved to Another Location',
          message: `You have moved outside your allocated office boundary (${nearestZone?.distance ? nearestZone.distance + 'm away from ' : ''}${nearestZone?.name || 'Office Branch'}). Attendance timer is PAUSED.`,
        });
        try {
          playOutsideOfficeSound();
        } catch (_) {}
        try {
          Vibration.vibrate([0, 350, 150, 350, 150, 350]);
        } catch (_) {}
        Alert.alert(
          'Moved to Other Location',
          `You have moved outside your allocated office boundary (${nearestZone?.distance ? nearestZone.distance + 'm away from ' : ''}${nearestZone?.name || 'Office Branch'}).\n\nWork hours timer has been PAUSED.\nPlease return inside your office branch boundary to resume tracking.`,
          [{ text: 'OK' }]
        );
      }
      return;
    }

    // State transition detected: trigger separate notifications & audible sound alerts!
    if (currentState !== prevState) {
      prevSentinelStateRef.current = currentState;

      if (currentState === 'GPS_OFF') {
        // Notification Alert 1: GPS Location OFF (Play Audible Warning Sound + Vibration)
        setActiveLocationAlert({
          type: 'gps_off',
          title: 'Location Services Disabled',
          message: 'Device GPS is turned OFF. Real-time attendance timer is PAUSED. Turn ON location to resume tracking.',
        });
        try {
          playLocationOffSound();
        } catch (_) {}
        try {
          Vibration.vibrate([0, 500, 200, 500]);
        } catch (_) {}
        Alert.alert(
          'GPS Location Is Turned Off',
          'Your mobile device location (GPS) is turned off or unavailable.\n\nWork hours timer has been PAUSED.\nPlease enable GPS location services to resume your shift duration tracking.',
          [{ text: 'OK' }]
        );
      } else if (currentState === 'OUTSIDE_OFFICE') {
        // Notification Alert 2: Moved to Other Location (Play Outside Office Sound + Vibration)
        setActiveLocationAlert({
          type: 'outside_office',
          title: 'Moved to Another Location',
          message: `You have moved outside your allocated office boundary (${nearestZone?.distance ? nearestZone.distance + 'm away from ' : ''}${nearestZone?.name || 'Office Branch'}). Attendance timer is PAUSED.`,
        });
        try {
          playOutsideOfficeSound();
        } catch (_) {}
        try {
          Vibration.vibrate([0, 350, 150, 350, 150, 350]);
        } catch (_) {}
        Alert.alert(
          'Moved to Other Location',
          `You have moved outside your allocated office boundary (${nearestZone?.distance ? nearestZone.distance + 'm away from ' : ''}${nearestZone?.name || 'Office Branch'}).\n\nWork hours timer has been PAUSED.\nPlease return inside your office branch boundary to resume tracking.`,
          [{ text: 'OK' }]
        );
      } else if (currentState === 'OK') {
        // Notification Alert 3: Re-entered Office Location (Play Confirmation Chime)
        setActiveLocationAlert({
          type: 'back_in_office',
          title: 'Welcome Back to Office!',
          message: `Location verified inside ${nearestZone?.name || 'office branch'}. Attendance timer RESUMED.`,
        });
        try {
          playOfficeEnteredSound();
        } catch (_) {}
        try {
          Vibration.vibrate(200);
        } catch (_) {}
        Alert.alert(
          'Back Inside Office Branch',
          `Your device is back inside ${nearestZone?.name || 'Office Branch'}.\n\nWork hours timer has RESUMED automatically.`,
          [{ text: 'Great' }]
        );
        setTimeout(() => {
          setActiveLocationAlert((curr) => (curr?.type === 'back_in_office' ? null : curr));
        }, 5000);
      }
    }
  }, [
    dailyStatus?.is_clocked_in,
    dailyStatus?.is_clocked_out,
    dailyStatus?.is_on_break,
    isLocationServicesEnabled,
    currentPosition?.latitude,
    currentPosition?.longitude,
    nearestZone?.distance,
    nearestZone?.name,
  ]);

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
          name: 'Office Branch Geofence (Synced GPS)',
          latitude: lat,
          longitude: lon,
          radius_meters: 100.0,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        Alert.alert(
          'Office Geofence Synced',
          `Boundary centered at your current GPS:\nLat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(5)}\nRadius: 100 meters.`
        );
        refreshBackendData();
      } else {
        Alert.alert('Geofence Sync Failed', data.detail || 'Could not save office geofence.');
      }
    } catch (err) {
      Alert.alert('Sync Error', err.message);
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

  // Fetch Employee Real-Time Daily Status
  const fetchEmployeeStatus = async () => {
    const code = currentUser?.emp_code || currentUser?.student_id || savedEmpCode;
    if (!code) return;
    try {
      const res = await fetch(`${serverUrl}/api/employee/status/${code}`);
      const data = await res.json();
      if (data && data.emp_code) {
        setDailyStatus(data);
      }
    } catch (_) {}
  };

  // Helper for Cross-Platform Multipart Image Upload
  // Helper for Cross-Platform Multipart Image Upload
  const appendPhotoToFormData = async (formData, fieldName, photoObj, fallbackPrefix = 'image') => {
    if (!photoObj) return;
    const uri = typeof photoObj === 'string' ? photoObj : photoObj.uri;
    if (!uri) return;

    if (Platform.OS === 'web' || uri.startsWith('data:') || uri.startsWith('blob:')) {
      const response = await fetch(uri);
      const blob = await response.blob();
      formData.append(fieldName, blob, `${fallbackPrefix}.jpg`);
    } else {
      formData.append(fieldName, {
        uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
        name: `${fallbackPrefix}.jpg`,
        type: 'image/jpeg',
      });
    }
  };

  // Submit Clock-In or Clock-Out Punch
  const handleClockIn = async (isClockOut = false) => {
    const code = currentUser?.emp_code || currentUser?.student_id || savedEmpCode.trim() || (employees.length > 0 ? (employees[0].emp_code || employees[0].student_id) : '');
    if (!code) {
      Alert.alert('Select Account', 'Please sign in with your employee account first.');
      return;
    }
    if (!checkinSelfie) {
      Alert.alert('Live Camera Required', 'Please tap "Open Live Camera" to capture your selfie.');
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
      formData.append('emp_code', code);
      formData.append('student_id', code);
      formData.append('device_id', deviceId);
      formData.append('latitude', lat.toString());
      formData.append('longitude', lon.toString());
      formData.append('is_mock', 'false');

      await appendPhotoToFormData(formData, 'selfie', checkinSelfie, 'selfie');

      const baseUrl = (serverUrl || DEFAULT_URL).replace(/\/+$/, '');
      const endpoint = isClockOut
        ? `${baseUrl}/api/employee/clock-out`
        : `${baseUrl}/api/employee/clock-in`;

      let response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: formData,
      });

      let result;
      const text = await response.text();
      try {
        result = JSON.parse(text);
      } catch (parseErr) {
        throw new Error(response.ok ? 'Invalid response format from server.' : `Server error (${response.status}): ${text.slice(0, 150)}`);
      }

      if (response.ok && (result.success || result.status === 'SUCCESS' || result.status === 'COMPLETED' || result.status === 'CLOCKED_IN')) {
        setVerificationResult(result);
        setResultModalVisible(true);
        setCheckinSelfie(null);
        refreshBackendData();
        fetchEmployeeStatus();
      } else if (result && result.checks) {
        setVerificationResult(result);
        setResultModalVisible(true);
      } else {
        Alert.alert(
          isClockOut ? 'Clock-Out Rejected' : 'Clock-In Rejected',
          result?.message || result?.detail || 'Biometric verification failed.'
        );
      }
    } catch (err) {
      Alert.alert('Verification Error', err.message || 'Network request failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleStartBreak = async (type = 'LUNCH') => {
    const code = currentUser?.emp_code || currentUser?.student_id || savedEmpCode;
    if (!code) return;
    try {
      const res = await fetch(`${serverUrl}/api/employee/break/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emp_code: code, break_type: type }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        Alert.alert('Lunch Break Started', data.message);
        fetchEmployeeStatus();
      } else {
        Alert.alert('Cannot Start Break', data.message || 'Error starting break.');
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const handleEndBreak = async () => {
    const code = currentUser?.emp_code || currentUser?.student_id || savedEmpCode;
    if (!code) return;
    try {
      const res = await fetch(`${serverUrl}/api/employee/break/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emp_code: code }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        Alert.alert('Work Resumed', data.message);
        fetchEmployeeStatus();
      } else {
        Alert.alert('Cannot End Break', data.message || 'Error ending break.');
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

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
        Alert.alert('Photo Selected', 'Face photo loaded. Tap Enroll Employee to complete.');
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
      Alert.alert('Sample Face Loaded', 'Sample portrait loaded. You can now tap Enroll Employee!');
    } catch (err) {
      Alert.alert('Could Not Load Sample', `Error: ${err.message}`);
    }
  };

  // Corporate Employee Enrollment Handler
  const handleRegisterEmployee = async () => {
    if (!regId.trim() || !regName.trim()) {
      Alert.alert('Incomplete Form', 'Please enter Employee Code / ID and Full Name.');
      return;
    }
    if (!regPhoto) {
      Alert.alert('Face Photo Missing', 'Please provide a reference face photo.');
      return;
    }

    const boundDevice = (deviceId && deviceId !== 'Detecting...') ? deviceId : `DEV-${Math.floor(1000 + Math.random() * 9000)}`;

    setIsRegistering(true);
    try {
      const formData = new FormData();
      formData.append('emp_code', regId.trim());
      formData.append('student_id', regId.trim());
      formData.append('name', regName.trim());
      if (regEmail.trim()) formData.append('email', regEmail.trim());
      formData.append('department', 'Operations');
      const branchToAssign = regBranchId || (zones.length > 0 ? zones[0].id : null);
      if (!branchToAssign) {
        Alert.alert('Office Branch Required', 'Please configure an office branch in Settings first.');
        setIsRegistering(false);
        return;
      }
      formData.append('branch_id', String(branchToAssign));
      formData.append('device_id', boundDevice);
      formData.append('password', 'office123');

      await appendPhotoToFormData(formData, 'photo', regPhoto, 'enroll');

      let res = await fetch(`${serverUrl}/api/employee/register`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: formData,
      });



      const data = await res.json();
      if (res.ok) {
        const enrolledId = regId.trim();
        Alert.alert(
          'Enrolled Successfully',
          `Employee '${regName}' (${enrolledId}) is enrolled!\n\n• Default Password: office123\n• 128-d Biometric Vector stored\n• Bound Device: ${boundDevice}`
        );
        setSavedEmpCode(enrolledId);
        setRegId('');
        setRegName('');
        setRegEmail('');
        setRegPhoto(null);
        refreshBackendData();
        setActiveTab('checkin');
      } else {
        Alert.alert('Registration Failed', data.detail || 'Could not register employee.');
      }
    } catch (err) {
      Alert.alert('Error', `Network or server error: ${err.message}`);
    } finally {
      setIsRegistering(false);
    }
  };

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

      {/* Persistent Floating Heads-Up Location Alert Banner */}
      <LocationNotificationBanner
        notification={activeLocationAlert}
        onDismiss={() => setActiveLocationAlert(null)}
        onRefreshGps={handleRefreshLocation}
        isGpsLoading={isGpsLoading}
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
            currentUser={currentUser}
            userRole={userRole}
            onClockIn={handleClockIn}
            onStartBreak={handleStartBreak}
            onEndBreak={handleEndBreak}
            isVerifying={isVerifying}
            onSyncLocation={handleSyncCurrentLocationToZone}
            isSyncingZone={isSyncingZone}
            dailyStatus={dailyStatus}
            isLocationServicesEnabled={isLocationServicesEnabled}
          />
        )}

        {/* Enrollment screen only accessible by HR / Admin */}
        {activeTab === 'employees' && userRole === 'admin' && (
          <EmployeesScreen
            regId={regId}
            setRegId={setRegId}
            regName={regName}
            setRegName={setRegName}
            regEmail={regEmail}
            setRegEmail={setRegEmail}
            regBranchId={regBranchId}
            setRegBranchId={setRegBranchId}
            branches={zones}
            regPhoto={regPhoto}
            onOpenLiveCamera={() => handleOpenLiveCamera('enroll')}
            onPickFromGallery={handlePickFromGallery}
            onUseSamplePhoto={handleUseSamplePhoto}
            onRegister={handleRegisterEmployee}
            isRegistering={isRegistering}
            employees={employees}
            serverUrl={serverUrl}
            onRefresh={refreshBackendData}
          />
        )}

        {activeTab === 'history' && (
          <HistoryScreen
            serverUrl={serverUrl}
            userRole={userRole}
            currentUser={currentUser}
            records={records}
            employees={employees}
            onRefreshHistory={refreshBackendData}
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
            onResetApp={handleResetApp}
            userRole={userRole}
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
          <Ionicons
            name={activeTab === 'checkin' ? 'camera' : 'camera-outline'}
            size={22}
            color={activeTab === 'checkin' ? COLORS.accentCyan : COLORS.textMuted}
            style={styles.tabIcon}
          />
          <Text style={[styles.tabText, activeTab === 'checkin' && styles.tabTextActive]}>Check-In</Text>
        </TouchableOpacity>

        {/* Admin only: Employees Tab */}
        {userRole === 'admin' && (
          <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('employees')}>
            <Ionicons
              name={activeTab === 'employees' ? 'people' : 'people-outline'}
              size={22}
              color={activeTab === 'employees' ? COLORS.accentCyan : COLORS.textMuted}
              style={styles.tabIcon}
            />
            <Text style={[styles.tabText, activeTab === 'employees' && styles.tabTextActive]}>Staff</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('history')}>
          <Ionicons
            name={activeTab === 'history' ? 'time' : 'time-outline'}
            size={22}
            color={activeTab === 'history' ? COLORS.accentCyan : COLORS.textMuted}
            style={styles.tabIcon}
          />
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
            {userRole === 'admin' ? 'Audits' : 'Timesheets'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('settings')}>
          <Ionicons
            name={activeTab === 'settings' ? 'settings' : 'settings-outline'}
            size={22}
            color={activeTab === 'settings' ? COLORS.accentCyan : COLORS.textMuted}
            style={styles.tabIcon}
          />
          <Text style={[styles.tabText, activeTab === 'settings' && styles.tabTextActive]}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgBase,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgSurface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  tabIcon: {
    marginBottom: 3,
  },
  tabText: {
    color: COLORS.textMuted,
    fontSize: 10.5,
    fontWeight: '600',
  },
  tabTextActive: {
    color: COLORS.accentCyan,
    fontWeight: 'bold',
  },
});
