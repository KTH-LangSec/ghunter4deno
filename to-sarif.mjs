import fs from "node:fs";
import path from "node:path";

const TOOL = {
  NAME: "ghunter4deno",
  URI: "https://github.com/KTH-LangSec/ghunter4deno",
  VERSION: "0.1.1",
};

function main() {
  const rootPath = path.resolve(".");
  const basePath = path.join(rootPath, "_analysis");

  const target = path.join(
    basePath,
    "analysis-" + (fs.readdirSync(basePath).length - 1)
  );
  fs.mkdirSync(target);

  const logsPath = path.join(target, "logs");
  fs.cpSync(path.join(basePath, "tmp"), logsPath, { recursive: true });

  const intermediatePath = path.join(target, "intermediate");
  fs.cpSync(path.join(basePath, "intermediate"), intermediatePath, { recursive: true });

  const errorsFile = path.join(rootPath, "errors.log");
  fs.cpSync(errorsFile, path.join(target, "errors.log"));

  let sarif;
  if (build === "crashes") {
    const errors = fs.readFileSync(errorsFile, { encoding: "utf-8" });
    sarif = toSarif([], errors);
  } else {
    const logFiles = fs.readdirSync(logsPath);
    const logs = [];
    for (const logFile of logFiles) {
      const logPath = path.join(logsPath, logFile);
      const log = fs.readFileSync(logPath, { encoding: "utf-8" });
      logs.push(log);
    }

    sarif = toSarif(logs, "");
  }

  const json = JSON.stringify(sarif, null, 2);
  fs.writeFileSync(path.join(target, "./result.sarif"), json);
}

// ---

const SINK_TRACE = 0, SOURCE_TRACE = 1, IRRELEVANT = 2;

