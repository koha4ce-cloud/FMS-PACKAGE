## Security
- Passwords are hashed using SHA-256 via the Web Crypto API (`crypto.subtle`)
- This project requires a secure context (HTTPS or localhost) to function correctly

# FMS (Festival Management System)

文化祭向けの業務支援アプリです。  
クラス単位での売上管理・シフト管理・在庫管理を目的として開発しています。

## 概要
- 管理者 / 閲覧者 / 会計（QR経由）で画面と権限を分離
- Firestore を用いたクラス単位のデータ管理
- 学習・デモ用途を想定した構成

## 使用技術
- HTML / CSS / JavaScript（Vanilla）
- Firebase Firestore

## 注意
- 本リポジトリには APIキーや認証情報などの秘匿情報は含まれていません
- config.js 等は .gitignore により管理されています
