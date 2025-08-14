import React, { useEffect, useState } from "react";
import { View, Text, Button, ActivityIndicator, StyleSheet, Platform, ScrollView, TextInput } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import EventSource from "react-native-event-source";
import { RootStackParamList } from "../navigation/AppNavigator";
import { apiGet, apiPost, motorRun, BASE_URL } from "../api/client";
import { sendWifiCredentials, isProvisioningAvailable } from "../ble/provision";
import { requestBlePermissions } from "../utils/blePermissions";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const deviceId = "dev-001"; // sama kuin ESP32-koodissa

  const [ledState, setLedState] = useState<boolean | null>(null); // LED päällä/pois/tuntematon
  const [running, setRunning] = useState<boolean>(false);  // Moottorin tila
  const [lastSeen, setLastSeen] = useState<number | null>(null);  // Milloin viimeksi nähty

  const [msg, setMsg] = useState("");  // Mahdollinen viesti
  const [loading, setLoading] = useState(true);  // Näytetäänkö latausikoni
  const [err, setErr] = useState("");  // Virheviesti

    // BLE-provisiointi
    const [deviceCode, setDeviceCode] = useState("");   // <-- käyttäjän syöttämä koodi (esim. dev-001)
    const [ssid, setSsid] = useState("");
    const [wpass, setWpass] = useState("");
    const [provBusy, setProvBusy] = useState(false);
    
    const [provChecking, setProvChecking] = useState(false);
    const [provAvailable, setProvAvailable] = useState(false); // <-- näyttääkö provisiointikortin vai ei

    
  // Alkuhaku + SSE + Android BLE-lupapyyntö
  useEffect(() => {
    const init = async () => {
      try {
        // Android: pyydä BLE-luvat ennen skannausta
        if (Platform.OS === "android") {
          await requestBlePermissions();
        }
        await fetchState();
        // avaa SSE
        const es = new EventSource(`${BASE_URL}/events/${deviceId}`);
        es.addEventListener("message", (ev: any) => {
          try {
            const data = JSON.parse(ev.data);
            const led = data.state?.led;
            setLedState(led === "on");
            setRunning(!!data.state?.running);
            setLastSeen(data.lastSeen ?? null);
          } catch {
            // ignore
          }
        });
        es.addEventListener("error", () => {
          // halutessa: näytä “yhdistetään uudelleen…”
        });
        return () => es.close();
      } catch (e: any) {
        setErr(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    };
    const fetchState = async () => {
      try {
        const data = await apiGet(`/state/${deviceId}`);
        const led = data.state?.led;
        setLedState(led === "on" ? true : led === "off" ? false : null);
        setRunning(!!data.state?.running);
        setLastSeen(data.lastSeen ?? null);
        setErr("");
      } catch (e: any) {
        setErr(String(e));
      }
    };
    // käynnistä
    const cleanup = init();
    return () => {
      // es.close() hoidetaan initin sisällä
      // @ts-ignore
      if (typeof cleanup === "function") cleanup();
    };
  }, []);


  function wifiFriendlyError(msg?: string) {
    // kaikki tyypilliset WiFi-falit laukaisevat saman käyttäjäviestin
    const m = (msg || "").toLowerCase();
    if (
      m.includes("wifi") ||
      m.includes("auth") ||           // authentication failed
      m.includes("password") ||
      m.includes("pass") ||
      m.includes("ssid") ||
      m.includes("timeout")
    ) {
      return "Tarkista Wi-Fi SSID ja salasana.";
    }
    return null;
  }

  async function waitDeviceOnline(deviceId: string, timeoutMs = 25000, sinceMs?: number) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const data = await apiGet(`/state/${deviceId}`);
        const seen = Number(data?.lastSeen ?? 0);
        // hyväksy vain, jos online+ip JA lastSeen on uudempi kuin yrityksen aloitus
        if (data?.state?.online && data?.state?.ip && (!sinceMs || seen > sinceMs)) {
          return data;
        }
      } catch {}
      await new Promise(r => setTimeout(r, 2000));
    }
    return null;
  }



  const toggleLed = async (on: boolean) => {
    try {
      await apiPost("/led", { deviceId, state: on ? "on" : "off" });
      setLedState(on); // optimistinen päivitys; SSE vahvistaa
      setMsg(on ? "LED ON komento lähetetty" : "LED OFF komento lähetetty");
      setErr("");
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  };

  const payAndRun = async () => {
    try {
      await motorRun(deviceId, 5000, "fwd"); // 5s
      setMsg("Moottori 5s komento lähetetty");
      setErr("");
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  };

  const checkProvision = async () => {
    try {
      setProvChecking(true); setErr(""); setMsg("");
      if (!deviceCode.trim()) {
        setErr("Syötä ensin laitteen koodi (esim. dev-001).");
        setProvAvailable(false);
        return;
      }
      const available = await isProvisioningAvailable(deviceCode.trim());
      setProvAvailable(available);
      if (available) {
        setMsg(`Laite "${deviceCode.trim()}" on provisiointitilassa.`);
      } else {
        setErr("Laite ei ole provisiointitilassa. Paina laitteesta lyhyesti BOOT ja yritä uudelleen.");
      }
    } catch (e: any) {
      setErr(String(e?.message || e));
      setProvAvailable(false);
    } finally {
      setProvChecking(false);
    }
  };

// korvaa koko provision-funktio tällä
const provision = async () => {
  try {
    setProvBusy(true); setErr(""); setMsg("");
    if (!deviceCode.trim()) {
      setErr("Syötä laitteen koodi.");
      return;
    }

    const startedAt = Date.now();
    const res = await sendWifiCredentials(ssid.trim(), wpass, deviceCode.trim());

    if (!res.ok) {
      // 1) jos ESP32 antoi virheen, näytä WiFi-ystävällinen viesti kun mahdollista
      const friendly = wifiFriendlyError(res.error);
      if (friendly) {
        setErr(friendly);
        return;
      }

      // 2) fallback vain BLE-notifyn timeouttiin: jos ei tule online tämän yrityksen jälkeen,
      //    tulkitaan WiFi-epäonnistumiseksi -> sama ystävällinen viesti
      if (res.error === "Provision notify timeout (20s)") {
        const confirm = await waitDeviceOnline(deviceId, 25000, startedAt);
        if (confirm) {
          setMsg(`Provision ok! IP: ${confirm.state?.ip ?? "-"}`);
          setProvAvailable(false);
        } else {
          setErr("Tarkista Wi-Fi SSID ja salasana.");
        }
      } else {
        setErr(`Provision epäonnistui: ${res.error ?? "virhe"}`);
      }
      return;
    }

    // Onnistui selvästi BLE:n kautta
    setMsg(`Provision ok! IP: ${res.ip ?? "-"}`);
    setProvAvailable(false);

  } catch (e: any) {
    // Myös yleiset BLE-yhteysvirheet käännetään tarvittaessa WiFi-viestiksi
    const friendly = wifiFriendlyError(String(e?.message || e));
    setErr(friendly ?? String(e?.message || e));
  } finally {
    setProvBusy(false);
  }
};

  

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text>Ladataan…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.container}>
        <Text style={styles.title}>Etusivu!!</Text>

        {err ? <Text style={styles.err}>{err}</Text> : null}
        {msg ? <Text style={styles.msg}>{msg}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Laitteen tila</Text>
          <Text>LED tila: {ledState === null ? "Tuntematon" : ledState ? "Päällä" : "Pois"}</Text>
          <Text>Moottori: {running ? "Käy" : "Pysäytetty"}</Text>
          <Text>Last seen: {lastSeen ? new Date(lastSeen).toLocaleTimeString() : "—"}</Text>

          <View style={styles.btnRow}>
            <View style={styles.btnWrap}>
              <Button title="LED ON" onPress={() => toggleLed(true)} />
            </View>
            <View style={styles.btnWrap}>
              <Button title="LED OFF" onPress={() => toggleLed(false)} />
            </View>
          </View>

          <View style={styles.btnWrapWide}>
            <Button title="Maksa (pyöritä 5s)" onPress={payAndRun} />
          </View>
        </View>

        {/* PROVISION “FINDER” – näkyy aina, mutta itse provisiointikortti renderöidään vain saatavuuden mukaan */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>BLE provisiointi</Text>
          <Text style={styles.hint}>
            Paina laitteesta lyhyesti BOOT, jotta se on provisiointitilassa (nimi: “ESP32-Setup &lt;koodi&gt;”).
          </Text>

          <TextInput
            placeholder="Laitteen koodi (esim. dev-001)"
            value={deviceCode}
            onChangeText={setDeviceCode}
            style={styles.input}
            autoCapitalize="none"
          />

          <View style={styles.btnWrapWide}>
            <Button
              title={provChecking ? "Etsitään…" : "Etsi laite provisiointitilassa"}
              onPress={checkProvision}
              disabled={provChecking || !deviceCode.trim()}
            />
          </View>

          {/* Näytä SSID/salasana-kortti vain jos laite löytyi provisiointitilassa */}
          {provAvailable && (
            <>
              <Text style={[styles.hint, { marginTop: 10 }]}>
                Laite löytyi: {deviceCode}. Syötä Wi-Fi-tiedot ja lähetä.
              </Text>
              <TextInput
                placeholder="SSID"
                value={ssid}
                onChangeText={setSsid}
                style={styles.input}
                autoCapitalize="none"
              />
              <TextInput
                placeholder="Salasana"
                value={wpass}
                onChangeText={setWpass}
                style={styles.input}
                secureTextEntry
              />
              <View style={styles.btnWrapWide}>
                <Button
                  title={provBusy ? "Provision..." : "Lähetä Wi-Fi BLE:n kautta"}
                  onPress={provision}
                  disabled={provBusy || !ssid.trim()}
                />
              </View>
              <Text style={styles.hintSmall}>
                Vihje: jos lähetys epäonnistuu, paina lyhyesti BOOT ja etsi uudelleen.
              </Text>
            </>
          )}
        </View>
        <Button title="Asiakassivu" onPress={() => navigation.navigate("Customer")} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  container: { flex: 1, alignItems: "center", padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  err: { color: "red", marginVertical: 6 },
  msg: { color: "green", marginVertical: 6 },
  card: {
    width: "100%",
    maxWidth: 480,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 12,
    marginVertical: 10,
    backgroundColor: "#fff",
  },
  cardTitle: { fontWeight: "700", marginBottom: 8 },
  hint: { color: "#555", marginBottom: 8 },
  hintSmall: { color: "#777", marginTop: 8, fontSize: 12 },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 6,
  },
  btnRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  btnWrap: { flex: 1 },
  btnWrapWide: { width: "100%", marginTop: 10 },
});