function toSarif(entries, errors) {
  const results = [
    /* log entries */
    ...entries.flatMap(logToSarif)

      // filter out duplicates
      .filter(uniqueBy(x => {
        let seenTestFile = false;

        let stack = x._meta.sinkStack
          .split("\\n")
          .map(line => {
            if (line.includes("_test.ts")) {
              seenTestFile = true;
            }
            if (!seenTestFile) {
              return line;
            }
          })
          .filter(line => line !== undefined)
          .join(" ");
        if (!seenTestFile) {
          stack = x._meta.sourceStack
            .split("\\n")
            .map(line => {
              if (line.includes("_test.ts")) {
                seenTestFile = true;
              }
              if (!seenTestFile) {
                return line;
              }
            })
            .filter(line => line !== undefined)
            .join(" ");
        }

        return `${x._meta.property}${stack}`;
      }))

      .map(x => { delete x._meta; return x; }),


    /* error entries */
    ...errors.replace(/\r?\n(?!\[INFO])/g, "\\n").split(/\n/)

      // process log into objects
      .reduce((acc, line) => {
        if (line.startsWith("[INFO] ===== START =====")) {
          const [, test, prop] = line.match(/(?<=\[)(.+?)(?=\])/g)
          acc.push({ test, prop });
        } else if (line.startsWith("[INFO] ===== STDOUT =====")) {
          const cur = acc[acc.length - 1];
          cur.stdout = line.replace(/\\n/g, "\n")
            .substring(26, /* end */)
            .replace(/\x1B\[\d+(;\d+)*m/g, "");
        } else if (line.startsWith("[INFO] ===== STDERR =====")) {
          const cur = acc[acc.length - 1];
          cur.stderr = line.replace(/\\n/g, "\n")
            .substring(26, /* end */)
            .replace(/\x1B\[\d+(;\d+)*m/g, "");
        }

        return acc;
      }, [])

      // filter out known uninteresting errors (e.g. a test didn't pass)
      .filter(error => {
        if (error.stderr.includes("error: Test failed")) {
          return false;
        }

        if (error.stderr.includes("error: Uncaught AssertionError")) {
          return false;
        }

        if (error.stderr.includes("error: Uncaught NotFound")) {
          return false;
        }

        if (error.stderr.includes("error: Uncaught BadResource")) {
          return false;
        }

        if (error.stderr.includes("error: Uncaught TypeError")) {
          return false;
        }

        if (error.stderr.includes("error: Promise resolution is still pending but the event loop has already resolved")) {
          return false;
        }

        if (error.stderr.includes("error: Module not found")) {
          return false;
        }

        return true;
      })

      // Map errors to useful categories
      .map(error => {
        if (error.stdout.includes("timed out after ")) {
          return {
            error,
            level: "error",
            ruleId: "timeout",
            message: {
              text: `Test "${error.test}" timed out with polluted property "${error.prop}".`,
            },
          };
        } else if (error.stdout.includes("Deno has panicked") || error.stderr.includes("Deno has panicked")) {
          return {
            level: "error",
            ruleId: "panic",
            message: {
              text: `Unexpected crash in "${error.test}" with polluted property "${error.prop}".\n\nSTDOUT:\n---------------------------------\n${error.stdout}\n---------------------------------\n\nSTDERR:\n---------------------------------\n${error.stderr}\n---------------------------------`,
            },
          };
        } else if (error.stderr.includes("Last few GCs")) {
          return {
            level: "error",
            ruleId: "oom",
            message: {
              text: `Polluting in "${error.test}" with property "${error.prop}" causes an Out of Memory error.\n\nSTDOUT:\n---------------------------------\n${error.stdout}\n---------------------------------\n\nSTDERR:\n---------------------------------\n${error.stderr}\n---------------------------------`,
            },
          };
        } else {
          return {
            level: "error",
            ruleId: "unexpected",
            message: {
              text: `Polluting property "${error.prop}" in "${error.test}" causes an unknown unexpected error.\n\nSTDOUT:\n---------------------------------\n${error.stdout}\n---------------------------------\n\nSTDERR:\n---------------------------------\n${error.stderr}\n---------------------------------`,
            },
          };
        }
      })

      // Filter out tests that typically time out
      .filter(entry => {
        if (entry.ruleId === "timeout") {
          return ![
            "deno/cli/tests/unit/body_test.ts",
            "deno/cli/tests/unit/kv_queue_undelivered_test.ts",
            "deno/cli/tests/unit/kv_test.ts",
            "deno/cli/tests/unit_node/http_test.ts",
            "deno/cli/tests/unit_node/net_test.ts",
            "deno/cli/tests/unit_node/tls_test.ts",
            "deno_std/crypto/crypto_test.ts",
            "deno_std/http/file_server_test.ts",
            "deno_std/io/buf_reader_test.ts",
            "deno_std/testing/snapshot_test.ts",
          ].includes(entry.error.test);
        } else {
          return true;
        }
      })

      // Clean output for SARIF file
      .map(entry => {
        delete entry.error;
        return entry;
      })
  ];

  results.sort((a, b) => {
    // order by level
    if (a.level !== b.level) {
      if (a.ruleId === "error") {
        return 1;
      } else if (b.ruleId === "error") {
        return -1;
      } else if (a.ruleId === "warning") {
        return 1;
      } else if (b.ruleId === "warning") {
        return -1;
      }
    }

    // order by rule
    if (a.ruleId !== b.ruleId) {
      if (a.ruleId === "binding") {
        return 1;
      } else if (b.ruleId === "binding") {
        return -1;
      } else if (a.ruleId === "oom") {
        return 1;
      } else if (b.ruleId === "oom") {
        return -1;
      } else if (a.ruleId === "panic") {
        return 1;
      } else if (b.ruleId === "panic") {
        return -1;
      } else if (a.ruleId === "timeout") {
        return 1;
      } else if (b.ruleId === "timeout") {
        return -1;
      } else if (a.ruleId === "unexpected") {
        return 1;
      } else if (b.ruleId === "unexpected") {
        return -1;
      }
    }

    // order by message
    return a.message.text.localeCompare(b.message.text);
  });

  return {
    version: "2.1.0",
    "$schema": "http://json.schemastore.org/sarif-2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: TOOL.NAME,
            informationUri: TOOL.URI,
            version: TOOL.VERSION,
            rules: [
              {
                id: "binding",
                name: "Polluted binding value",
                shortDescription: {
                  text: "Pollutable property reaches binding call"
                },
              },
              {
                id: "oom",
                name: "Polluting causes out of memory",
                shortDescription: {
                  text: "Pollutable property causes the program to run out of memory"
                },
              },
              {
                id: "panic",
                name: "Polluting causes panic",
                shortDescription: {
                  text: "Pollutable property causes a panic"
                },
              },
              {
                id: "timeout",
                name: "Polluting causes timeout",
                shortDescription: {
                  text: "Pollutable property causes a timeout"
                },
              },
              {
                id: "unexpected",
                name: "Polluting causes unknown unexpected error",
                shortDescription: {
                  text: "Pollutable property causes an unknown unexpected error"
                },
              },
            ]
          },
        },
        results,
      },
    ],
  };
}

