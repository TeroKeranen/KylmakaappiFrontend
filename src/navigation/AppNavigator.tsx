import React from 'react';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import CustomerScreen from '../screens/CustomerScreen';

export type RootStackParamList = {
    Home: undefined;
    Customer:{code?: string} | undefined;
};


const Stack = createNativeStackNavigator<RootStackParamList>();

// Deeplinking-konfig: kylmakaappi://device?code=DEV-001 → Customer-screen
const linking: LinkingOptions<RootStackParamList> = {
    // Huom. tämä on custom-skeema (toimii heti ilman Play/App Storea)
    prefixes: ["kylmakaappi://"],
    config: {
      screens: {
        Customer: {
          path: "device",
          // query-paramit: ?code=DEV-001 → route.params.code
          parse: {
            code: (v: string) => v,
          },
        },
        Home: "home", // valinnainen reitti polkuun "home"
        // Login: "login",
      },
    },
  };

export default function AppNavigator() {
    return (
        <NavigationContainer linking={linking}>
            <Stack.Navigator initialRouteName='Customer'>
                <Stack.Screen name="Customer" component={CustomerScreen} />
                <Stack.Screen name="Home" component={HomeScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    )
}

