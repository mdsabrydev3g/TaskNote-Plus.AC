import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { TaskNoteApi } from '../api';
import { messageForError } from '../errors';
import type { Dict, Locale } from '../i18n';
import { colors, input, textStyle } from '../theme';

export function LoginScreen({
  api,
  dict,
  locale,
  onSignedIn,
  onToggleLocale,
}: {
  api: TaskNoteApi;
  dict: Dict;
  locale: Locale;
  onSignedIn: (token: string) => void;
  onToggleLocale: () => void;
}) {
  const isRtl = locale === 'ar';
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const session = await api.login(identifier.trim(), password);
      onSignedIn(session.token);
    } catch (caught) {
      setError(messageForError(caught, dict));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: 22, paddingTop: 70, gap: 14 }}>
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 24, fontWeight: '700', color: colors.brand }}>{dict.appName}</Text>
          <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'center' }}>{dict.tagline}</Text>
        </View>

        <Text style={[labelStyle, textStyle(isRtl)]}>{dict.username}</Text>
        <TextInput
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="username"
          placeholderTextColor={colors.muted}
          style={[input, textStyle(isRtl)]}
        />
        <Text style={{ color: colors.muted, fontSize: 11, textAlign: isRtl ? 'right' : 'left' }}>
          {dict.usernameNote}
        </Text>

        <Text style={[labelStyle, textStyle(isRtl)]}>{dict.password}</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor={colors.muted}
          style={[input, textStyle(isRtl)]}
        />

        {error !== null && (
          <Text style={{ color: colors.danger, textAlign: isRtl ? 'right' : 'left' }}>{error}</Text>
        )}

        <Pressable
          onPress={submit}
          disabled={busy || identifier.length === 0 || password.length === 0}
          style={{
            backgroundColor: busy ? colors.muted : colors.brand,
            borderRadius: 12,
            paddingVertical: 13,
            alignItems: 'center',
          }}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>{dict.signIn}</Text>}
        </Pressable>

        <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>{dict.noAccount}</Text>

        <Pressable onPress={onToggleLocale} style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Text style={{ color: colors.brand, fontSize: 13 }}>{locale === 'ar' ? 'English' : 'العربية'}</Text>
        </Pressable>

        <Text style={{ color: colors.muted, fontSize: 11, textAlign: 'center' }}>{dict.offlineNote}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const labelStyle = { fontSize: 12, color: colors.muted, marginBottom: 4 } as const;
