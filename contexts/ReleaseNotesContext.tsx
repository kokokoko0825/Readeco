import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { RELEASE_NOTES } from '@/constants/release-notes';
import { useAuth } from '@/contexts/AuthContext';
import { createReleaseNotesStore, hasNewReleaseNotes } from '@/utils/release-notes-store';

const store = createReleaseNotesStore(AsyncStorage, RELEASE_NOTES);
const latestSequence = Math.max(0, ...RELEASE_NOTES.map((note) => note.sequence));

interface ReleaseNotesContextType {
  showReleaseNotes: () => void;
  hasNewReleases: boolean;
  markReleasesSeen: () => Promise<void>;
}

const ReleaseNotesContext = createContext<ReleaseNotesContextType | null>(null);

export function useReleaseNotes() {
  const context = useContext(ReleaseNotesContext);
  if (!context) throw new Error('useReleaseNotes must be used within a ReleaseNotesProvider');
  return context;
}

export function ReleaseNotesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.uid;
  const [position, setPosition] = useState<{ userId: string; sequence: number } | null>(null);
  const ready = !!userId && position?.userId === userId;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    store.load(userId).then((sequence) => {
      if (active) setPosition((previous) => ({
        userId,
        sequence: previous?.userId === userId ? Math.max(previous.sequence, sequence) : sequence,
      }));
    }).catch((error) => {
      // 保存できなくても履歴は読める。架空の確認位置は作らない。
      console.warn('Could not load release note position', error);
    });
    return () => { active = false; };
  }, [userId]);

  const markReleasesSeen = useCallback(async () => {
    if (!ready || !userId) return;
    try {
      const sequence = await store.markSeen(userId, latestSequence);
      setPosition((previous) => previous?.userId === userId
        ? { userId, sequence: Math.max(previous.sequence, sequence) }
        : previous);
    } catch (error) {
      console.warn('Could not save release note position', error);
    }
  }, [ready, userId]);

  const showReleaseNotes = useCallback(() => { router.push('/updates'); }, []);
  const hasNewReleases = ready && position !== null && hasNewReleaseNotes(RELEASE_NOTES, position.sequence);

  return (
    <ReleaseNotesContext.Provider value={{ showReleaseNotes, hasNewReleases, markReleasesSeen }}>
      {children}
    </ReleaseNotesContext.Provider>
  );
}
