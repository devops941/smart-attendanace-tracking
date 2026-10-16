import { Platform } from 'react-native';

/**
 * Universal photo appending helper (handles both React Native Mobile and Expo Web)
 */
export const appendPhotoToFormData = async (fd, fieldName, photoObj, defaultPrefix = 'photo') => {
  if (!photoObj) return;
  const uri = typeof photoObj === 'string' ? photoObj : photoObj.uri;
  const isPng = uri.toLowerCase().includes('.png');
  const ext = isPng ? 'png' : 'jpg';
  const mimeType = isPng ? 'image/png' : 'image/jpeg';
  const fileName = `${defaultPrefix}.${ext}`;

  if (Platform.OS === 'web' || uri.startsWith('data:') || uri.startsWith('blob:') || uri.startsWith('http://') || uri.startsWith('https://')) {
    const res = await fetch(uri);
    const blob = await res.blob();
    fd.append(fieldName, blob, fileName);
  } else {
    fd.append(fieldName, {
      uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
      name: fileName,
      type: mimeType,
    });
  }
};
