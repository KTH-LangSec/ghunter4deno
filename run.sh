#!/bin/bash

set -eo pipefail

workers="$1"
timeout="$2"

if [[ "$workers" == "" ]]; then
  workers="5"
fi

if [[ "$timeout" == "" ]]; then
  timeout="20"
fi

echo "Running with $workers worker(s) and a timeout of $timeout second(s)."
echo 'You can configure this with the first and second argument respectively.'
sleep 3
echo

mv _analysis/ _analysis.bkp/

./make.sh s2s sync
./analyze.sh  $workers  $timeout  core    | tee analysis_1.log
./analyze.sh  $workers  $timeout  node    | tee analysis_2.log
./analyze.sh  $workers  $timeout  std     | tee analysis_3.log

./make.sh crashes
./analyze.sh  $workers  $timeout  core  1 | tee analysis_4.log
./analyze.sh  $workers  $timeout  node  2 | tee analysis_5.log
./analyze.sh  $workers  $timeout  std   3 | tee analysis_6.log

./make.sh s2s async
./analyze.sh  $workers  $timeout  core    | tee analysis_7.log
./analyze.sh  $workers  $timeout  node    | tee analysis_8.log
./analyze.sh  $workers  $timeout  std     | tee analysis_9.log

./numbers.sh
