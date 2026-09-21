#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/yt_dlp_cookies.py
--------------------------------------------------------------------------------
yt-dlp へ渡す cookie 設定を、ローカル実行/クラウド実行のどちらでも同じ優先順位で
解決するための共通モジュール。

【なぜ必要か (2026-09-21)】
cookie の設定が3つのスクリプトでバラバラになっており、実質どこにも効いていなかった:
  - `.env` に `YT_DLP_COOKIES_FROM=chrome` が設定されているが、この変数を読むのは
    `03_SYSTEMS/v2_CORE/_LOL/youtube_absorber.py` のみ。これはHANDOVERで
    「重複解析を防ぐため明示的に停止済み」とされている旧処理で、現役ではない。
  - 現役の `scripts/whisper_transcriber.py`(音声DL) と `scripts/extract_video_tactics.py`
    (字幕取得) は cookie 設定を一切読んでいなかった。
  - `scripts/youtube_worker.py` は `YOUTUBE_COOKIES_TXT` のみ読むが、これはGitHub Actions
    のシークレット用で、ローカルの `.env` には存在しない。
つまり「cookieを設定したつもり」が、現役の実行経路には1つも届いていない状態だった。

【ブラウザ直読み(cookiesfrombrowser)の落とし穴】
`cookiesfrombrowser=chrome` は Chrome が起動中だと cookie DB がロックされて
`Could not copy Chrome cookie database` で失敗する(yt-dlp issue #7271)。実測で確認済み。
常用ブラウザでは事実上ほぼ常に失敗するため、ファイル指定(COOKIES_FILE)を最優先にする。

【設定方法(優先順位順)】
1. `YT_DLP_COOKIES_FILE=D:/path/to/cookies.txt`
   ブラウザ拡張等でエクスポートしたNetscape形式のcookies.txtのパス。
   ブラウザ起動中でも使えるため、ローカル運用ではこれを推奨。
2. `YOUTUBE_COOKIES_TXT="<cookies.txtの中身そのもの>"`
   GitHub Actions等のシークレット経由で中身を直接渡す場合(クラウド実行用)。
3. `YT_DLP_COOKIES_FROM=chrome`
   ブラウザから直読み。上記の理由で失敗しやすく、最後の手段。
--------------------------------------------------------------------------------
"""

import os
import tempfile
from pathlib import Path

_TEMP_COOKIE_FILE = None
_BROWSER_COOKIE_USABLE = {}  # ブラウザ名 -> 読み取り可否(プロセス内で1度だけ判定)


def _browser_cookies_usable(browser, verbose=True):
    """
    指定ブラウザから実際に cookie を読み出せるか事前確認する。
    Chrome等が起動中だと cookie DB がロックされて読めない(yt-dlp issue #7271)。
    毎回プローブすると遅いので、プロセス内で結果をキャッシュする。
    """
    if browser in _BROWSER_COOKIE_USABLE:
        return _BROWSER_COOKIE_USABLE[browser]

    usable = False
    try:
        from yt_dlp.cookies import extract_cookies_from_browser
        jar = extract_cookies_from_browser(browser)
        usable = jar is not None
    except Exception as e:
        if verbose:
            print(f"[WARN] [cookie] ブラウザ({browser})のcookie読み取りに失敗: {str(e).splitlines()[0][:110]}")
        usable = False

    _BROWSER_COOKIE_USABLE[browser] = usable
    return usable


def resolve_cookie_file():
    """
    設定に応じて cookies.txt の実ファイルパスを返す。
    ファイル方式が使えない場合は None を返す(呼び出し側でブラウザ直読みへフォールバック)。
    """
    global _TEMP_COOKIE_FILE

    # 1. ファイルパス直接指定(最優先。ブラウザ起動中でも使える)
    path_str = os.environ.get("YT_DLP_COOKIES_FILE")
    if path_str:
        p = Path(path_str.strip().strip('"'))
        if p.exists() and p.stat().st_size > 0:
            return str(p)
        print(f"[WARN] YT_DLP_COOKIES_FILE に指定されたファイルが存在しません: {p}")

    # 2. 中身を環境変数で受け取る(GitHub Actions等のシークレット用)
    content = os.environ.get("YOUTUBE_COOKIES_TXT")
    if content and content.strip():
        if _TEMP_COOKIE_FILE and Path(_TEMP_COOKIE_FILE).exists():
            return _TEMP_COOKIE_FILE
        tmp_path = Path(tempfile.gettempdir()) / "yt_dlp_cookies_shared.txt"
        tmp_path.write_text(content, encoding="utf-8")
        _TEMP_COOKIE_FILE = str(tmp_path)
        return _TEMP_COOKIE_FILE

    return None


def apply_cookie_opts(ydl_opts, verbose=True):
    """
    yt-dlp の Python API 用 opts 辞書へ cookie 設定を追加して返す。
    どの方式が使われたか(あるいは未設定か)を必ずログ出力し、
    「設定したつもりで効いていない」状態に気づけるようにする。
    """
    cookie_file = resolve_cookie_file()
    if cookie_file:
        ydl_opts["cookiefile"] = cookie_file
        if verbose:
            print(f"[INFO] [cookie] cookies.txt を使用します: {cookie_file}")
        return ydl_opts

    browser = os.environ.get("YT_DLP_COOKIES_FROM")
    if browser:
        # ★ フェイルセーフ(2026-09-21): ブラウザ直読みは「起動中だとDBロックで失敗」する。
        # この失敗はyt-dlpの呼び出し全体を落とすため、cookieを付けたせいで
        # 「これまでcookie無しで成功していた字幕取得まで巻き添えで全滅する」という
        # 実測済みの回帰が起きる。実際に読めるか事前に確認し、読めない場合は
        # cookie無しで続行する(=従来どおりの挙動へ安全に縮退させる)。
        if _browser_cookies_usable(browser.strip(), verbose=verbose):
            ydl_opts["cookiesfrombrowser"] = (browser.strip(),)
            if verbose:
                print(f"[INFO] [cookie] ブラウザ({browser})から cookie を読み込みました。")
        elif verbose:
            print(
                f"[WARN] [cookie] ブラウザ({browser})のcookieを読めなかったため、cookie無しで続行します。"
                f"（{browser}を終了するか、cookies.txtをエクスポートして "
                f"YT_DLP_COOKIES_FILE に設定すると403対策が有効になります）"
            )
        return ydl_opts

    if verbose:
        print(
            "[INFO] [cookie] cookie 未設定のまま実行します"
            "（字幕なし動画の音声取得は403で失敗する可能性があります）。"
        )
    return ydl_opts


def get_cookie_cli_args():
    """yt-dlp を CLI 実行する場合に渡す追加引数を返す(youtube_worker.py用)。"""
    cookie_file = resolve_cookie_file()
    if cookie_file:
        return ["--cookies", cookie_file]

    browser = os.environ.get("YT_DLP_COOKIES_FROM")
    # CLI経路も同じフェイルセーフ。読めないブラウザを指定すると yt-dlp 自体が
    # エラー終了し、cookie無しなら成功していた取得まで失敗するため。
    if browser and _browser_cookies_usable(browser.strip()):
        return ["--cookies-from-browser", browser.strip()]

    return []
