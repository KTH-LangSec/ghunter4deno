#!/bin/bash

set -eo pipefail

if [[ "$(docker ps -a | grep ghunter4deno)" == "" ]]; then
  docker build \
    --file 'Containerfile' \
    --tag 'ghunter4deno' \
    .

  docker run -it \
    --detach \
    --workdir '/src' \
    --name 'ghunter4deno' \
    'ghunter4deno'
fi

if [[ "$(docker ps -a | grep 'ghunter4deno' | grep 'Up')" == "" ]]; then
  docker start 'ghunter4deno'
fi

docker exec -it \
  'ghunter4deno' \
  bash
