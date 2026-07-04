/**
 * リリースノートデータ
 *
 * 新しいバージョンをリリースする際は、このファイルの RELEASE_NOTES 配列の
 * 先頭に新しいエントリを追加するだけでOKです。
 *
 * app.json の version は自動的に取得されるため、
 * ここで指定した最新バージョンと app.json の version が一致していれば
 * 自動的にリリースノートが表示されます。
 */

import Constants from 'expo-constants';

export interface ReleaseNote {
  version: string;
  date: string;
  changes: string[];
}

/**
 * リリースノートデータ
 * 新しいバージョンは配列の先頭に追加してください
 */
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.1.3',
    date: '2026-07-04',
    changes: [
      'バグ修正: 楽天ブックスAPIの新エンドポイントに対応し、本の検索・新刊情報の取得を復旧しました。',
      '改善: 楽天APIの新認証方式（accessKey）に対応しました。',
    ],
  },
];

/**
 * 現在のアプリバージョン（app.json から自動取得）
 */
export const APP_VERSION = Constants.expoConfig?.version || '1.0.0';

/**
 * 最新のリリースノートバージョン
 */
export const LATEST_RELEASE_VERSION = RELEASE_NOTES[0]?.version || '1.0.0';

/**
 * 指定バージョンのリリースノートを取得
 */
export function getReleaseNoteByVersion(version: string): ReleaseNote | undefined {
  return RELEASE_NOTES.find((note) => note.version === version);
}

/**
 * 指定バージョン以降のリリースノートを取得（新しい順）
 */
export function getReleaseNotesSince(version: string): ReleaseNote[] {
  const index = RELEASE_NOTES.findIndex((note) => note.version === version);
  if (index === -1) {
    // バージョンが見つからない場合は全て返す
    return RELEASE_NOTES;
  }
  return RELEASE_NOTES.slice(0, index);
}
