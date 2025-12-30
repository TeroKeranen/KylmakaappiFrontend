import React, {useState, useEffect, useRef} from "react";
import { View, Text, Button, ActivityIndicator, StyleSheet, ScrollView, TextInput, Platform } from "react-native";
import EventSource from "react-native-event-source";
import { apiGet, apiPost, BASE_URL, motorPay } from "../api/client";
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from "../navigation/AppNavigator";


/**
 * resolveDeviceId:
 * Asiakas näppäilee tai skannaa KÄYTTÄJÄKOODIN (esim. DEV-001).
 * Backendista voidaan kysyä, mihin laitteeseen (deviceId) tämä koodi kuuluu.
 * Jos backend ei tunne koodia, käytetään koodia sellaisenaan deviceId:nä.
 */
async function resolveDeviceId(customerCode: string): Promise<string> {
    try {
      const data = await apiGet(`/resolve/${encodeURIComponent(customerCode)}`);
      // odotettu muoto: { deviceId: "dev-001" }
      if (data?.deviceId) return String(data.deviceId);
    } catch {}
    // fallback: käytä syötettyä koodia suoraan deviceId:nä
    return customerCode;
  }

  type Props = NativeStackScreenProps<RootStackParamList, 'Customer'>;

export default function CustomerScreen({ navigation, route }: Props) {

  

    const [customerCode, setCustomerCode] = useState("");
    const [deviceId, setDeviceId] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");
    const [msg, setMsg] = useState("");

    const [led, setLed] = useState<boolean | null>(null);
    const [running, setRunning] = useState<boolean>(false);
    const [lastSeen, setLastSeen] = useState<number | null>(null);

    const esRef = useRef<EventSource | null>(null);


        /**
         * Kun tullaan tälle ruudulle deeplinkillä (kylmakaappi://device?code=DEV-001),
         * koodi saapuu route.params.code:na. Silloin:
         *  - asetetaan se tekstikenttään näkyviin
         *  - ja heti yritetään yhdistää (connect(code))
         */
      useEffect(() => {
        const code = route?.params?.code;
        if (typeof code === "string" && code.trim()) {
          setCustomerCode(code);
          // pieni viive UI:lle (ei pakollinen)
          setTimeout(() => connect(code), 0);
        }
        return () => { esRef.current?.close(); };
      // HUOM: riippuvuutena vain route.params.code
      }, [route?.params?.code]);

        /**
       * connect:
       * 1) Varmista että meillä on koodi (näppäilty tai parametreista)
       * 2) Jos backendissä on “resolveri”, muunnetaan koodi deviceId:ksi
       * 3) Haetaan laitteelta viimeisin tila KERRAN (/state)
       * 4) Avataan EventSource (SSE) -live-yhteys, joka puskee päivityksiä sitä mukaa kun laite niistä ilmoittaa
       */

      const connect = async (initialCode?: string) => {
        try {
          setLoading(true); setErr(""); setMsg("");
          const code = (initialCode ?? customerCode).trim();
          if (!code) { setErr("Syötä laitteen koodi tai skannaa QR."); return; }

          // Käännetään koodi deviceId:ksi (tai käytetään sellaisenaan)
          const id = await resolveDeviceId(code);
          console.log("DEVICEid", id);
          setDeviceId(id);
          
          // Haetaan viimeisin tila heti (näytölle näkymään)
          const data = await apiGet(`/state/${id}`);
          const ledState = data?.state?.led;
          setLed(ledState === "on" ? true : ledState === "off" ? false : null);
          setRunning(!!data?.state?.running);
          setLastSeen(data?.lastSeen ?? null);
    
          esRef.current?.close();

          // Avataan uusi EventSource (SSE): tämä pitää “putken” auki palvelimelle,
          // ja kun laitteelta tulee uutta tilaa, se jaetaan heti sovellukselle.
          const es = new EventSource(`${BASE_URL}/events/${id}`);

          // Kun palvelin lähettää viestin (dataa), päivitämme käyttöliittymän
          es.addEventListener("message", (ev: any) => {
            try {
              const d = JSON.parse(ev.data);
              const s = d?.state;
              if (s) {
                const l = s.led;
                setLed(l === "on" ? true : l === "off" ? false : null);
                setRunning(!!s.running);
              }
              setLastSeen(d?.lastSeen ?? null);
            } catch {}
          });
          es.addEventListener("error", () => {});
          esRef.current = es;
    
          setMsg("Yhdistetty laitteeseen.");
        } catch (e: any) {
          setErr(String(e?.message || e));
        } finally {
          setLoading(false);
        }
      };

      const payAndRun = async () => {
        try {
          if (!deviceId) { setErr("Ei laiteyhteyttä. Syötä koodi ja Yhdistä."); return; }
          await motorPay(deviceId, "fwd");   // aja kunnes rajakytkin, sitten cooldown (backend/firmis toteuttaa)
          setMsg("Maksu ok. Moottori käynnistyy…");
          setErr("");
        } catch (e: any) {
          setErr(String(e?.message || e));
        }
      };

      // (Valinnainen) QR-skannauksen “paikka”; lisää oikea lukija halutessasi
      const fakeScan = () => {
        setCustomerCode("DEV-XYZ-123");
      };

    return (
        <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.container}>
          <Text style={styles.title}>Asiakassivu</Text>
          {err ? <Text style={styles.err}>{err}</Text> : null}
          {msg ? <Text style={styles.msg}>{msg}</Text> : null}
  
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Valitse laite</Text>
            <TextInput
              placeholder="Syötä laitteen koodi (asiakaskoodi)"
              value={customerCode}
              onChangeText={setCustomerCode}
              style={styles.input}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <View style={styles.btnRow}>
              <View style={styles.btnWrap}>
                <Button title="Yhdistä" onPress={() => { void connect(customerCode); }} disabled={loading || !customerCode.trim()} />
              </View>
              <View style={styles.btnWrap}>
                <Button title="Skannaa QR" onPress={fakeScan} />
              </View>
            </View>
            {loading && (
              <View style={{ marginTop: 10 }}>
                <ActivityIndicator />
              </View>
            )}
          </View>
  
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Laitteen tila</Text>
            <Text>Laite: {deviceId ?? "—"}</Text>
            <Text>LED: {led === null ? "Tuntematon" : led ? "Päällä" : "Pois"}</Text>
            <Text>Moottori: {running ? "Käy" : "Pysäytetty"}</Text>
            <Text>Last seen: {lastSeen ? new Date(lastSeen).toLocaleTimeString() : "—"}</Text>
  
            <View style={styles.btnWrapWide}>
              <Button title="Maksa (demo) → LED päälle" onPress={payAndRun} disabled={!deviceId} />
            </View>
            </View>
        <Button title="Kotisivu" onPress={() => navigation.navigate("Home")} />
        </View>

        </ScrollView>
    );
    

}

const styles = StyleSheet.create({
    scroll: { flexGrow: 1 },
    container: { flex: 1, alignItems: "center", padding: 16 },
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