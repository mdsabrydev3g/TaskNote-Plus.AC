import * as SecureStore from 'expo-secure-store';

/**
 * The session token lives in the OS keychain/keystore, never in plain storage.
 * A memory fallback keeps the app usable in environments where SecureStore is
 * unavailable (for example a web preview), without silently persisting there.
 */
const TOKEN_KEY = 'tasknote-plus.session-token';

let memoryToken: string | null = null;

export async function saveToken(token: string): Promise<void> {
  memoryToken = token;
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {
    // Kept in memory only.
  }
}

export async function loadToken(): Promise<string | null> {
  try {
    const stored = await SecureStore.getItemAsync(TOKEN_KEY);
    if (stored) {
      memoryToken = stored;
      return stored;
    }
  } catch {
    // fall through to memory
  }
  return memoryToken;
}

export async function clearToken(): Promise<void> {
  memoryToken = null;
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // nothing to do
  }
}
