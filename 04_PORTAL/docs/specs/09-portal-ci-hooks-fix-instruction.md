# 指示文09：Portal CI（portal-test）の失敗修正

## 目的
GitHub Actions の portal-test が 2026-11-21 に15回連続で失敗した。原因が1か所に特定できているので、それだけを直して CI を緑に戻す。

## 現状の問題（2026-11-21 確認済み）
- 失敗した15回すべて同一エラー。pilot-test と bot-syntax は成功しており、portal-test のみ約1分で失敗する。
- 対象ファイル：`04_PORTAL/src/app/balancer/components/BalancerStadiumView.tsx`
- L47 の useState と L48 の useMemo が、early return の後ろで条件付きに呼ばれているため、react-hooks/rules-of-hooks エラーとなり portal-test が exit code 1 で終了する。

## やること
- [ ] 上記2つのフック（useState / useMemo）を early return より前に移動し、すべての render で同じ順序で呼ばれるようにする
- [ ] 修正後にローカルで `npm run build`（04_PORTAL）が成功することを確認してからプッシュする

## やらないこと
- 挙動・表示・文言の変更はしない（フックの位置を移すだけ）
- 対象ファイル以外を変更しない
- 他プロジェクト（05_PILOT、03_SYSTEMS）のファイルを同じコミットに混ぜない

## 完了条件
- GitHub Actions の portal-test が緑になること
- BalancerStadiumView の表示・動作が修正前と変わらないこと

## 未決事項（エージェントが勝手に決めない）
- なし。判断に迷う点が出たら、実装せず報告すること
