import React, { useEffect, useState } from "react";
import { View, Text, Button, ActivityIndicator, StyleSheet } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import EventSource from "react-native-event-source";
import { RootStackParamList } from "../navigation/AppNavigator";
import { apiGet, apiPost, motorRun, BASE_URL } from "../api/client";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const deviceId = "dev-001"; // sama kuin ESP32-koodissa

  const [ledState, setLedState] = useState<boolean | null>(null); // LED päällä/pois/tuntematon
  const [running, setRunning] = useState<boolean>(false);  // Moottorin tila
  const [lastSeen, setLastSeen] = useState<number | null>(null);  // Milloin viimeksi nähty

  const [msg, setMsg] = useState("");  // Mahdollinen viesti
  const [loading, setLoading] = useState(true);  // Näytetäänkö latausikoni
  const [err, setErr] = useState("");  // Virheviesti

  // Hae laitteen tila backendistä
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
    } finally {
      setLoading(false);
    }
  };

  // Kun sivu avataan ensimmäisen kerran:
  useEffect(() => {

    fetchState(); // 1) haetaan ensitila

    // 2) Avataan SSE-yhteys backendin /events/:deviceId -endpointtiin
    const es = new EventSource(`${BASE_URL}/events/${deviceId}`);

    // Kun palvelin lähettää uuden "message"-tapahtuman
    es.addEventListener("message", (ev: any) => {
      try {
        const data = JSON.parse(ev.data);
        const led = data.state?.led;
        setLedState(led === "on");
        setRunning(!!data.state?.running);
        setLastSeen(data.lastSeen ?? null);
      } catch {
        // ignoraa
      }
    });
    es.addEventListener("error", () => {
      // halutessa: näytä UI:ssa "yhdistetään uudelleen..."
    });

    return () => es.close();
  }, []);

  const toggleLed = async (on: boolean) => {
    try {
      await apiPost("/led", { deviceId, state: on ? "on" : "off" });
      setLedState(on); // päivitä heti; SSE vahvistaa pian
    } catch (e: any) {
      setErr(String(e));
    }
  };

  const payAndRun = async () => {
    try {
      await motorRun(deviceId, 5000, "fwd"); // 5s
    } catch (e: any) {
      setErr(String(e));
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
    <View style={styles.container}>
      <Text>Etusivu</Text>
      {err ? <Text style={{ color: "red" }}>{err}</Text> : <Text>{msg}</Text>}

      <Text>LED tila: {ledState === null ? "Tuntematon" : ledState ? "Päällä" : "Pois"}</Text>
      <Text>Moottori: {running ? "Käy" : "Pysäytetty"}</Text>
      <Text>
        Last seen: {lastSeen ? new Date(lastSeen).toLocaleTimeString() : "—"}
      </Text>

      <View style={{ height: 12 }} />
      <Button title="LED ON" onPress={() => toggleLed(true)} />
      <View style={{ height: 8 }} />
      <Button title="LED OFF" onPress={() => toggleLed(false)} />

      <View style={{ height: 16 }} />
      <Button title="Maksa (pyöritä 5s)" onPress={payAndRun} />

      {/* <Button title="Mene Login-sivulle" onPress={() => navigation.navigate("Login")} /> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
