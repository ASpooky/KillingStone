# KillingStone

## Benchmark

`scripts/generate-bench-fixtures.ts`が、ライセンス上の懸念がない合成画像とランダムなpayloadファイルを`public/bench/`に生成する。

```sh
npm run bench:fixtures  # public/bench/ にキャリア画像とpayload(1KB/100KB/1MB)を生成(通常は一度だけ実行すればよい)
npm run bench            # 生成済みのfixtureを使ってencode/decodeの速度を計測する
```

`npm run bench`は、payloadサイズ(1KB/100KB/1MB) × bitsPerChannel(1/2/4/8)の組み合わせごとに、encode/decodeを5回実行した最速値(ms)を`console.table`で表示する。実行のたびにラウンドトリップ(埋め込み→復号した結果が元のpayloadと一致するか)も検証しており、不一致があれば計測を中断してエラーを出す。

## Web UI

`web/`にブラウザで完結するencode/decode UIがある。`src/core/protocol.ts`と`src/core/steganography.ts`はNode/ブラウザ両方から参照する共通ロジックで、`src/core/encode.ts`/`decode.ts`(Node向け、`canvas`パッケージで画像デコード)と`web/src/browser-image.ts`(ブラウザ向け、`<canvas>`で画像デコード)がそれぞれの実行環境固有の画像読み込み部分を担う。

```sh
cd web
npm install
npm run dev   # 開発サーバーを起動(表示されるURLをブラウザで開く)
npm run build # 本番用に静的ファイルへビルド(dist/)
```

Encodeタブ: キャリア画像・埋め込みたいファイル(複数可)・bitsPerChannel(1〜8)を指定して実行すると、結果画像をプレビューしつつPNGとして保存できる。Decodeタブ: 画像を指定して実行すると埋め込まれていたファイルの一覧が出るので、チェックを付けたものだけ保存できる。
