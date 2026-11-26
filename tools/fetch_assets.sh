#!/usr/bin/env bash
# 下載 MakeHuman CC0 素材包到 assets_mh/（官網很慢，同時下載）
set -u
mkdir -p assets_mh dl
PACKS="makehuman_system_assets skins02 suits01 shoes01 hair01 eyebrows01 eyelashes01"
for p in $PACKS; do
  (
    for host in files2 files; do
      url="https://$host.makehumancommunity.org/asset_packs/$p/${p}_cc0.zip"
      [ "$p" = makehuman_system_assets ] && url=$(curl -sL --max-time 60 https://static.makehumancommunity.org/assets/assetpacks/$p.html | grep -oE "https://$host[^\"]+\.zip" | head -1)
      echo "$p <- $url"
      curl -L --max-time 5400 --retry 2 -s -w "$p %{http_code} %{size_download} %{speed_download}\n" "$url" -o "dl/$p.zip" && unzip -tq "dl/$p.zip" >/dev/null && break
      echo "$p failed on $host"
    done
  ) &
done
wait
for p in $PACKS; do unzip -oq "dl/$p.zip" -d assets_mh || echo "UNZIP FAIL $p"; done
du -sh assets_mh