function logToSarif(log) {
  // (1) find log entries for sinks and sources
  const sources = new Map();
  const sinks = new Map();
  let pollutedProperty = null;
  for (const line of log.split("\n")) {
    const type = line.includes("sink stack")
      ? SINK_TRACE
      : line.includes("source stack")
        ? SOURCE_TRACE
        : IRRELEVANT;

    if (type === SOURCE_TRACE) {
      const logLine = line.replace("[From JS]", "").trim();

      // extract error message
      let trace = logLine.substring(logLine.indexOf(":"), /* end */);
      // remove first line of trace (error info)
      trace = trace.substring(trace.indexOf("\\n") + 2, /* end */);
      // remove second line of trace (always line 3 of the test file)
      trace = trace.substring(trace.indexOf("\\n") + 2, /* end */);

      const pollutedValue = logLine
        .substring(0, logLine.indexOf(":"))
        .replace(" source stack", "");

      sources.set(pollutedValue, trace);
    } else if (type === SINK_TRACE) {
      const logLine = line.replace("[From JS]", "").trim();
      const message = logLine.substring(0, logLine.indexOf("|"));
      const trace = logLine.substring(logLine.indexOf("|"), /* end */);

      // skip unintersting properties
      if (
        message.includes("[stack]")
      ) {
        continue;
      }

      const pollutedValue = /(0(x|X)(EFFACED|effaced)|\[Number\]effaced)\d+/
        .exec(
          message
            .substring(0, logLine.indexOf(" at"))
            .substring(message.indexOf(":") + 2, /* end */)
        )[0]
        .replace("[Number]", "0x");

      const simplifiedMessage = message
        .replace(/\[Number\]effaced\d+/, "[Number]0xEFFACED")
        .replace(/0(x|X)EFFACED\d+/, "0xEFFACED");

      sinks.set(pollutedValue, {
        message: simplifiedMessage,
        sinkTrace: trace
      });
    } else if (line.includes("===== START =====")) {
      pollutedProperty = /\[.*?\].*?\[.*?\].*?\[(.+?)\]/g.exec(line)[1];
    }
  }

  // (2) match sinks and sources
  let results = [];
  for (const [sinkPollutedValue, { message, sinkTrace }] of sinks.entries()) {
    let sourceTrace = null;
    for (const [sourcePollutedValue, _sourceTrace] of sources.entries()) {
      // Notes;
      // - Using `.includes` because for the source we know exactly what value
      //   was used for pollution, but at the sink we only know rougly what
      //   value was received - in particular it might be concatinated with
      //   other strings.
      // - Doing case insensitive lookup primarily because sometimes the "x" in
      //   "0xEFFACED" is changed to "X"
      if (sinkPollutedValue.toLowerCase().includes(sourcePollutedValue.toLowerCase())) {
        sourceTrace = _sourceTrace;
      }
    }

    if (sourceTrace === null) {
      console.log("[warn] no source trace found for sink value", sinkPollutedValue);
      continue;
    }

    const location = parseTraceLine(
      // location = the location of file at the top of the (sink's) stack trace
      sinkTrace
        .split("\\n")
        .find(line => line.startsWith("    at") && !line.includes("<anonymous>"))
    );

    // skip uninteresting locations
    if (
      location.file === "file:///src/deno/cli/js/40_testing.js"
    ) {
      continue;
    }

    results.push({
      level: "error",
      ruleId: "binding",
      _meta: {
        property: pollutedProperty,
        sourceStack: sourceTrace,
        sinkStack: sinkTrace.replace("| sink stack: ", ""),
        sink: message.split(" ")[0],
      },
      message: {
        text: message + `\n\npolluted property: "${pollutedProperty}"`,
      },
      stacks: [
        {
          message: {
            text: "Stack trace for source",
          },
          frames: traceToFrames(sourceTrace),
        },
        {
          message: {
            text: "Stack trace for sink",
          },
          frames: traceToFrames(sinkTrace),
        },
      ],
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: location.file,
            },
            region: {
              startLine: location.lineNumber,
              startColumn: location.columnNumber,
            },
          },
        },
      ],
    });
  }

  return results;
}

