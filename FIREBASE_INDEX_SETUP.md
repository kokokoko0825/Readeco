# Firestoreインデックス設定ガイド

書籍一覧を取得する際に、Firestoreの複合インデックスが必要です。

## エラーメッセージ

```
The query requires an index. You can create it here: [リンク]
```

このエラーは、`where`と`orderBy`を同時に使用するクエリで発生します。

## 解決方法

### 方法1: エラーメッセージのリンクから作成（最も簡単）

1. エラーメッセージに表示されているリンクをクリック
2. Firebase Consoleが開き、インデックス作成画面が表示されます
3. 「インデックスを作成」をクリック
4. インデックスの作成が完了するまで待ちます（数分かかる場合があります）

### 方法2: Firebase Consoleから手動で作成

1. Firebase Console (https://console.firebase.google.com/) にアクセス
2. プロジェクトを選択
3. 「Firestore Database」を選択
4. 「インデックス」タブを選択
5. 「インデックスを作成」をクリック
6. 以下の設定を入力：
   - **コレクションID**: `books`
   - **フィールドを追加**:
     - フィールド: `userId`、種類: `昇順`
     - フィールド: `addedAt`、種類: `降順`
   - **クエリスコープ**: `コレクション`
7. 「作成」をクリック

### 方法3: firestore.indexes.jsonを使用（推奨）

プロジェクトルートに `firestore.indexes.json` ファイルを作成：

```json
{
  "indexes": [
    {
      "collectionGroup": "books",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "userId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "addedAt",
          "order": "DESCENDING"
        }
      ]
    }
  ]
}
```

その後、Firebase CLIでデプロイ：

```bash
firebase deploy --only firestore:indexes
```

## インデックスの作成状況を確認

1. Firebase Console > Firestore Database > インデックス
2. 作成中のインデックスは「構築中」と表示されます
3. 完了すると「有効」と表示されます

## 注意事項

- インデックスの作成には数分かかる場合があります
- インデックスが作成されるまで、クエリはエラーを返します
- 現在のコードでは、一時的にクライアント側でソートするように修正されているため、インデックスがなくても動作しますが、パフォーマンスのためインデックスの作成を推奨します

## 参考リンク

- [Firestore インデックス](https://firebase.google.com/docs/firestore/query-data/indexing)
- [Firebase Console](https://console.firebase.google.com/)


