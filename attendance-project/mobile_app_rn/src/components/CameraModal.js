import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  Alert,
} from 'react-native';
import { CameraView } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { GUIDANCE_TIPS } from '../constants/config';
import { COLORS } from '../constants/theme';

export default function CameraModal({
  visible,
  cameraMode,
  onClose,
  onCapture,
}) {
  const cameraRef = useRef(null);
  const [tipIndex, setTipIndex] = useState(0);

  // Auto-rotate guidance tips while camera HUD is visible
  useEffect(() => {
    let timer;
    if (visible) {
      timer = setInterval(() => {
        setTipIndex((prev) => (prev + 1) % GUIDANCE_TIPS.length);
      }, 3500);
    }
    return () => clearInterval(timer);
  }, [visible]);

  const handleSnap = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      onCapture(photo);
    } catch (err) {
      Alert.alert('Camera Error', err.message);
    }
  };

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView style={styles.camera} facing="front" ref={cameraRef}>
          {/* HUD Header */}
          <View style={styles.cameraModalHeader}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons
                  name={cameraMode === 'enroll' ? 'person-circle-outline' : 'camera-outline'}
                  size={18}
                  color="#fff"
                />
                <Text style={styles.cameraModalTitle}>
                  {cameraMode === 'enroll' ? 'Reference Biometric Photo' : 'Live Check-In Selfie'}
                </Text>
              </View>
              <Text style={{ color: COLORS.accentCyan, fontSize: 11, marginTop: 2 }}>
                AI Facial Quality & Alignment HUD
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeCameraBtn}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="close" size={18} color={COLORS.accentRose} />
                <Text style={{ color: COLORS.accentRose, fontSize: 14, fontWeight: 'bold' }}>Cancel</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Real-Time Quality Guidance Banner */}
          <View style={styles.guidanceBanner}>
            <Ionicons name={GUIDANCE_TIPS[tipIndex].icon} size={22} color={COLORS.accentCyan} />
            <View style={{ flex: 1 }}>
              <Text style={styles.guidanceTitle}>{GUIDANCE_TIPS[tipIndex].title}</Text>
              <Text style={styles.guidanceSub}>{GUIDANCE_TIPS[tipIndex].desc}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setTipIndex((prev) => (prev + 1) % GUIDANCE_TIPS.length)}
              style={styles.guidanceCycleBtn}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Text style={{ color: COLORS.accentCyan, fontSize: 11, fontWeight: 'bold' }}>Next</Text>
                <Ionicons name="arrow-forward" size={11} color={COLORS.accentCyan} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Face Oval Reticle with Corner Brackets */}
          <View style={styles.faceOval}>
            <View style={styles.faceOvalWrapper}>
              <View style={styles.faceOvalGuide} />
              <View style={[styles.cornerBracket, styles.bracketTopLeft]} />
              <View style={[styles.cornerBracket, styles.bracketTopRight]} />
              <View style={[styles.cornerBracket, styles.bracketBottomLeft]} />
              <View style={[styles.cornerBracket, styles.bracketBottomRight]} />
              <View style={styles.scanLine} />
            </View>
            <Text style={styles.faceGuideText}>Position face inside the oval</Text>
          </View>

          {/* Real-Time Quality Checklist Badges */}
          <View style={styles.qualityChecklistRow}>
            <View style={styles.qualityCheckItem}>
              <Ionicons name="checkmark-circle" size={13} color={COLORS.accentEmerald} />
              <Text style={styles.qualityCheckText}>Lighting: Good</Text>
            </View>
            <View style={styles.qualityCheckItem}>
              <Ionicons name="checkmark-circle" size={13} color={COLORS.accentEmerald} />
              <Text style={styles.qualityCheckText}>Pose: Frontal</Text>
            </View>
            <View style={styles.qualityCheckItem}>
              <Ionicons name="checkmark-circle" size={13} color={COLORS.accentEmerald} />
              <Text style={styles.qualityCheckText}>PAD Ready</Text>
            </View>
          </View>

          {/* Shutter Button */}
          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.snapButton} onPress={handleSnap}>
              <View style={styles.snapInner} />
            </TouchableOpacity>
            <Text style={{ color: COLORS.textMain, fontSize: 12, marginTop: 8, fontWeight: '600' }}>
              Tap to Capture Biometrics
            </Text>
          </View>
        </CameraView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  camera: { flex: 1, justifyContent: 'space-between' },
  cameraModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  cameraModalTitle: { color: COLORS.textMain, fontSize: 15, fontWeight: 'bold' },
  closeCameraBtn: { padding: 6 },
  guidanceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(9, 13, 22, 0.85)',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  guidanceTitle: { color: COLORS.accentCyan, fontSize: 12, fontWeight: 'bold' },
  guidanceSub: { color: '#E2E8F0', fontSize: 11, marginTop: 2 },
  guidanceCycleBtn: { padding: 4 },
  faceOval: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  faceOvalWrapper: {
    width: 250,
    height: 330,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceOvalGuide: {
    width: 230,
    height: 310,
    borderRadius: 120,
    borderWidth: 2.5,
    borderColor: COLORS.accentCyan,
    backgroundColor: 'rgba(6, 182, 212, 0.04)',
    borderStyle: 'dashed',
  },
  cornerBracket: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: '#38BDF8',
  },
  bracketTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3.5,
    borderLeftWidth: 3.5,
    borderTopLeftRadius: 8,
  },
  bracketTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3.5,
    borderRightWidth: 3.5,
    borderTopRightRadius: 8,
  },
  bracketBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3.5,
    borderLeftWidth: 3.5,
    borderBottomLeftRadius: 8,
  },
  bracketBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3.5,
    borderRightWidth: 3.5,
    borderBottomRightRadius: 8,
  },
  scanLine: {
    position: 'absolute',
    width: '85%',
    height: 1.5,
    backgroundColor: 'rgba(6, 182, 212, 0.75)',
  },
  faceGuideText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.4,
    marginTop: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  qualityChecklistRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 8,
    marginHorizontal: 20,
    borderRadius: 12,
  },
  qualityCheckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  qualityCheckText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  cameraControls: {
    alignItems: 'center',
    paddingBottom: 28,
  },
  snapButton: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  snapInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
  },
});
