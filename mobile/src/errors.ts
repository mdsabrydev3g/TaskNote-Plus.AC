import { ApiError } from './api';
import type { Dict } from './i18n';

/** Maps a client error onto a translated, user-safe message. */
export function messageForError(error: unknown, dict: Dict): string {
  if (error instanceof ApiError) {
    if (error.code === 'network_error') return dict.networkError;
    if (error.status === 401) return dict.invalidCredentials;
    return dict.genericError;
  }
  return dict.genericError;
}
