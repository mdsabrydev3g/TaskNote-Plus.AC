import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { TaskNoteApi, type InboxItemDto } from '../api';
import { messageForError } from '../errors';
import type { Dict, Locale } from '../i18n';
import { card, colors, input, rtlStyle, textStyle } from '../theme';

export function CaptureScreen({
  api,
  dict,
  locale,
  onDataChanged,
}: {
  api: TaskNoteApi;
  dict: Dict;
  locale: Locale;
  onDataChanged: () => void;
}) {
  const isRtl = locale === 'ar';
  const [text, setText] = useState('');
  const [items, setItems] = useState<InboxItemDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await api.listInbox());
    } catch (caught) {
      setError(messageForError(caught, dict));
    }
  }, [api, dict]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const send = async () => {
    if (text.trim().length === 0) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const result = await api.capture(text.trim());
      setStatus(result.status === 'created' ? dict.captured : dict.duplicate);
      setText('');
      await refresh();
      onDataChanged();
    } catch (caught) {
      setError(messageForError(caught, dict));
    } finally {
      setBusy(false);
    }
  };

  const act = async (item: InboxItemDto, action: 'convert-to-task' | 'convert-to-note' | 'discard') => {
    setError(null);
    try {
      await api.convertInbox(item.id, action);
      await refresh();
      onDataChanged();
    } catch (caught) {
      setError(messageForError(caught, dict));
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        data={items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={{ marginBottom: 14 }}>
            <View style={card}>
              <Text style={[{ fontSize: 13, color: colors.muted, marginBottom: 8 }, textStyle(isRtl)]}>
                {dict.capture}
              </Text>
              <TextInput
                value={text}
                onChangeText={setText}
                multiline
                numberOfLines={3}
                placeholder={dict.capturePlaceholder}
                placeholderTextColor={colors.muted}
                style={[input, textStyle(isRtl), { minHeight: 78, textAlignVertical: 'top' }]}
              />
              <View style={[rtlStyle(isRtl), { marginTop: 10, alignItems: 'center', gap: 10 }]}>
                <Pressable
                  onPress={send}
                  disabled={busy || text.trim().length === 0}
                  style={{
                    backgroundColor: busy ? colors.muted : colors.brand,
                    borderRadius: 12,
                    paddingVertical: 11,
                    paddingHorizontal: 22,
                  }}
                >
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>{dict.send}</Text>}
                </Pressable>
                {status !== null && <Text style={{ color: colors.success, fontSize: 12 }}>{status}</Text>}
              </View>
              {error !== null && <Text style={{ color: colors.danger, marginTop: 8 }}>{error}</Text>}
            </View>

            <Text style={[{ fontSize: 15, fontWeight: '700', color: colors.ink }, textStyle(isRtl)]}>{dict.inbox}</Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 20 }}>{dict.emptyInbox}</Text>
        }
        renderItem={({ item }) => (
          <View style={card}>
            <Text style={[{ color: colors.ink, fontSize: 15 }, textStyle(isRtl)]}>{item.rawText}</Text>
            <View style={[rtlStyle(isRtl), { gap: 8, marginTop: 10, flexWrap: 'wrap' }]}>
              <SmallButton label={dict.tasks} primary onPress={() => void act(item, 'convert-to-task')} />
              <SmallButton label={dict.notes} onPress={() => void act(item, 'convert-to-note')} />
              <SmallButton label={dict.delete} onPress={() => void act(item, 'discard')} />
            </View>
          </View>
        )}
      />
    </KeyboardAvoidingView>
  );
}

function SmallButton({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderWidth: 1,
        borderColor: primary ? colors.brand : colors.line,
        backgroundColor: primary ? colors.brand : 'transparent',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 7,
      }}
    >
      <Text style={{ fontSize: 12, color: primary ? '#fff' : colors.ink }}>{label}</Text>
    </Pressable>
  );
}
