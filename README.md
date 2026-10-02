# ひびゆいFC サッカーがくえん

小2(ゆいと)・小4(ひびと)向けの予習復習PWA。サッカー風ゲーミフィケーション付き。

## 動かす
```
npm start     # http://localhost:8080
npm test      # 出題ジェネレーターの検算(1万8千問)
```

## 構成
- `gen.js` … 算数の出題。答えはコードで計算。誤答選択肢に「つまずき原因タグ」付き
- `app.js` … 画面・ポイント・ランク・かくれステージ・パパにきく
- 保存先は各端末の localStorage(兄弟それぞれのスマホで別々に記録)

## 公開(GitHub Pages)
リポジトリの Settings → Pages → Branch: main / root を選ぶ。
URL をスマホで開き、「ホーム画面に追加」するとアプリとして使える。

## これから
- 国語・生活・理科・社会 … Gemini で毎朝生成(GitHub Actions)→ `data/daily/` に JSON
- 学校の単元は「パパの へや」で手動調整できる

## きょうだい共有(ランク・ゴール数を お互いに見る)
別々のスマホでも相手の記録が見えるように、無料の Firebase Realtime Database を使う。共有するのは名前・ランク・ゴール数・日数だけ。

1. https://console.firebase.google.com でプロジェクトを作る(Googleアナリティクスは不要)
2. 「Realtime Database」→「データベースを作成」(ロケーション: シンガポール `asia-southeast1` など)
3. 「ルール」タブを次に置き換えて公開
   ```json
   {
     "rules": {
       "hibiyui": {
         "$code": {
           ".read": true,
           ".write": true,
           "$kid": { ".validate": "newData.hasChildren(['xp','goals'])" }
         }
       }
     }
   }
   ```
   `hibiyui` の直下には読み取り権限がないので、**家族コードを知らない人は一覧も見られない**(コードは推測されにくい長さにする)。
4. データベースのURL(`https://〇〇-default-rtdb.〇〇.firebasedatabase.app`)をコピー
5. アプリの「パパの へや」→「きょうだいと つなぐ」にURLを入れ、「コードを つくる」→「ほぞん」
6. 「こども用リンクを コピー」して、ひびと・ゆいとのスマホで開く(同じ設定が入る)

開発用: `node scripts/mock-db.mjs`(模擬DB、http://localhost:8787)に向ければ、Firebaseなしで動作確認できる。

## 国語(漢字)を Gemini で毎朝つくる
- `data/kanji.json` … 学年別漢字配当表(1〜4年)。`node scripts/fetch-kanji.mjs` で作成済み
- `data/kokugo-pool.json` … 出題プール。最初は手書きのシード(`node scripts/seed-kokugo.mjs`)、以降は毎朝ふえる
- `scripts/generate-kokugo.mjs` … Gemini に作らせて、**コードで検査してから**プールに追加

**AIの出力を信用しないための検査**(`scripts/lib/kokugo.mjs`)
1. 問題文・解説に、その学年で習っていない漢字があれば不採用(漢字表で機械的に判定)
2. 読みがひらがなだけか、選択肢が重複していないか等の形式チェック
3. 別の呼び出しで同じ問題を解かせ、答えが一致しなければ不採用(二重検算)

**Gemini APIキーの設定**(あなたの操作が必要)
1. https://aistudio.google.com/apikey でキーを作る(無料)
2. GitHub のリポジトリ → Settings → Secrets and variables → Actions → New repository secret
   名前 `GEMINI_API_KEY`、値にキーを貼る(**チャットやコードには書かない**)
3. Actions タブ → daily-kokugo → Run workflow で試す。結果は `data/last-run.json` に残る
- モデルは自動で選ばれる(固定したいときは Secret ではなく環境変数 `GEMINI_MODEL`)
- 無料枠では、送った内容が Google のモデル改善に使われうる。**送るのは漢字の一覧と問題文だけ**で、子どもの情報は送らない
- 手元で試す: `GEMINI_API_KEY=... node scripts/generate-kokugo.mjs --grades 2 --count 4`
