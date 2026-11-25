/** 告知の正本は release-notes.json。運用は docs/RELEASE_NOTES_GUIDE.md を参照。 */
import notes from './release-notes.json';

export type ReleaseChangeType = 'added' | 'improved' | 'fixed' | 'removed';

export interface ReleaseNote {
  id: string;
  sequence: number;
  title: string;
  date: string;
  /** 技術的な版の対応情報。告知の表示条件には使わない。 */
  version?: string;
  notification: 'badge' | 'none';
  changes: { type: ReleaseChangeType; text: string }[];
}

// JSONの構造・重複・並び順はビルド前のcheck:releasesで検証する。
export const RELEASE_NOTES = notes as readonly ReleaseNote[];

export const RELEASE_CHANGE_LABELS: Record<ReleaseChangeType, string> = {
  added: '新機能',
  improved: '改善',
  fixed: '修正',
  removed: '提供終了',
};