function traceToFrames(trace) {
  return trace
    .split("\\n")
    .filter(line => line.startsWith('    at'))
    .filter(line => !line.includes('<anonymous>'))
    .map(line => {

      const location = parseTraceLine(line);
      return {
        location: {
          physicalLocation: {
            artifactLocation: {
              uri: location.file
            },
            region: {
              startLine: location.lineNumber,
              startColumn: location.columnNumber,
            },
          },
        }
      }
    })
}

function parseTraceLine(line) {
  let file, lineNumber, columnNumber;

  const expr1 = /\s+at\s(?:async\s|new\s)?([A-z._<>]+)\s(?:\[[A-z ]+\]\s)?\((.+?)\)/;
  const match1 = expr1.exec(line);
  if (match1) {
    let [_file, _l, _c] = match1[2].split(/:(?=\d)/);
    file = _file;
    lineNumber = _l;
    columnNumber = _c;
  } else {
    const expr2 = /\s+at\s(?:async\s|new\s)?(.+)/;
    const match2 = expr2.exec(line);
    let [_file, _l, _c] = match2[1].split(/:(?=\d)/);
    file = _file;
    lineNumber = _l;
    columnNumber = _c;
  }

  let lineAdjustment = 0;
  if (file.includes("_test.ts")) {
    lineAdjustment = -4;
  }

  return {
    file: normalizeFilename(file),
    lineNumber: parseInt(lineNumber, 10) + lineAdjustment,
    columnNumber: parseInt(columnNumber, 10)
  };
}

function normalizeFilename(filename) {
  let result = filename
    // restore the original test filename
    .replace(/_[A-Za-z0-9*$]+_analysis_test/, "_test")

    // resolve internal code paths
    .replace("ext:cli/runtime/js", `${path.resolve(".")}/deno/runtime/js`)
    .replace("ext:cli", `${path.resolve(".")}/deno/cli/js`)
    .replace("ext:core", `${path.resolve(".")}/deno_core/core`)
    .replace("ext:deno_cache", `${path.resolve(".")}/deno/ext/cache`)
    .replace("ext:deno_console", `${path.resolve(".")}/deno/ext/console`)
    .replace("ext:deno_crypto", `${path.resolve(".")}/deno/ext/crypto`)
    .replace("ext:deno_fs", `${path.resolve(".")}/deno/ext/fs`)
    .replace("ext:deno_fetch", `${path.resolve(".")}/deno/ext/fetch`)
    .replace("ext:deno_http", `${path.resolve(".")}/deno/ext/http`)
    .replace("ext:deno_net", `${path.resolve(".")}/deno/ext/net`)
    .replace("ext:deno_node", `${path.resolve(".")}/deno/ext/node/polyfills`)
    .replace("ext:deno_tsc", `${path.resolve(".")}/deno/cli/tsc`)
    .replace("ext:deno_url", `${path.resolve(".")}/deno/ext/url`)
    .replace("ext:deno_web", `${path.resolve(".")}/deno/ext/web`)
    .replace(/node:([a-z]+)/, `${path.resolve(".")}/deno/ext/node/polyfills/$1.ts`)
    .replace("ext:runtime", `${path.resolve(".")}/deno/runtime/js`);

  if (!result.startsWith("file://")) {
    result = "file://" + result;
  }

  return result;
}

function uniqueBy(fn) {
  return (x, i, a) => {
    let found = a.slice(i + 1).find((y) => fn(x) === fn(y));
    return found === undefined;
  }
}

// ---

const build = fs.readFileSync(".build", { encoding: "utf-8" }).trim();

main();
