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
import { TaskNoteApi, type NoteDto } from '../api';
import { messageForError } from '../errors';
import type { Dict, Locale } from '../i18n';
import { card, colors, input, rtlStyle, textStyle } from '../theme';

export function NotesScreen({ api, dict, locale }: { api: TaskNoteApi; dict: Dict; locale: Locale }) {
  const isRtl = locale === 'ar';
  const [notes, setNotes] = useState<NoteDto[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setNotes(await api.listNotes());
    } catch (caught) {
      setError(messageForError(caught, dict));
    }
  }, [api, dict]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (title.trim().length === 0 && body.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await api.createNote({ title: title.trim(), body: body.trim() });
      setTitle('');
      setBody('');
      await load();
    } catch (caught) {
      setError(messageForError(caught, dict));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        data={notes}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={{ marginBottom: 14 }}>
            <View style={card}>
              <Text style={[{ fontSize: 13, color: colors.muted, marginBottom: 8 }, textStyle(isRtl)]}>
                {dict.newNote}
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={dict.noteTitle}
                placeholderTextColor={colors.muted}
                style={[input, textStyle(isRtl), { marginBottom: 8 }]}
              />
              <TextInput
                value={body}
                onChangeText={setBody}
                multiline
                placeholder={dict.noteBody}
                placeholderTextColor={colors.muted}
                style={[input, textStyle(isRtl), { minHeight: 90, textAlignVertical: 'top' }]}
              />
              <View style={[rtlStyle(isRtl), { marginTop: 10 }]}>
                <Pressable
                  onPress={create}
                  disabled={busy}
                  style={{
                    backgroundColor: busy ? colors.muted : colors.brand,
                    borderRadius: 12,
                    paddingVertical: 11,
                    paddingHorizontal: 22,
                  }}
                >
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>{dict.create}</Text>}
                </Pressable>
              </View>
              {error !== null && <Text style={{ color: colors.danger, marginTop: 8 }}>{error}</Text>}
            </View>

            <Text style={[{ fontSize: 15, fontWeight: '700', color: colors.ink }, textStyle(isRtl)]}>{dict.notes}</Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 20 }}>{dict.emptyNotes}</Text>
        }
        renderItem={({ item }) => (
          <View style={card}>
            <Text style={[{ fontSize: 15, fontWeight: '600', color: colors.ink }, textStyle(isRtl)]}>
              {item.pinned ? '📌 ' : ''}
              {item.title.length > 0 ? item.title : dict.newNote}
            </Text>
            {item.body.length > 0 && (
              <Text
                numberOfLines={3}
                style={[{ fontSize: 13, color: colors.muted, marginTop: 6 }, textStyle(isRtl)]}
              >
                {item.body}
              </Text>
            )}
          </View>
        )}
      />
    </KeyboardAvoidingView>
  );
}
