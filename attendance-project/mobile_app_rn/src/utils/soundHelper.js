import { Audio } from 'expo-av';
import { Platform } from 'react-native';

let currentSound = null;
let isAudioConfigured = false;

async function configureAudio() {
  if (isAudioConfigured) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
    isAudioConfigured = true;
  } catch (e) {
    console.warn('Audio mode config warning:', e);
  }
}

/**
 * Plays an audible notification alert chime for location events.
 * @param {'location_off' | 'outside_office' | 'office_entered'} type
 */
export async function playSound(type = 'location_off') {
  try {
    await configureAudio();

    if (currentSound) {
      try {
        await currentSound.stopAsync();
        await currentSound.unloadAsync();
      } catch (_) { }
      currentSound = null;
    }

    let soundSource;
    if (type === 'location_off') {
      soundSource = require('../../assets/sounds/jeremayjimenez-random-alarm-319318.mp3');
    } else if (type === 'outside_office') {
      soundSource = require('../../assets/sounds/outside_office.wav');
    } else if (type === 'office_entered') {
      soundSource = require('../../assets/sounds/office_entered.wav');
    } else {
      soundSource = require('../../assets/sounds/location_off.wav');
    }

    const { sound } = await Audio.Sound.createAsync(
      soundSource,
      { shouldPlay: true, volume: 1.0 }
    );
    currentSound = sound;

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) {
        sound.unloadAsync().catch(() => { });
        if (currentSound === sound) currentSound = null;
      }
    });
  } catch (err) {
    console.warn('Audio playback notice:', err);
  }
}

export const playLocationOffSound = () => playSound('location_off');
export const playOutsideOfficeSound = () => playSound('outside_office');
export const playOfficeEnteredSound = () => playSound('office_entered');
