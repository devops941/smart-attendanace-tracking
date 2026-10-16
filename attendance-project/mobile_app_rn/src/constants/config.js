import { Platform } from 'react-native';

export const PREF_SERVER_URL = 'smart_attendance_rn_server_url';
export const PREF_STUDENT_ID = 'smart_attendance_rn_student_id';
export const PREF_AUTH_TOKEN = 'smart_attendance_rn_auth_token';
export const PREF_USER_ROLE = 'smart_attendance_rn_user_role';
export const PREF_USER_INFO = 'smart_attendance_rn_user_info';

// Default backend URL (Live Render Cloud URL)
export const DEFAULT_URL = 'https://smart-attendance-api-zaoh.onrender.com';

export const IP_PRESETS = [
  { label: '☁️ Render Cloud', url: 'https://smart-attendance-api-zaoh.onrender.com', color: '#10B981' },
  { label: '⚡ Wi-Fi: 10.165.124.96', url: 'http://10.165.124.96:8000', color: '#06B6D4' },
  { label: '💻 Localhost (Web)', url: 'http://localhost:8000', color: '#38BDF8' },
  { label: '📱 Emulator (10.0.2.2)', url: 'http://10.0.2.2:8000', color: '#94A3B8' },
];

export const GUIDANCE_TIPS = [
  { icon: '💡', title: 'Lighting Check', desc: 'Ensure bright, front-facing light (avoid backlight)' },
  { icon: '📏', title: 'Face Alignment', desc: 'Center face completely inside the biometric oval' },
  { icon: '👁️', title: 'Pose & Eyes', desc: 'Look directly at camera lens & remove dark glasses' },
  { icon: '🛡️', title: 'Hold Steady', desc: 'Keep still to prevent motion blur during 128-d scan' },
];
