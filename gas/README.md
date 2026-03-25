# GASセットアップ手順（Drive連携版）

## 1. 事前準備

1. Google Driveに対象フォルダを用意（例: `panorama`, `oral_photo`, `dentalxray`）
2. Googleスプレッドシートを新規作成
3. `拡張機能 > Apps Script` を開く
4. `gas/Code.gs` の内容を貼り付けて保存

## 2. フォルダ設定（必要なら）

- 基本はフォルダ名検索で取得します。
- 同名フォルダが複数ある場合は、`Code.gs` の `ROOT_FOLDER_ID` を設定してください。

```javascript
const ROOT_FOLDER_ID = "ここに親フォルダID";
```

## 3. Webアプリとしてデプロイ

1. `デプロイ > 新しいデプロイ`
2. 種類: `ウェブアプリ`
3. 実行ユーザー: `自分`
4. アクセスできるユーザー: `全員（リンクを知っている全員）`
5. デプロイ後、WebアプリURLを控える

## 4. アプリ側で接続

1. Reactアプリを開く
2. `GAS WebアプリURL` にURLを貼る
3. `フォルダ読込` を押す
4. 対象フォルダを選んで `画像読込`
5. 所見を入力し `保存して次の未入力へ`

※ 画像表示は `getImageData` API でDriveから取得します。`Code.gs` 変更後は必ず再デプロイしてください。

## 5. 入力済み判定

- 判定キーは `image_id`
- `annotations` シートの最新レコードを採用
- 既に入力済みの画像は画面で `済` と表示

## 6. トラブル時

- フォルダが出ない: フォルダ名が `TARGET_FOLDER_NAMES` と一致しているか確認
- 画像が見えない: Driveファイル閲覧権限を確認
- 反映されない: Apps Script修正後に `デプロイを更新`
- `getImageData` が効かない: `https://<あなたのexecURL>?action=getImageData&imageId=<画像ID>` を開いて `dataUrl` が返るか確認
- 保存できない: `https://<あなたのexecURL>?action=saveAnnotation&folderId=test&imageId=test&imageName=test.jpg&caption=test` を開いて `ok:true` になるか確認
