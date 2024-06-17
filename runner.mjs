import cp from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import util from "node:util";

const intermediateDir = './_analysis/intermediate/';

const FORIN_SYMBOL = "____FORIN";

async function main({ testdir, timeout, parallelMax }) {
    if (fs.existsSync(intermediateDir)) {
        // polluted run
        const propsByFile = await collectUndefinedProps(intermediateDir);
        if (propsByFile.size === 0) {
            console.log("[INFO] No undefined properties detected");
            return;
        }

        runInParallel(testdir, parallelMax, timeout, propsByFile);
    } else {
        // initial run
        runInParallel(testdir, parallelMax, timeout);
    }
}

async function collectUndefinedProps(dir) {
    const logs = walk(dir, () => true);
    if (logs.length === 0) {
        throw new Error(`no log files found in '${dir}'`);
    }

    const byTest = new Map();
    for (const log of logs) {
        const stream = fs.createReadStream(log);
        const reader = readline.createInterface(stream);

        let file = null, props = new Set();
        props.add(FORIN_SYMBOL);
        for await (const line of reader) {
            if (file === null) {
                const startPattern = /==== START ===== \[(.*?)\]/g;

                // look for the "START" log line
                const match = startPattern.exec(line);
                if (match) {
                    file = match[1];
                }
            } else {
                const notFoundPattern = /.+NOT FOUND:(.+<String\[\d+\]: #(?<strProp>.+?)>| (?<numProp>\d+))/g;

                // process each log line looking for undefined properties
                const match = notFoundPattern.exec(line);
                if (match) {
                    const prop = match.groups.strProp || match.groups.numProp;
                    props.add(prop);
                }
            }
        }

        if (file !== null) {
            const previous = byTest.get(file) || new Set();
            for (const prop of previous.values()) {
                props.add(prop);
            }

            byTest.set(file, props);
        }
    }

    return byTest;
}

async function runInParallel(dir, max, timeout, propsByFile = null) {
    const files = walk(dir, testFileFilter);
    if (files.length === 0) {
        throw new Error(`no test files found in '${dir}'`);
    }

    let cases;
    if (propsByFile !== null) {
        cases = files
            .filter((file) => propsByFile.has(file))
            .flatMap((file) => Array.from(propsByFile.get(file)).map((prop) => [file, prop]));
    } else {
        cases = files.map((file) => [file, null]);
    }

    let promises = [], errors = [], succeeded = 0, errored = 0, timedout = 0;
    for (const [file, prop] of cases) {
        if (promises.length >= max) {
            await Promise.race(promises);

            // remove finished promises so next race doesn't immediately finish
            promises = promises.filter((promise) => {
                return util.inspect(promise) === "Promise { <pending> }";
            });

            // verify at least one resolved promise was removed.
            if (promises.length >= max) {
                console.log('promise could not be cleaned');
                process.exit(1);
            }
        }

        console.log("Running:", file, prop ? `(polluting: '${prop}')` : "");
        const runPromise = runOne(file, timeout, prop)
            .then(() => {
                succeeded += 1;
                console.log(
                    "Success:",
                    file,
                    (prop ? `(polluted: '${prop}')` : ""),
                );
            })
            .catch((error) => {
                if (error.timedOut) {
                    timedout += 1;
                    console.log(
                        "Timed out:",
                        file,
                        (prop ? `(polluted: '${prop}')` : ""),
                    );

                    errors.push({ file, prop, error: { stdout: `timed out after ${timeout} seconds`, stderr: error.stderr } });
                } else {
                    errored += 1;
                    console.log(
                        "Errored:",
                        file,
                        (prop ? `(polluted: '${prop}')` : ""),
                    );

                    if (error.stdout === undefined || error.stderr === undefined) {
                        // not a command error so skipping
                        return;
                    } else {
                        errors.push({ file, prop, error });
                    }
                }
            });
        promises.push(runPromise);
    }

    await Promise.allSettled(promises);

    fs.writeFileSync("./errors.log", errors.map(panic => `[INFO] ===== START ===== [${panic.file}]${panic.prop ? `[${panic.prop}]` : ""}\n[INFO] ===== STDOUT =====\n${panic.error.stdout}\n[INFO] ===== STDERR =====\n${panic.error.stderr}`).join("\n\n"));

    console.log('Total success:', succeeded, '| Total errored', errored, '| Total timed out', timedout);
    return;
}

async function runOne(file, timeout, prop) {
    // get test's (base) filename
    const ext = path.extname(file);
    const basename = file.replace(ext, "");

    // in case a lingering analysis test file is detected, clean it up now and move on
    if (basename.endsWith("_analysis_test")) {
        fs.rmSync(file);
        return;
    }

    // create unique identifier for the test scenario and use it for the filename
    const tmpid = prop ? `_${prop
        .replace(/\//g, "-")
        .replace(/\./g, "--")
        .replace(/,/g, "---")
        .replace(/:/g, "----")
        }_analysis_test` : "_analysis_test";
    const tmpfile = `${basename.replace("_test", tmpid)}${ext}`;
    const content = fs.readFileSync(file, { encoding: "utf-8" });

    // edit the test file for analysis purpose and write it to the unique file
    if (build === "crashes") {
        fs.writeFileSync(
            tmpfile,
            "// %TESTCASE%" +
            "\n" +
            `(((Object as any).prototype as any)['${prop}'] as any) = '0xEFFACED'` +
            "\n\n" +
            `${content}`,
        );
    } else {
        fs.writeFileSync(
            tmpfile,
            "// %TESTCASE%" +
            "\n" +
            `(globalThis as any).log('===== START ===== [${file}] [${prop}]');` +
            "\n" +
            pollute(prop) +
            "\n\n" +
            `${content}`,
        );
    }

    const promise = new Promise((resolve, reject) => {
        try {
            const child = cp.spawn(
                "./deno/target/debug/deno",
                [
                    "test",
                    "--no-check",
                    "--allow-all",
                    "--unstable",
                    "--location=http://js-unit-tests/foo/bar",
                    "--no-prompt",
                    tmpfile,
                ],
                {
                    env: {
                        DENO_V8_FLAGS: "--no-opt",
                    },
                },
            );

            let stdout = "", stderr = "";
            child.stdout.on("data", (data) => {
                stdout += data;
            });
            child.stderr.on("data", (data) => {
                stderr += data;
            });

            child.on("close", (code) => {
                if (child.killed) {
                    reject({ timedOut: true, stdout, stderr });
                } else if (code === 0) {
                    resolve();
                } else {
                    reject({ stdout, stderr });
                }
            });

            // kill the test after the timeout
            setTimeout(() => {
                child.stdin.end();
                child.stdout.destroy();
                child.stderr.destroy();
                child.kill();
            }, timeout * 1000);
        } catch (e) {
            console.log(e)
        }
    });

    await promise.finally(() => {
        // clean up
        fs.rmSync(tmpfile);
    });

    return; // intentionally return nothing, that's how we filter out settled promises
}

function pollute(prop) {
    if (!prop) {
        return "";
    }

    //// Basic:
    // return `(((Object as any).prototype as any)['${prop}'] as any) = '0xEFFACED'`

    //// With stack:
    return `let __pollutedValue: string = '0xEFFACED', __accessIndex: number = 0;
Object.defineProperty(
    ((Object as any).prototype as any),
    '${prop}',
    {
        get: function() {
            const returnValue = __pollutedValue + __accessIndex;
            __accessIndex += 1;

            try {
                throw new Error();
            } catch(error) {
                (globalThis as any).log(returnValue + ' source stack: ' + error.stack.replace(/\\n/g, '\\\\n'));
            }

            return returnValue;
        },
        set: function(newValue) {
            Object.defineProperty(
                this,
                '${prop}',
                {
                    value: newValue,
                    writable: true,
                    enumerable: true,
                    configurable: true
                }
            );
        },
        enumerable: ${prop === FORIN_SYMBOL ? "true" : "false"},
        configurable: true,
    }
);`.replace(/\n/g, "");
}

function walk(dir, filter) {
    if (fs.statSync(dir).isFile()) {
        return [dir];
    }

    const files = [];
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
        const entryPath = path.join(dir, entry);

        let entryStat;
        try {
            entryStat = fs.statSync(entryPath);
        } catch (_) { continue; }

        if (entryStat.isDirectory()) {
            files.push(...walk(entryPath, filter));
        } else {
            if (filter(entryPath)) {
                files.push(entryPath);
            }
        }
    }

    return files;
}

function testFileFilter(file) {
    return [".js", ".cjs", ".mjs", ".ts", ".dts", ".cts"].includes(path.extname(file)) && /_test.[a-z]+$/.test(file);
}

const build = fs.readFileSync(".build", { encoding: "utf-8" }).trim();

const argv = process.argv.slice(process.argv[0].endsWith("node") ? 2 : 1, /* end */);
const parallelMax = parseInt(argv[0], 10);
const timeout = parseInt(argv[1], 10);
const testdir = argv[2];
main({ testdir, timeout, parallelMax });
