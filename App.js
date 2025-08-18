// App.js
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function App() {
  // Lazy-require to avoid cycles like App.js -> RootNavigator -> ... -> App.js
  const RootNavigator = require('./navigation/RootNavigator').default;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RootNavigator />
    </GestureHandlerRootView>
  );
}
