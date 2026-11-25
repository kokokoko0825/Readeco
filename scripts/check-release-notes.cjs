/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');

function validateReleaseNotes(notes) {
  const errors = [];
  if (!Array.isArray(notes) || notes.length === 0) return ['告知を1件以上含む配列が必要です'];
  const ids = new Set();
  let previousSequence = Infinity;
  let previousDate = '9999-12-31';
  const types = new Set(['added', 'improved', 'fixed', 'removed']);
  const fields = new Set(['id', 'sequence', 'title', 'date', 'version', 'notification', 'changes']);
  const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;

  notes.forEach((note, index) => {
    const at = `告知[${index}]`;
    if (!note || typeof note !== 'object' || Array.isArray(note)) {
      errors.push(`${at}: オブジェクトが必要です`);
      return;
    }
    if (Object.keys(note).some((key) => !fields.has(key))) errors.push(`${at}: 未知のフィールドがあります`);
    if (typeof note.id !== 'string' || !/^[a-z0-9][a-z0-9.-]*$/.test(note.id)) errors.push(`${at}: IDは半角英数字・ハイフン・ドットで指定してください`);
    if (ids.has(note.id)) errors.push(`${at}: IDが重複しています`);
    ids.add(note.id);
    if (!Number.isSafeInteger(note.sequence) || note.sequence <= 0 || note.sequence >= previousSequence) {
      errors.push(`${at}: sequenceは正の整数を重複なく新しい順に指定してください`);
    }
    previousSequence = note.sequence;
    if (!nonEmpty(note.title)) errors.push(`${at}: タイトルが空です`);
    if (typeof note.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(note.date) ||
        !Number.isFinite(Date.parse(note.date)) || new Date(note.date).toISOString().slice(0, 10) !== note.date) {
      errors.push(`${at}: 実在する日付をYYYY-MM-DDで指定してください`);
    } else if (note.date > previousDate) {
      errors.push(`${at}: 公開日は新しい順に指定してください`);
    }
    previousDate = note.date;
    if (note.version !== undefined && (typeof note.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(note.version))) {
      errors.push(`${at}: 対応版はx.y.z形式で指定するか省略してください`);
    }
    if (!['badge', 'none'].includes(note.notification)) errors.push(`${at}: notificationはbadgeまたはnoneです`);
    if (!Array.isArray(note.changes) || note.changes.length === 0) {
      errors.push(`${at}: 変更内容を1件以上指定してください`);
    } else {
      note.changes.forEach((change) => {
        if (!change || !types.has(change.type) || !nonEmpty(change.text) ||
            Object.keys(change).some((key) => !['type', 'text'].includes(key))) {
          errors.push(`${at}: 変更内容の種別・本文を確認してください`);
        }
      });
    }
  });
  return errors;
}

if (require.main === module) {
  const root = path.join(__dirname, '..');
  const notes = JSON.parse(fs.readFileSync(path.join(root, 'constants/release-notes.json'), 'utf8'));
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const errors = validateReleaseNotes(notes);
  if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) errors.push('package.jsonのversionをx.y.z形式で指定してください');
  if (app.expo.version !== undefined) errors.push('版の正本はpackage.jsonです。app.jsonへversionを追加しないでください');
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(`Release notes OK (${notes.length}件 / app ${pkg.version})`);
  }
}

module.exports = { validateReleaseNotes };
