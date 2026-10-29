import { Platform } from 'react-native';

export const PREF_SERVER_URL = 'smart_attendance_rn_server_url';
export const PREF_EMPLOYEE_CODE = 'smart_attendance_rn_emp_code';
export const PREF_AUTH_TOKEN = 'smart_attendance_rn_auth_token';
export const PREF_USER_ROLE = 'smart_attendance_rn_user_role';
export const PREF_USER_INFO = 'smart_attendance_rn_user_info';

// Default backend URL (Local FastAPI Server)
export const DEFAULT_URL = Platform.OS === 'web' ? 'http://localhost:8000' : 'http://192.168.1.30:8000';

export const IP_PRESETS = [
  { label: 'Local PC Wi-Fi (192.168.1.30)', icon: 'wifi-outline', url: 'http://192.168.1.30:8000', color: '#6366F1' },
  { label: 'Localhost (Web Browser)', icon: 'laptop-outline', url: 'http://localhost:8000', color: '#38BDF8' },
  { label: 'Android Emulator (10.0.2.2)', icon: 'phone-portrait-outline', url: 'http://10.0.2.2:8000', color: '#94A3B8' },
];

export const GUIDANCE_TIPS = [
  { icon: 'bulb-outline', title: 'Lighting Check', desc: 'Ensure bright, front-facing light (avoid backlight)' },
  { icon: 'scan-outline', title: 'Face Alignment', desc: 'Center face completely inside the biometric oval' },
  { icon: 'eye-outline', title: 'Pose & Eyes', desc: 'Look directly at camera lens & remove dark glasses' },
  { icon: 'shield-checkmark-outline', title: 'Hold Steady', desc: 'Keep still to prevent motion blur during 128-d scan' },
];
