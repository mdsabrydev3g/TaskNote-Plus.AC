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
import { TaskNoteApi, type TaskDto } from '../api';
import { messageForError } from '../errors';
import type { Dict, Locale } from '../i18n';
import { card, colors, input, rtlStyle, textStyle } from '../theme';
import { formatDue } from './TodayScreen';

const FILTERS = ['open', 'today', 'done'] as const;
type Filter = (typeof FILTERS)[number];

export function TasksScreen({ api, dict, locale }: { api: TaskNoteApi; dict: Dict; locale: Locale }) {
  const isRtl = locale === 'ar';
  const [filter, setFilter] = useState<Filter>('open');
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [quick, setQuick] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (next: Filter) => {
      setError(null);
      try {
        setTasks(await api.listTasks(next));
      } catch (caught) {
        setError(messageForError(caught, dict));
      }
    },
    [api, dict],
  );

  useEffect(() => {
    void load(filter);
  }, [load, filter]);

  const add = async () => {
    if (quick.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      // The server parses Arabic and English dates, priorities and energy tags.
      await api.quickAdd(quick.trim());
      setQuick('');
      await load(filter);
    } catch (caught) {
      setError(messageForError(caught, dict));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (task: TaskDto) => {
    try {
      await api.updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done' });
      await load(filter);
    } catch (caught) {
      setError(messageForError(caught, dict));
    }
  };

  const remove = async (task: TaskDto) => {
    try {
      await api.deleteTask(task.id);
      await load(filter);
    } catch (caught) {
      setError(messageForError(caught, dict));
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        data={tasks}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={{ marginBottom: 14, gap: 12 }}>
            <View style={card}>
              <Text style={[{ fontSize: 13, color: colors.muted, marginBottom: 8 }, textStyle(isRtl)]}>
                {dict.quickAdd}
              </Text>
              <View style={[rtlStyle(isRtl), { gap: 8 }]}>
                <TextInput
                  value={quick}
                  onChangeText={setQuick}
                  placeholder={dict.capturePlaceholder}
                  placeholderTextColor={colors.muted}
                  style={[input, textStyle(isRtl), { flex: 1 }]}
                  onSubmitEditing={add}
                  returnKeyType="done"
                />
                <Pressable
                  onPress={add}
                  disabled={busy}
                  style={{
                    backgroundColor: busy ? colors.muted : colors.brand,
                    borderRadius: 12,
                    paddingHorizontal: 18,
                    justifyContent: 'center',
                  }}
                >
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff' }}>{dict.create}</Text>}
                </Pressable>
              </View>
            </View>

            <View style={[rtlStyle(isRtl), { gap: 8 }]}>
              {FILTERS.map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setFilter(value)}
                  style={{
                    borderWidth: 1,
                    borderColor: filter === value ? colors.brand : colors.line,
                    backgroundColor: filter === value ? '#eef4ff' : 'transparent',
                    borderRadius: 999,
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{ fontSize: 12, color: filter === value ? colors.brandDark : colors.muted }}>
                    {value === 'open' ? dict.todo : value === 'today' ? dict.today : dict.done}
                  </Text>
                </Pressable>
              ))}
            </View>

            {error !== null && <Text style={{ color: colors.danger }}>{error}</Text>}
          </View>
        }
        ListEmptyComponent={
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 20 }}>{dict.emptyTasks}</Text>
        }
        renderItem={({ item }) => (
          <View style={[card, rtlStyle(isRtl), { alignItems: 'center', gap: 10 }]}>
            <Pressable
              onPress={() => void toggle(item)}
              hitSlop={10}
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                borderWidth: 1.5,
                borderColor: item.status === 'done' ? colors.brand : colors.line,
                backgroundColor: item.status === 'done' ? colors.brand : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 12 }}>{item.status === 'done' ? '✓' : ''}</Text>
            </Pressable>

            <View style={{ flex: 1 }}>
              <Text
                style={[
                  { fontSize: 15, color: colors.ink },
                  textStyle(isRtl),
                  item.status === 'done' ? { textDecorationLine: 'line-through', color: colors.muted } : {},
                ]}
              >
                {item.title}
              </Text>
              {item.dueAt !== null && (
                <Text style={{ fontSize: 11, color: colors.muted, marginTop: 3 }}>
                  {dict.due}: {formatDue(item.dueAt, locale)}
                </Text>
              )}
            </View>

            <Pressable onPress={() => void remove(item)} hitSlop={10}>
              <Text style={{ color: colors.muted, fontSize: 15 }}>✕</Text>
            </Pressable>
          </View>
        )}
      />
    </KeyboardAvoidingView>
  );
}
