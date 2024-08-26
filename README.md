# Gadget Hunter (GHunter) for the Deno runtime

This artifact contains the part of tool and experiments from the paper ["GHunter: Universal Prototype Pollution Gadgets in JavaScript Runtimes"][publication] for the Deno analysis.

## Citation

If you use the paper, tool, and/or experiment results for academic research we encourage you to cite it as:

```bibtex
@inproceedings{GHunter2024,
  title={GHunter: Universal Prototype Pollution Gadgets in JavaScript Runtimes},
  author={Cornelissen, Eric and Shcherbakov, Mikhail and Balliu, Musard},
  booktitle={33rd USENIX Security Symposium (USENIX Security 24)},
  pages={3693--3710},
  year={2024}
}
```

## Artifact

The artifact implements dynamic analysis for detecting prototype pollution in the Deno JavaScript runtime.
The analysis modifies the Deno runtime (the files in `patches/` represent all modifications) and runs the Deno test suite.
In particular, the analysis spans the [`Deno` API], the [Node.js compatibility API], and the [Deno standard library].
You can run the analysis by following the instructions below.

[`deno` api]: https://deno.land/api@v1.37.2
[node.js compatibility api]: https://docs.deno.com/runtime/manual/node/compatibility
[deno standard library]: https://deno.land/std@0.204.0

## Requirements

### Hardware

We conducted the original experiments on an AMD EPYC 7742 64-Core 2.25 GHz server with 512 GB RAM, and 1 TB of disk space.
We have also run the experiments on an AMD Ryzen 7 3700x 8-core CPU (3.60GHz), 32 GB RAM, and 50 GB of disk space.
No specific hardware features are required.

### Software

We originally ran the experiments on Ubuntu 22.04.
We used [Docker] as an OCI container runtime.

[docker]: https://www.docker.com/

## Setup

We provide two modes for experiment evaluation:

1. A container image with a prepared environment.
2. Instructions on how to set up the environment on own machine.

### Container

To run the experiments in a prepared environment you can use the container image defined for this project. You can either use a prebuild image or build the image from scratch.

#### Prebuild

To use the prebuild container image, pull the image `ghcr.io/kth-langsec/ghunter4deno`, launch the container, and attach a bash shell to the container to get started.

```shell
docker pull ghcr.io/kth-langsec/ghunter4deno:latest
docker run -dit --name ghunter4deno ghcr.io/kth-langsec/ghunter4deno:latest
docker exec -it ghunter4deno /bin/bash
```

#### Build

To build the container image from scratch you can clone the repository and run the helper script `container.sh`. This will build the image, start a container, and attach to it automatically.

```shell
git clone git@github.com:KTH-LangSec/ghunter4deno.git
cd ghunter4deno
./container.sh
```

### Local installation

To run the experiments locally, clone the repository with submodules recursively:

```shell
git clone --recurse-submodules git@github.com:KTH-LangSec/ghunter4deno.git
```

and set up the [Deno development prerequisites].

[deno development prerequisites]: https://github.com/denoland/deno-docs/blob/7b4aa843f7b8315b0f5129af16521b7a44100c8e/runtime/manual/references/contributing/building_from_source.md#prerequisites

## Basic test

As a basic test we provide a way to run the source-to-sink analysis on a single test.

1. Run `./make.sh s2s sync` to build Deno for the analysis. This step requires compiling Deno, which can take up to hour.
2. Run `./analyze.sh 2 20 basic-test` to run the analysis on a single test. This step should take about a minute.

This will produce a directory named `_analysis/analysis-1` with the raw logs as well as a SARIF file for manual review. This analysis is expected to yield about 6 gadget candidates.

## Experiments

We provide two modes for running the experiments:

1. A full run encompassing all parts of the analysis.
2. A partial analysis focussing on one aspect of the analysis.

### Full

Run `./run.sh`, optionally with a number of workers (default 5) and test timeout (default 20s). This will run the full analysis and output aggregate numbers as well as whether or not the expected gadget candidates were found to the terminal in the end.

In particular, this will generate the `_aggregate/` directory with aggregate result SARIF files and all logs aggregated, the `_analysis/` directory with the 9 per-project analysis SARIF files and logs, and `analysis_X.log` files for the 9 per-project logs as seen on the terminal.

This is expected to take at most 4 hours on a machine similar to the hardware requirements above.

### Partial

You can also run 1 of the 9 per-project analyzes. This allows for choosing the Deno project, analysis type (source-to-sink or unexpected terminations), and sync or async.

In either case, the results will be output in a new `_analysis/analysis-X` directory.
This includes the raw data as well as the SARIF file for manual review.

#### Source-to-sink

To run source-to-sink analysis:

1. Run `./make.sh s2s` to build Deno for source-to-sink analysis.
2. Run `./analyze.sh`, which will provide instructions on how to continue.
   For example `./analyze.sh 5 20 core`.

#### Unexpected termination

To run unexpected termination analysis you must have previously run source-to-sink analysis in order to obtain a list of undefined property accesses for each file, then:

1. Run `./make.sh crashes` to build Deno for unexpected termination analysis.
2. Run `./analyze.sh`, which will provide instructions on how to continue.
   This requires providing the index of a previous source-to-sink analysis for the chosen Deno project; the index is the `X` in `_analysis/analysis-X`.
   For example, if you previously run source-to-sink analysis for Deno core, `./analyze.sh 5 20 core 1`.

## Additional content

This repository also contains:

- `gadgets`: A collection of PoCs for all gadgets reported in the paper.
- `results`: A snapshot of results from an earlier run. These are best viewed in the container environment for this artifact.

[publication]: https://www.usenix.org/conference/usenixsecurity24/presentation/cornelissen
