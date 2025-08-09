import React, { useEffect, useState } from "react";
import { View, Text, Button, ActivityIndicator, StyleSheet } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import { apiGet, apiPost } from "../api/client";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: any) {

    const deviceId = "dev-001"; // sama kuin ESP32 koodissa
    const [ledState, setLedState] = useState<boolean | null>(null);
    const [msg, setMsg] = useState("");
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

      // Hae laitteen tila backendistä
    const fetchState = async () => {
      try {
        const data = await apiGet(`/state/${deviceId}`);
        setLedState(data.state?.led ?? null);
        setErr("");
      } catch (e: any) {
        setErr(String(e));
      } finally {
        setLoading(false);
      }
    };

      // Kun ruutu avataan, haetaan tila
    useEffect(() => {
      fetchState();
    }, []);


    const toggleLed = async (on: boolean) => {
      try {
        await apiPost("/led", { deviceId, state: on ? "on" : "off" });
        setLedState(on); // päivitetään heti
      } catch (e: any) {
        setErr(String(e));
      }
    };


    if (loading) {
        return <View style={{ flex:1, justifyContent:"center", alignItems:"center" }}>
          <ActivityIndicator />
          <Text>Ladataan…</Text>
        </View>;
      }

  return (
    <View style={styles.container}>
      <Text>Etusivus</Text>
      {err ? <Text style={{color: "red"}}>{err}</Text> : <Text>{msg}</Text>}

      <Text>LED tila: {ledState === null ? "Tuntematon" : ledState ? "Päällä" : "Pois"}</Text>

      <Button title="LED ON"  onPress={() => toggleLed(true)} />
      <View style={{ height: 8 }} />
      <Button title="LED OFF" onPress={() => toggleLed(false)} />

      <View style={{ height: 16 }} />

      
      {/* <Button title="Mene Login-sivulle" onPress={() => navigation.navigate("Login")} /> */}
    </View>
  );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    }
})