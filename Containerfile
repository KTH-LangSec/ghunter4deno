FROM docker.io/ubuntu:22.04


## Setup environment
RUN apt-get update

# Install general prerequisites
RUN apt-get install -y \
  bash curl git gnupg jq lsb-release software-properties-common wget \
  cmake libglib2.0-dev protobuf-compiler

# Install clang-16 lld-16
RUN wget https://apt.llvm.org/llvm.sh \
  && chmod +x llvm.sh \
  && ./llvm.sh 16

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | sh \
  && apt-get install nodejs -y

# Setup `python` command
RUN ln -sf /usr/bin/python3 /usr/bin/python


## Setup ghunter4deno
WORKDIR /src
COPY ./.git ./.git
COPY ./deno ./deno
COPY ./deno_core ./deno_core
COPY ./deno_std ./deno_std
COPY ./rusty_v8 ./rusty_v8
COPY ./.gitmodules ./
RUN git submodule update --init --recursive
COPY . ./


ENTRYPOINT ["/bin/bash"]
