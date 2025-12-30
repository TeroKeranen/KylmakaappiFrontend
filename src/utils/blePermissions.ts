import { PermissionsAndroid, Platform } from 'react-native';

export async function requestBlePermissions() {
  if (Platform.OS !== 'android') return;
  if (Platform.Version >= 31) {
    await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
  } else {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
  }
}
