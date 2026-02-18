# マルチテナント設計

> **フェーズ**: 別フェーズで実装予定（PoC 初期スコープ外）

## 1. 概要

本システムをマルチテナント（複数企業）で運用する際に、テナント間のアクセス分離を担保するための設計。

### 要件

- フロントエンドはマルチテナントで実装し、複数企業が利用する
- 企業ごとに生成した microVM の成果物が、他企業からアクセスできてはならない

## 2. 分離レイヤー

### 2.1 microVM レベル（e2b 基盤が担保）

各 sandbox は Firecracker microVM で完全に隔離される。

- sandbox 間のネットワーク通信は不可（互いの存在を認識しない）
- ファイルシステムも完全に独立
- sandbox ID はランダム文字列で推測困難

### 2.2 公開 URL レベル（e2b 機能で担保）

sandbox の公開 URL にトークン認証を適用する。

```javascript
// sandbox 作成時に認証を有効化
const sandbox = await Sandbox.create({
  network: { allowPublicTraffic: false }
})

// トークンは作成直後にプロパティとして取得可能
const token = sandbox.trafficAccessToken
```

- `allowPublicTraffic: false` を設定すると、全リクエストに `e2b-traffic-access-token` ヘッダーが必要になる
- トークンなしのアクセスは 403 Forbidden
- トークンは sandbox ごとに自動生成（カスタム値の指定は不可）

### 2.3 アプリケーションレベル（自前実装が必要）

バックエンドでテナントと sandbox の紐づけを管理し、認可チェックを行う。

```
企業A → フロントエンド → バックエンド → 企業Aのsandboxのみ参照可
企業B → フロントエンド → バックエンド → 企業Bのsandboxのみ参照可
```

#### 必要な管理項目

| 管理対象 | 内容 |
|---|---|
| テナントID - sandbox ID 紐づけ | どの sandbox がどの企業のものか |
| trafficAccessToken の保持 | テナントごとのトークンをバックエンドで管理 |
| プロキシでの認可チェック | リクエスト元テナントが sandbox の所有者か検証 |

## 3. プレビューアクセスの構成

`e2b-traffic-access-token` はカスタムヘッダーのため、ブラウザから直接アクセスできない。
バックエンドにプロキシを設置し、ヘッダーを付与する構成が必要。

```
ブラウザ(iframe)
  → バックエンドプロキシ（認証チェック + トークンヘッダー付与）
    → https://3000-{sandboxId}.e2b.app
```

## 4. 脅威と対策のまとめ

| 脅威 | リスク | 対策 |
|---|---|---|
| 企業Aが企業Bの microVM に侵入 | **不可能** | Firecracker による VM レベル隔離 |
| 企業Aが企業Bのプレビュー URL にアクセス | **防止可能** | `allowPublicTraffic: false` + トークン認証 |
| 企業Aが企業Bの sandbox ID を推測 | **実質不可能** | ランダム ID + トークン認証の二重防御 |
| バックエンド経由での不正アクセス | **防止可能** | テナント-sandbox 紐づけの認可チェック |

## 5. PoC からの移行時の実装タスク

- [ ] テナント管理機能（テナント CRUD）
- [ ] 認証基盤の導入（OAuth / SSO 等）
- [ ] sandbox 作成時の `allowPublicTraffic: false` 適用
- [ ] テナント-sandbox 紐づけの永続化（DB）
- [ ] プレビュー用プロキシの実装（トークンヘッダー付与）
- [ ] テナント単位のアクセスログ
