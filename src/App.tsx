import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import AppNavigator from './navigation/AppNavigator';
import { Buffer } from 'buffer';
// @ts-ignore
global.Buffer = global.Buffer || Buffer;

export default function App() {
  return <AppNavigator />
}

// export default function App() {
//   return (
//     <View style={styles.container}>
//       <Text>Teretulemas</Text>
//       <StatusBar style="auto" />
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#fff',
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
// });
