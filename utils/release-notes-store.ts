import type { ReleaseNote } from '../constants/release-notes';

export const LEGACY_RELEASE_VERSION_KEY = '@readeco_last_seen_version';

export function releaseNotesStorageKey(userId: string) {
  return `@readeco_release_notes_seen:${userId}`;
}

interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
}

function parseSequence(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const sequence = Number(value);
  return Number.isSafeInteger(sequence) ? sequence : null;
}

export function hasNewReleaseNotes(notes: readonly ReleaseNote[], lastSeen: number) {
  return notes.some((note) => note.notification === 'badge' && note.sequence > lastSeen);
}

/** UIDごとに読み書きを直列化し、遅れて終わった初期化で確認位置を戻さない。 */
export function createReleaseNotesStore(storage: Storage, notes: readonly ReleaseNote[]) {
  const latestSequence = Math.max(0, ...notes.map((note) => note.sequence));
  const pending = new Map<string, Promise<unknown>>();

  function enqueue<T>(userId: string, operation: () => Promise<T>): Promise<T> {
    const previous = pending.get(userId) ?? Promise.resolve();
    const result = previous.catch(() => undefined).then(operation);
    pending.set(userId, result);
    void result.then(cleanup, cleanup);
    function cleanup() {
      if (pending.get(userId) === result) pending.delete(userId);
    }
    return result;
  }

  async function readPosition(userId: string) {
    const key = releaseNotesStorageKey(userId);
    const saved = parseSequence(await storage.getItem(key));
    // 現在のビルドより大きな値も保持する（ロールバック対応）。
    if (saved !== null) return saved;
    const legacyVersion = await storage.getItem(LEGACY_RELEASE_VERSION_KEY);
    const legacyNote = notes.find((note) => note.version === legacyVersion);
    // 保存値なし・未知の旧版は初期位置を設定する。過去分を新着扱いしない。
    const initialPosition = legacyNote?.sequence ?? latestSequence;
    await storage.setItem(key, String(initialPosition));
    return initialPosition;
  }

  return {
    load: (userId: string) => enqueue(userId, () => readPosition(userId)),
    markSeen: (userId: string, displayedSequence: number) => enqueue(userId, async () => {
      if (!Number.isSafeInteger(displayedSequence) || displayedSequence < 0 || displayedSequence > latestSequence) {
        throw new Error('Invalid displayed release sequence');
      }
      const previous = await readPosition(userId);
      const next = Math.max(previous, displayedSequence);
      if (next !== previous) {
        await storage.setItem(releaseNotesStorageKey(userId), String(next));
      }
      return next;
    }),
  };
}
