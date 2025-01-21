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
./analyze.sh  $workers  $timeout  fresh       | tee analysis_1_fresh.log
./analyze.sh  $workers  $timeout  postgres    | tee analysis_2_postgres.log

./make.sh crashes
./analyze.sh  $workers  $timeout  fresh  1    | tee analysis_3_fresh.log
./analyze.sh  $workers  $timeout  postgres  2 | tee analysis_4_postgres.log

./make.sh s2s async
./analyze.sh  $workers  $timeout  fresh       | tee analysis_5_fresh.log
./analyze.sh  $workers  $timeout  postgres    | tee analysis_6_postgres.log
