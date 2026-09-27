import Constants from 'expo-constants';

type Extra = { apiBaseUrl?: string };

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/** Overridable from app.json -> expo.extra.apiBaseUrl (e.g. a local dev server). */
export const API_BASE_URL = extra.apiBaseUrl ?? 'https://task-note-plus-ac.vercel.app';
