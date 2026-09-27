import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { TaskNoteApi, type InboxItemDto, type TaskDto } from '../api';
import { messageForError } from '../errors';
import type { Dict, Locale } from '../i18n';
import { card, colors, rtlStyle, textStyle } from '../theme';

export function TodayScreen({
  api,
  dict,
  locale,
  onToggleTask,
}: {
  api: TaskNoteApi;
  dict: Dict;
  locale: Locale;
  onToggleTask: (task: TaskDto) => Promise<void>;
}) {
  const isRtl = locale === 'ar';
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [inbox, setInbox] = useState<InboxItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [todayTasks, inboxItems] = await Promise.all([api.listTasks('today'), api.listInbox()]);
      setTasks(todayTasks.length > 0 ? todayTasks : await api.listTasks('open'));
      setInbox(inboxItems);
    } catch (caught) {
      setError(messageForError(caught, dict));
    } finally {
      setLoading(false);
    }
  }, [api, dict]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.brand} />
        <Text style={{ color: colors.muted, marginTop: 10 }}>{dict.loading}</Text>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      data={tasks}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 8 }}>
          <View style={[rtlStyle(isRtl), { gap: 10 }]}>
            <Stat label={dict.inbox} value={inbox.length} />
            <Stat label={dict.tasks} value={tasks.length} />
          </View>
          <Text style={[{ fontSize: 17, fontWeight: '700', color: colors.ink }, textStyle(isRtl)]}>{dict.today}</Text>
          {error !== null && <Text style={{ color: colors.danger }}>{error}</Text>}
        </View>
      }
      ListEmptyComponent={
        <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 24 }}>{dict.emptyTasks}</Text>
      }
      renderItem={({ item }) => (
        <View style={[card, rtlStyle(isRtl), { alignItems: 'center', gap: 10 }]}>
          <Pressable
            onPress={() => void onToggleTask(item)}
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
            <View style={[rtlStyle(isRtl), { gap: 8, marginTop: 4 }]}>
              <Meta text={energyLabel(item.energy, dict)} />
              {item.priority > 1 && <Meta text={`P${item.priority}`} />}
              {item.dueAt !== null && <Meta text={formatDue(item.dueAt, locale)} />}
            </View>
          </View>
        </View>
      )}
    />
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={[card, { flex: 1, alignItems: 'center' }]}>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: colors.ink, fontSize: 22, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}

function Meta({ text }: { text: string }) {
  return (
    <Text
      style={{
        fontSize: 11,
        color: colors.muted,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 1,
      }}
    >
      {text}
    </Text>
  );
}

function energyLabel(energy: TaskDto['energy'], dict: Dict): string {
  if (energy === 'deep') return dict.energyDeep;
  if (energy === 'light') return dict.energyLight;
  return dict.energyAdmin;
}

export function formatDue(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
