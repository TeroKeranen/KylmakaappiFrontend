import React, { useEffect, useState } from "react";
import { View, Text, Button, ActivityIndicator, StyleSheet } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import { apiGet, apiPost } from "../api/client";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: any) {

    const [msg, setMsg] = useState("");
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    useEffect(() => {
        apiGet("/api/hello")
            .then(d => setMsg(d.message))
            .catch(e => setErr(String(e)))
            .finally(() => setLoading(false));
    }, []);

    const sendPost = async () => {
        try {
            const r = await apiPost("/api/echo", {email: "Test@example.com"});
            console.log("Post response", r);
        } catch (error: any) {
            console.log("POst error", error.message)
            
        }
    }

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
      <Button title="Testaa POST" onPress={sendPost} />
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