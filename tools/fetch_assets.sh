#!/usr/bin/env bash
# 下載 MakeHuman CC0 素材包到 assets_mh/
# 官網每條連線只有約 55KB/s，所以用 aria2c 分 16 段同時下載
set -u
command -v aria2c >/dev/null || sudo apt-get install -y -qq aria2 >/dev/null
mkdir -p assets_mh dl
PACKS="makehuman_system_assets skins02 suits01 shoes01 hair01 eyebrows01 eyelashes01"
for p in $PACKS; do
  (
    for host in files2 files; do
      url="https://$host.makehumancommunity.org/asset_packs/$p/${p}_cc0.zip"
      echo "$p <- $url"
      aria2c -q -x 16 -s 16 -k 1M --max-tries=5 --retry-wait=5 --timeout=60 -d dl -o "$p.zip" --allow-overwrite=true "$url" \
        && unzip -tq "dl/$p.zip" >/dev/null && { echo "$p OK $(du -h dl/$p.zip | cut -f1)"; break; }
      echo "$p failed on $host"
    done
  ) &
done
wait
for p in $PACKS; do unzip -oq "dl/$p.zip" -d assets_mh || echo "UNZIP FAIL $p"; done
du -sh assets_mh
