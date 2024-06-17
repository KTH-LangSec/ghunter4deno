#!/bin/bash

set -eo pipefail

mkdir -p ./_analysis/tmp/ # must exist for compilation

target="$1"
sync_or_async="$2"
if [[ "$target" == "crashes" ]]; then

  echo 'unpatch deno_core...'
  cd deno_core/
  git reset --hard
  cd ../

  # ---

  echo 'patch rusty_v8 (fix build)...'
  cd rusty_v8/
  git reset --hard
  git apply ../patches/build-rusty_v8.patch
  cd ../

  # ---

  echo 'unpatch v8...'
  cd rusty_v8/v8/
  git reset --hard
  cd ../../

elif [[ "$target" == "s2s" ]]; then

  if [[ "$sync_or_async" == "sync" ]]; then

    echo 'patch deno_core (taint changes)...'
    cd deno_core/
    git reset --hard
    git apply ../patches/taint-deno_core-sync.patch
    cd ../

  elif [[ "$sync_or_async" == "async" ]]; then

    echo 'patch deno_core (taint changes)...'
    cd deno_core/
    git reset --hard
    git apply ../patches/taint-deno_core-async.patch
    cd ../

  else

    echo "Must choose either sync or async (got '$sync_or_async')"
    exit 1

  fi

  # ---

  echo 'patch rusty_v8 (fix build)...'
  cd rusty_v8/
  git reset --hard
  git apply ../patches/build-rusty_v8.patch
  cd ../

  # ---

  echo 'patch v8 (taint changes)...'
  cd rusty_v8/v8/
  git reset --hard
  git apply ../../patches/taint-v8.patch
  cd ../../

else

  echo "Unknown target '$target' (must be 's2s' or 'crashes')"
  exit 1

fi

echo $target >.build

echo 'Build (using local deno_core and rusty_v8)...'
cd deno/
RUSTFLAGS="-Clink-arg=-Wl,--allow-multiple-definition" V8_FROM_SOURCE=1 \
  cargo \
  --config .cargo/local-build.toml \
  build \
  -vv
cd ../

echo 'Preparing deno_std for tests'
rm -f deno_std/fs/testdata/copy_dir_link_file/0.txt
touch deno_std/fs/testdata/copy_dir_link_file/0.txt
rm -f deno_std/wasi/testdata/fixtures/symlink_to_parent_directory
