// services/openaiClient.js
// Universal compat shim: guarantees `loadOpenAISettings` exists for ANY import style.
// Works with ESM (default, named, wildcard) and CommonJS `require()`.

import AsyncStorage from '@react-native-async-storage/async-storage';

// ----- internal helpers -----
async function readKey(k) {
  try {
    const v = await AsyncStorage.getItem(k);
    return v ?? '';
  } catch {
    return '';
  }
}

export async function loadOpenAISettings() {
  // 1) From Setup screen (AsyncStorage)
  const storedKey = await readKey('openai:apiKey');
  const storedModel = await readKey('openai:model');

  // 2) From Expo extras (dev/EAS)
  let extraKey = '';
  let extraModel = '';
  try {
    const Constants = require('expo-constants').default;
    const extra =
      (Constants?.expoConfig && Constants.expoConfig.extra) ||
      (Constants?.manifest2 && Constants.manifest2.extra) ||
      {};
    extraKey = extra.OPENAI_API_KEY || '';
    extraModel = extra.OPENAI_MODEL || '';
  } catch {
    // expo-constants may not exist in some environments
  }

  const apiKey = storedKey || extraKey || '';
  const model = storedModel || extraModel || 'gpt-4o-mini';

  return { apiKey, model, endpoint: undefined };
}

// ----- default export object (so `import openaiClient from ...` works) -----
const api = { loadOpenAISettings };
export default api;

// ----- CommonJS interop (so `require()` and mixed forms work) -----
try {
  // eslint-disable-next-line no-undef
  if (typeof module !== 'undefined' && module.exports) {
    // eslint-disable-next-line no-undef
    module.exports = api;                     // require('./openaiClient') -> { loadOpenAISettings }
    // eslint-disable-next-line no-undef
    module.exports.loadOpenAISettings = loadOpenAISettings; // require('./openaiClient').loadOpenAISettings
    // eslint-disable-next-line no-undef
    module.exports.default = api;             // require('./openaiClient').default.loadOpenAISettings
  }
} catch {}

