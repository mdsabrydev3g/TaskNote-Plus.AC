import type { TextStyle, ViewStyle } from 'react-native';

export const colors = {
  surface: '#f8fafc',
  elevated: '#ffffff',
  line: '#e2e8f0',
  ink: '#0f172a',
  muted: '#64748b',
  brand: '#3c60ee',
  brandDark: '#2033ac',
  success: '#0f7a52',
  danger: '#b42318',
  warn: '#a1620a',
};

/**
 * Arabic is the default, so RTL is expressed with explicit style values rather
 * than I18nManager.forceRTL (which only takes effect after an app reload).
 */
export function rtlStyle(isRtl: boolean): ViewStyle {
  return { flexDirection: isRtl ? 'row-reverse' : 'row' };
}

export function textStyle(isRtl: boolean): TextStyle {
  return { textAlign: isRtl ? 'right' : 'left', writingDirection: isRtl ? 'rtl' : 'ltr' };
}

export const card: ViewStyle = {
  backgroundColor: colors.elevated,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: colors.line,
  padding: 14,
  marginBottom: 12,
};

export const input = {
  borderWidth: 1,
  borderColor: colors.line,
  borderRadius: 12,
  paddingHorizontal: 12,
  paddingVertical: 10,
  backgroundColor: colors.elevated,
  color: colors.ink,
  fontSize: 15,
};
