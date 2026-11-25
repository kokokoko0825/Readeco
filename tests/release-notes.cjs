const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

// Node >=22.18の組み込みTypeScript型除去を利用。アプリ依存は読み込まない。
const { createReleaseNotesStore, hasNewReleaseNotes, releaseNotesStorageKey, LEGACY_RELEASE_VERSION_KEY } = require('../utils/release-notes-store.ts');
const { validateReleaseNotes } = require('../scripts/check-release-notes.cjs');
const { writeServiceWorker } = require('../scripts/write-service-worker.cjs');
const notes = require('../constants/release-notes.json');
const latest = notes[0].sequence;

function memoryStorage(entries = []) {
  const values = new Map(entries);
  return {
    values,
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
  };
}

test('初回は現在の位置から開始し、過去分を新着にしない', async () => {
  const storage = memoryStorage();
  const store = createReleaseNotesStore(storage, notes);
  const position = await store.load('new-user');
  assert.equal(position, latest);
  assert.equal(hasNewReleaseNotes(notes, position), false);
});

test('既存7版の確認位置を移行し、履歴を開くまで新着を消さない', async () => {
  for (const note of notes.filter((note) => note.id.startsWith('legacy-'))) {
    const storage = memoryStorage([[LEGACY_RELEASE_VERSION_KEY, note.version]]);
    const store = createReleaseNotesStore(storage, notes);
    assert.equal(await store.load('existing'), note.sequence);
    assert.equal(hasNewReleaseNotes(notes, note.sequence), true);
    assert.equal(storage.values.get(releaseNotesStorageKey('existing')), String(note.sequence));
    await store.markSeen('existing', latest);
    assert.equal(await store.load('existing'), latest);
    assert.equal(storage.values.get(LEGACY_RELEASE_VERSION_KEY), note.version);
  }
});

test('アカウントを切り替えても確認位置を共有しない', async () => {
  const storage = memoryStorage([[LEGACY_RELEASE_VERSION_KEY, '1.1.4']]);
  const store = createReleaseNotesStore(storage, notes);
  await Promise.all([store.load('a'), store.load('b')]);
  await store.markSeen('a', latest);
  assert.equal(await store.load('a'), latest);
  assert.equal(await store.load('b'), 2);
});

test('ロールバックと再配信で確認位置を戻さない', async () => {
  const storage = memoryStorage([[releaseNotesStorageKey('a'), String(latest + 2)]]);
  const store = createReleaseNotesStore(storage, notes);
  assert.equal(await store.load('a'), latest + 2);
  assert.equal(await store.markSeen('a', latest), latest + 2);
  assert.equal(hasNewReleaseNotes(notes, latest + 2), false);
  const newer = [{ ...notes[0], id: 'future', sequence: latest + 3 }, ...notes];
  assert.equal(hasNewReleaseNotes(newer, latest + 2), true);
});

test('新着通知なしの告知はバッジを増やさない', () => {
  assert.equal(hasNewReleaseNotes([{ ...notes[0], notification: 'none' }], latest - 1), false);
  assert.equal(hasNewReleaseNotes(notes, 0), true);
});

test('不正な保存値と未知の旧版は初期位置へ安全に移行する', async () => {
  for (const value of ['-1', '1.5', '', 'NaN', 'Infinity', ' 3', '9007199254740992']) {
    const storage = memoryStorage([[releaseNotesStorageKey('a'), value], [LEGACY_RELEASE_VERSION_KEY, 'unknown']]);
    assert.equal(await createReleaseNotesStore(storage, notes).load('a'), latest);
  }
});

test('初期化と確認操作が重なっても古い書き込みが最後に残らない', async () => {
  const storage = memoryStorage([[LEGACY_RELEASE_VERSION_KEY, '1.1.4']]);
  let unblock;
  const gate = new Promise((resolve) => { unblock = resolve; });
  const save = storage.setItem;
  let first = true;
  storage.setItem = async (...args) => {
    if (first) { first = false; await gate; }
    return save(...args);
  };
  const store = createReleaseNotesStore(storage, notes);
  const loading = store.load('a');
  const viewing = store.markSeen('a', latest);
  unblock();
  assert.equal(await loading, 2);
  assert.equal(await viewing, latest);
  assert.equal(await store.load('a'), latest);
});

test('保存失敗は既読にせず、後の操作で再試行できる', async () => {
  const storage = memoryStorage([[releaseNotesStorageKey('a'), '2']]);
  const save = storage.setItem;
  storage.setItem = async () => { throw new Error('storage unavailable'); };
  const store = createReleaseNotesStore(storage, notes);
  await assert.rejects(store.markSeen('a', latest), /storage unavailable/);
  assert.equal(await store.load('a'), 2);
  storage.setItem = save;
  assert.equal(await store.markSeen('a', latest), latest);
});

test('表示していない未来の位置は保存しない', async () => {
  const storage = memoryStorage([[releaseNotesStorageKey('a'), '2']]);
  const store = createReleaseNotesStore(storage, notes);
  for (const value of [-1, 1.5, NaN, latest + 1]) {
    await assert.rejects(store.markSeen('a', value), /Invalid/);
  }
  assert.equal(await store.load('a'), 2);
});

test('実データを検証でき、重複・逆順・空本文・不正日付を拒否する', () => {
  assert.deepEqual(validateReleaseNotes(notes), []);
  const copy = structuredClone(notes);
  copy[1].id = copy[0].id;
  copy[1].sequence = copy[0].sequence;
  copy[1].date = '2026-02-30';
  copy[1].notification = 'bad';
  copy[1].changes[0] = { type: 'bad', text: ' ' };
  const errors = validateReleaseNotes(copy).join('\n');
  for (const expected of ['IDが重複', 'sequence', '実在する日付', 'notification', '種別・本文']) {
    assert.ok(errors.includes(expected), expected);
  }
  assert.ok(validateReleaseNotes([{ ...notes[0], date: '2025-02-29' }]).length);
  assert.deepEqual(validateReleaseNotes([{ ...notes[0], date: '2024-02-29', version: undefined }]), []);
});

test('配信内容・Worker変更でキャッシュ名が変わり、再生成は同じ結果になる', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'readeco-release-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dist = path.join(root, 'dist');
  fs.mkdirSync(dist);
  const template = path.join(root, 'template.js');
  fs.writeFileSync(template, "const CACHE_NAME = 'readeco-pwa-__READECO_BUILD_ID__';");
  fs.writeFileSync(path.join(dist, 'index.html'), 'first build');
  const first = writeServiceWorker(dist, template);
  assert.equal(writeServiceWorker(dist, template), first);
  assert.ok(!fs.readFileSync(path.join(dist, 'service-worker.js'), 'utf8').includes('__READECO_BUILD_ID__'));
  fs.writeFileSync(path.join(dist, 'index.html'), 'second build');
  const second = writeServiceWorker(dist, template);
  assert.notEqual(second, first);
  fs.appendFileSync(template, '\n// Worker changed');
  assert.notEqual(writeServiceWorker(dist, template), second);
});
