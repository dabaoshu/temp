#!/usr/bin/env bash

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

DATA_DIR="${ROOT_DIR}/data"
SRC_DIR="${ROOT_DIR}/onlyofficeNginx"
TARGET_DIR="${DATA_DIR}/onlyofficeNginx"

echo "删除旧目录: ${TARGET_DIR}"
rm -rf "${TARGET_DIR}"

echo "创建数据目录: ${DATA_DIR}"
mkdir -p "${DATA_DIR}"

echo "拷贝当前 onlyofficeNginx 到 data 目录..."
cp -r "${SRC_DIR}" "${TARGET_DIR}"

echo "完成: ${SRC_DIR} -> ${TARGET_DIR}"

