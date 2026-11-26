#!/usr/bin/env bash
# 下載 MakeHuman 素材包（CC0）到 assets_mh/
set -e
BASE=https://static.makehumancommunity.org/assets/assetpacks
mkdir -p assets_mh dl
for p in makehuman_system_assets skins02 suits01 shirts01 pants01 shoes01 hair01 eyebrows01 eyelashes01; do
  page=$(curl -sL "$BASE/$p.html")
  url=$(echo "$page" | grep -oE 'href="[^"]+\.zip"' | head -1 | sed 's/href="//;s/"$//')
  case "$url" in http*) ;; *) url="$BASE/$url";; esac
  echo "$p -> $url"
  curl -sL "$url" -o "dl/$p.zip"
  unzip -oq "dl/$p.zip" -d assets_mh
done
