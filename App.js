// App.js
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';

// 🔧 HOTFIX: Disable native screens so RNSScreenStackHeaderConfig isn't used.
// After you remove any `pointerEvents` reaching navigator headers, you can
// switch this back to true or delete this line.
enableScreens(false);

export default function App() {
  // Lazy-require to avoid cycles like App.js -> RootNavigator -> ... -> App.js
  const RootNavigator = require('./navigation/RootNavigator').default;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RootNavigator />
    </GestureHandlerRootView>
  );
}
