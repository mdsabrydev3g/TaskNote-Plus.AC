import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { API_BASE_URL } from './src/config';
import { ApiError, TaskNoteApi, type TaskDto, type UserDto } from './src/api';
import { clearToken, loadToken, saveToken } from './src/session';
import { dictionaries, type Locale } from './src/i18n';
import { colors, rtlStyle, textStyle } from './src/theme';
import { LoginScreen } from './src/screens/LoginScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { CaptureScreen } from './src/screens/CaptureScreen';
import { TasksScreen } from './src/screens/TasksScreen';
import { NotesScreen } from './src/screens/NotesScreen';

type TabKey = 'today' | 'capture' | 'tasks' | 'notes';

export default function App() {
  const [booting, setBooting] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserDto | null>(null);
  const [locale, setLocale] = useState<Locale>('ar');
  const [tab, setTab] = useState<TabKey>('today');
  const [reloadKey, setReloadKey] = useState(0);

  const dict = dictionaries[locale];
  const isRtl = locale === 'ar';

  const api = useMemo(() => new TaskNoteApi(API_BASE_URL, token), [token]);

  // Restore a stored session and prove it is still valid before showing the app.
  useEffect(() => {
    (async () => {
      const stored = await loadToken();
      if (!stored) {
        setBooting(false);
        return;
      }
      try {
        const me = await new TaskNoteApi(API_BASE_URL, stored).me();
        setToken(stored);
        setUser(me.user);
        setLocale(me.user.locale === 'en' ? 'en' : 'ar');
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) await clearToken();
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  const onSignedIn = useCallback(async (nextToken: string) => {
    await saveToken(nextToken);
    setToken(nextToken);
    try {
      const me = await new TaskNoteApi(API_BASE_URL, nextToken).me();
      setUser(me.user);
      setLocale(me.user.locale === 'en' ? 'en' : 'ar');
    } catch {
      // The token is valid enough to use; identity can load on the next call.
    }
  }, []);

  const signOut = useCallback(async () => {
    await clearToken();
    setToken(null);
    setUser(null);
    setTab('today');
  }, []);

  const refresh = useCallback(() => setReloadKey((value) => value + 1), []);

  const toggleTask = useCallback(
    async (task: TaskDto) => {
      await api.updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done' });
      refresh();
    },
    [api, refresh],
  );

  if (booting) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.brand} size="large" />
        <Text style={{ color: colors.muted, marginTop: 12 }}>{dict.loading}</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  if (!token) {
    return (
      <>
        <LoginScreen
          api={api}
          dict={dict}
          locale={locale}
          onSignedIn={(next) => void onSignedIn(next)}
          onToggleLocale={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
        />
        <StatusBar style="auto" />
      </>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <View
        style={[
          {
            paddingHorizontal: 16,
            paddingTop: Platform.OS === 'android' ? 34 : 8,
            paddingBottom: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.line,
            alignItems: 'center',
          },
          rtlStyle(isRtl),
        ]}
      >
        <Text style={{ flex: 1, fontWeight: '700', color: colors.ink }}>
          {dict.appName}
          {user ? `  ·  ${user.name}` : ''}
        </Text>
        <Pressable onPress={() => void signOut()} hitSlop={10}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>{dict.signOut}</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'today' && (
          <TodayScreen key={`today-${reloadKey}`} api={api} dict={dict} locale={locale} onToggleTask={toggleTask} />
        )}
        {tab === 'capture' && (
          <CaptureScreen key={`capture-${reloadKey}`} api={api} dict={dict} locale={locale} onDataChanged={refresh} />
        )}
        {tab === 'tasks' && <TasksScreen key={`tasks-${reloadKey}`} api={api} dict={dict} locale={locale} />}
        {tab === 'notes' && <NotesScreen key={`notes-${reloadKey}`} api={api} dict={dict} locale={locale} />}
      </View>

      <View
        style={[
          {
            borderTopWidth: 1,
            borderTopColor: colors.line,
            backgroundColor: colors.elevated,
            paddingBottom: Platform.OS === 'android' ? 8 : 0,
          },
          rtlStyle(isRtl),
        ]}
      >
        {(['today', 'capture', 'tasks', 'notes'] as TabKey[]).map((key) => {
          const active = tab === key;
          return (
            <Pressable key={key} onPress={() => setTab(key)} style={{ flex: 1, alignItems: 'center', paddingVertical: 12 }}>
              <Text style={{ fontSize: 12, color: active ? colors.brand : colors.muted, fontWeight: active ? '700' : '400' }}>
                {dict[key]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <StatusBar style="auto" />
    </SafeAreaView>
  );
}
