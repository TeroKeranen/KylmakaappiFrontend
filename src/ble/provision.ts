// src/ble/provision.ts

import { BleManager, Device, ConnectionPriority } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { Platform } from 'react-native';
import { requestBlePermissions } from '../utils/blePermissions';

const SERVICE_UUID = 'cb0f3a50-5b7d-11ee-8c99-0242ac120002';
const RX_UUID      = 'cb0f3d56-5b7d-11ee-8c99-0242ac120002'; // write (with response)
const TX_UUID      = 'cb0f3f7a-5b7d-11ee-8c99-0242ac120002'; // notify

const manager = new BleManager();

function b64FromJson(obj: object) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64');
}
function jsonFromB64(b64: string) {
  return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
}

function matchesDeviceCode(device: Device | null, deviceCode: string) {
  if (!device) return false;
  const name = (device.name || '').toLowerCase().trim();
  const target = `esp32-setup ${deviceCode}`.toLowerCase().trim();
  return !!name && name === target; // täsmäys
}

async function scanForProvisioningDevice(deviceCode: string, timeoutMs = 15000): Promise<Device> {
  await requestBlePermissions();

  return new Promise((resolve, reject) => {
    let done = false;

    manager.startDeviceScan(null, { allowDuplicates: true }, (error, device) => {
      if (done) return;
      if (error) { done = true; manager.stopDeviceScan(); return reject(error); }

      const uuids = (device?.serviceUUIDs || []).map(u => (u || '').toLowerCase());
      const serviceHit = uuids.includes(SERVICE_UUID.toLowerCase());

      // 1) tarkka nimitäsmäys
      if (matchesDeviceCode(device, deviceCode)) {
        done = true; manager.stopDeviceScan(); return resolve(device!);
      }
      // 2) fallback: jos nimi alkaa “esp32-setup” JA service uuid näkyy
      const name = (device?.name || '').toLowerCase().trim();
      if (serviceHit && name.startsWith('esp32-setup')) {
        done = true; manager.stopDeviceScan(); return resolve(device!);
      }
    });

    setTimeout(() => {
      if (done) return;
      done = true;
      manager.stopDeviceScan();
      reject(new Error('Laite ei ole provisiointitilassa (aikakatkaisu).'));
    }, timeoutMs);
  });
}

/** Nopea tarkistus: löytyykö provisioiva laite annetulla koodilla */
export async function isProvisioningAvailable(deviceCode: string, timeoutMs = 5000): Promise<boolean> {
  try {
    await scanForProvisioningDevice(deviceCode, timeoutMs);
    return true;
  } catch {
    return false;
  }
}

/** Lähettää {ssid, pass} ESP32:lle (varmistaa laitekoodin ennen yhteyttä) */
export async function sendWifiCredentials(ssid: string, pass: string, deviceCode: string) {
  if (!ssid) throw new Error('SSID puuttuu');
  if (!deviceCode) throw new Error('Laitekoodi puuttuu');


  const device = await scanForProvisioningDevice(deviceCode);
  const d = await device.connect();

  try {
    if (Platform.OS === 'android') {
      try { await d.requestMTU(247); } catch {}
      try { await d.requestConnectionPriority(ConnectionPriority.High); } catch {}
    }

    await d.discoverAllServicesAndCharacteristics();

    let timeoutId: any;
    let resolved = false;

    const resultPromise = new Promise<{ ok: boolean; ip?: string; error?: string }>((resolve, _reject) => {
      const sub = d.monitorCharacteristicForService(SERVICE_UUID, TX_UUID, (error, ch) => {
        if (resolved) return;
        if (error || !ch?.value) return;

        try {
          const msg = jsonFromB64(ch.value);
          if (typeof msg.ok === 'boolean') {
            resolved = true;
            clearTimeout(timeoutId);
            try { sub?.remove(); } catch {}
            resolve(msg);
          }
        } catch {}
      });

      timeoutId = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        try { sub?.remove(); } catch {}
        resolve({ ok: false, error: 'Provision notify timeout (20s)' });
      }, 20000);
    });

    const payload = b64FromJson({ ssid, pass, code: deviceCode });
    await d.writeCharacteristicWithResponseForService(SERVICE_UUID, RX_UUID, payload);

    return await resultPromise;
  } finally {
    try { await d.cancelConnection(); } catch {}
  }
}