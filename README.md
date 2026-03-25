# Drive Annotation App (Image Captioning)

Google Drive内の画像フォルダ（`panorama` / `oral_photo` / `dentalxray`）を選択し、
画像ごとに音声または手入力で所見を登録するアノテーションアプリです。

## できること

- PC / iPhone / iPad からブラウザ利用
- 画像はアプリ内で選択せず、Driveフォルダを選ぶだけ
- 画像ごとに入力済み/未入力を判定して表示
- 入力者（須藤 / 田畑）を選択して記録
- `保存して次の未入力へ` で効率よく進行
- CSVダウンロードは行わず、Google Sheetsに直接蓄積
- 所見カンペを常時表示

## ファイル構成

- `index.html`: 画面エントリ
- `app.js`: Reactロジック（GAS API連携）
- `styles.css`: スタイル
- `gas/Code.gs`: GAS API（フォルダ一覧・画像一覧・保存）
- `gas/README.md`: GAS設定手順

## ローカル起動

```bash
python3 -m http.server 8080
```

ブラウザで `http://127.0.0.1:8080` を開く。

## 運用フロー

1. アプリにGAS WebアプリURLを入力
2. `フォルダ読込` で候補フォルダ取得
3. `panorama` など対象フォルダを選択し `画像読込`
4. 音声入力または手入力で所見を作成
5. `保存して次の未入力へ` を押して進める

## 重要な前提

- Drive画像を表示するため、画像ファイルの共有設定や閲覧権限が必要
- GASコード修正後は必ず `デプロイを更新`
- iOSではマイク権限を許可して利用
