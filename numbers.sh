#!/bin/bash

set -eo pipefail


## Aggregate data
rm -rf ./_aggregate/
mkdir ./_aggregate/
mkdir ./_aggregate/logs

cp --suffix=1 ./_analysis/analysis-1/logs/* ./_aggregate/logs
cp --suffix=2 ./_analysis/analysis-2/logs/* ./_aggregate/logs
cp --suffix=3 ./_analysis/analysis-3/logs/* ./_aggregate/logs
cp --suffix=7 ./_analysis/analysis-7/logs/* ./_aggregate/logs
cp --suffix=8 ./_analysis/analysis-8/logs/* ./_aggregate/logs
cp --suffix=9 ./_analysis/analysis-9/logs/* ./_aggregate/logs

cat ./_analysis/analysis-4/errors.log >./_aggregate/errors.log
cat ./_analysis/analysis-5/errors.log >>./_aggregate/errors.log
cat ./_analysis/analysis-6/errors.log >>./_aggregate/errors.log


## Generate aggregate SARIF files
mv _analysis/ _analysis_bkp/

mv _aggregate/ _analysis/
mv _analysis/logs/ _analysis/tmp/
mkdir _analysis/intermediate/

rm -f .build errors.log
mv _analysis/errors.log errors.log

echo 's2s' >.build
node --max-old-space-size=16384 to-sarif.mjs
mv _analysis/analysis-1/result.sarif s2s.sarif
rm -rf _analysis/analysis-1/

echo 'crashes' >.build
node to-sarif.mjs
mv _analysis/analysis-1/result.sarif crashes.sarif
rm -rf _analysis/analysis-1/

mv _analysis/ _aggregate/
mv _analysis_bkp/ _analysis/

mv _aggregate/tmp/ _aggregate/logs/
mv s2s.sarif _aggregate/s2s.sarif
mv crashes.sarif _aggregate/crashes.sarif
mv errors.log _aggregate/errors.log
rm -rf _aggregate/intermediate/


## Compute numbers
n1=$(ls -al _analysis/analysis-1/intermediate/ | grep 'taint_' | wc -l)
n2=$(ls -al _analysis/analysis-2/intermediate/ | grep 'taint_' | wc -l)
n3=$(ls -al _analysis/analysis-3/intermediate/ | grep 'taint_' | wc -l)
tests_completed=$((n1+n2+n3-9))


n1=$(ls -al _analysis/analysis-1/logs/ | grep 'taint_' | wc -l) # sync sinks for Deno's Node.js compat
n2=$(ls -al _analysis/analysis-2/logs/ | grep 'taint_' | wc -l) # sync sinks for Deno core
n3=$(ls -al _analysis/analysis-3/logs/ | grep 'taint_' | wc -l) # sync sinks for Deno std
n4=$(ls -al _analysis/analysis-7/logs/ | grep 'taint_' | wc -l) # async sinks for Deno core
n5=$(ls -al _analysis/analysis-8/logs/ | grep 'taint_' | wc -l) # async sinks for Deno's Node.js compat
n6=$(ls -al _analysis/analysis-9/logs/ | grep 'taint_' | wc -l) # async sinks for Deno std
test_property_pairs=$((n1+n2+n3+n4+n5+n6))

sinks_reached=$(grep -rh 'sink stack' ./_aggregate/logs/ | sort | uniq | wc -l || true)
tests_timed_out=$(grep -rh 'timed out after [0-9]\+ seconds' ./_aggregate/errors.log | wc -l || true)
tests_panicked=$(grep -rh 'Deno has panicked' ./_aggregate/errors.log | wc -l || true)

sinks_reached_final=$(jq '.runs[0].results | length' _aggregate/s2s.sarif)
tests_timed_out_final=$(jq '.runs[0].results[] | select(.ruleId == "timeout") | .ruleId' _aggregate/crashes.sarif | wc -l)
tests_panicked_final=$(jq '.runs[0].results[] | select(.ruleId == "panic") | .ruleId' _aggregate/crashes.sarif | wc -l)

gadget_candidates=$((sinks_reached_final+tests_timed_out_final+tests_panicked_final))


## Output
echo
echo '-------------------------------------------------------------------------'
echo
echo "      Tests completed              : $tests_completed"
echo
echo "  Test property pairs (unfiltered) : $test_property_pairs"
echo "        Sinks reached (unfiltered) : $sinks_reached"
echo "            Timed out (unfiltered) : $tests_timed_out"
echo "               Panics (unfiltered) : $tests_panicked"
echo
echo "        Sinks reached              : $sinks_reached_final"
echo "            Timed out              : $tests_timed_out_final"
echo "               Panics              : $tests_panicked_final"
echo
echo "    Gadget candidates              : $gadget_candidates"
