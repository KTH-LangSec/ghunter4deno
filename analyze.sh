#!/bin/bash

set -eo pipefail

start=$(date +%s)

### CLI
parallel_cnt="$1"
timeout="$2"
case "$3" in
"core")
  tests_dir='./deno/cli/tests/unit/'
  ;;
"node")
  tests_dir='./deno/cli/tests/unit_node/'
  ;;
"std")
  tests_dir='./deno_std/'
  ;;
"basic-test")
  tests_dir='./deno/cli/tests/unit/dir_test.ts'
  ;;
*)
  echo 'usage: ./analyze.sh [# of workers] [test timeout in seconds] [target] [analysis index]'
  echo 'possible targets: "core", "node", "std", "basic-test"'
  echo 'analysis index only needed when running unexpected-termination analysis, in which case it must be the index of a "_analysis/analysis-x" folder'
  exit 1
esac

### Analysis
rm -rf ./_analysis/tmp/ ./_analysis/intermediate/
mkdir -p ./_analysis/tmp/

## 1. Prepare
build="$(cat .build)"
if [[ "$build" == "crashes" ]]; then
  index="$4"
  cp -r "./_analysis/analysis-$index/intermediate" ./_analysis/intermediate
elif [[ "$build" == "s2s" ]]; then

  ## 1.1 Initial run
  node ./runner.mjs "$parallel_cnt" "$timeout" "$tests_dir"

  mv _analysis/tmp _analysis/intermediate
  mkdir _analysis/tmp/
else
  echo 'Build tag missing (did you run ./make.sh first?)'
  exit 2
fi

## 2. Taint run
node ./runner.mjs "$parallel_cnt" "$timeout" "$tests_dir"

## 3. Analyze
node to-sarif.mjs

### Meta
end=$(date +%s)
execution_time=$((end - start))
minutes=$((execution_time / 60))
seconds=$((execution_time % 60))
echo "Total execution time: $minutes mins $seconds secs ($parallel_cnt workers)"
