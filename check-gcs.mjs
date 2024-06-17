import fs from "node:fs";
import path from "node:path";

const lookingFor = [
    {
        attack: "SSRF",
        api: "fetch",
        sink: "op_fetch",
        property: "body",
        nth: 6,
    },
    {
        attack: "SSRF",
        api: "fetch",
        sink: "op_fetch",
        property: "headers",
        nth: 2,
    },
    {
        attack: "SSRF",
        api: "fetch",
        sink: "op_fetch",
        property: "method",
        nth: 0,
    },
    {
        attack: "SSRF",
        api: "fetch",
        sink: "op_fetch",
        property: "0",
        nth: 1,
    },

    {
        attack: "Privilege Escalation",
        api: "Worker",
        sink: "op_create_worker",
        property: "env",
        nth: 0,
    },
    {
        attack: "Privilege Escalation",
        api: "Worker",
        sink: "op_create_worker",
        property: "ffi",
        nth: 0,
    },
    {
        attack: "Privilege Escalation",
        api: "Worker",
        sink: "op_create_worker",
        property: "hrtime",
        nth: 0,
    },
    {
        attack: "Privilege Escalation",
        api: "Worker",
        sink: "op_create_worker",
        property: "net",
        nth: 0,
    },
    {
        attack: "Privilege Escalation",
        api: "Worker",
        sink: "op_create_worker",
        property: "read",
        nth: 0,
    },
    {
        attack: "Privilege Escalation",
        api: "Worker",
        sink: "op_create_worker",
        property: "run",
        nth: 0,
    },
    {
        attack: "Privilege Escalation",
        api: "Worker",
        sink: "op_create_worker",
        property: "sys",
        nth: 0,
    },
    {
        attack: "Privilege Escalation",
        api: "Worker",
        sink: "op_create_worker",
        property: "write",
        nth: 0,
    },

    {
        attack: "Path traversal",
        api: "Deno.makeTempDir",
        sink: "op_fs_make_temp_dir_async",
        property: "dir",
        nth: 1,
    },
    {
        attack: "Path traversal",
        api: "Deno.makeTempDir",
        sink: "op_fs_make_temp_dir_async",
        property: "prefix",
        nth: 2,
    },
    {
        attack: "Path traversal",
        api: "Deno.makeTempDirSync",
        sink: "op_fs_make_temp_dir_sync",
        property: "dir",
        nth: 0,
    },
    {
        attack: "Path traversal",
        api: "Deno.makeTempDirSync",
        sink: "op_fs_make_temp_dir_sync",
        property: "prefix",
        nth: 1,
    },

    {
        attack: "Path traversal",
        api: "Deno.makeTempFile",
        sink: "op_fs_make_temp_file_async",
        property: "dir",
        nth: 1,
    },
    {
        attack: "Path traversal",
        api: "Deno.makeTempFile",
        sink: "op_fs_make_temp_file_async",
        property: "prefix",
        nth: 2,
    },
    {
        attack: "Path traversal",
        api: "Deno.makeTempFileSync",
        sink: "op_fs_make_temp_file_sync",
        property: "dir",
        nth: 0,
    },
    {
        attack: "Path traversal",
        api: "Deno.makeTempFileSync",
        sink: "op_fs_make_temp_file_sync",
        property: "prefix",
        nth: 1,
    },

    {
        attack: "Privilege Escalation",
        api: "Deno.mkdir",
        sink: "op_fs_mkdir_async",
        property: "mode",
        nth: 3,
    },
    {
        attack: "Privilege Escalation",
        api: "Deno.mkdir",
        sink: "op_fs_mkdir_sync",
        property: "mode",
        nth: 2,
    },

    {
        attack: "Unauthorized Modifications",
        api: "Deno.open",
        sink: "op_fs_open_async",
        property: "append",
        nth: 2,
    },
    {
        attack: "Privilege Escalation",
        api: "Deno.open",
        sink: "op_fs_open_async",
        property: "mode",
        nth: 2,
    },
    {
        attack: "Unauthorized Modifications",
        api: "Deno.open",
        sink: "op_fs_open_async",
        property: "truncate",
        nth: 2,
    },
    {
        attack: "Unauthorized Modifications",
        api: "Deno.openSync",
        sink: "op_fs_open_sync",
        property: "append",
        nth: 1,
    },
    {
        attack: "Privilege Escalation",
        api: "Deno.openSync",
        sink: "op_fs_open_sync",
        property: "mode",
        nth: 1,
    },
    {
        attack: "Unauthorized Modifications",
        api: "Deno.openSync",
        sink: "op_fs_open_sync",
        property: "truncate",
        nth: 1,
    },

    {
        attack: "Unauthorized Modifications",
        api: "Deno.writeFile",
        sink: "op_fs_write_file_async",
        property: "append",
        nth: 3,
        i: 1,
    },
    {
        attack: "Privilege Escalation",
        api: "Deno.writeFile",
        sink: "op_fs_write_file_async",
        property: "mode",
        nth: 2,
        i: 1,
    },
    {
        attack: "Unauthorized Modifications",
        api: "Deno.writeFileSync",
        sink: "op_fs_write_file_sync",
        property: "append",
        nth: 2,
        i: 1,
    },
    {
        attack: "Privilege Escalation",
        api: "Deno.writeFileSync",
        sink: "op_fs_write_file_sync",
        property: "mode",
        nth: 1,
        i: 1,
    },

    {
        attack: "Unauthorized Modifications",
        api: "Deno.writeTextFile",
        property: "append",
        sink: "op_fs_write_file_async",
        property: "append",
        nth: 3,
        i: 2,
    },
    {
        attack: "Privilege Escalation",
        api: "Deno.writeTextFile",
        property: "mode",
        sink: "op_fs_write_file_async",
        property: "mode",
        nth: 2,
        i: 2,
    },
    {
        attack: "Unauthorized Modifications",
        api: "Deno.writeTextFileSync",
        sink: "op_fs_write_file_sync",
        property: "append",
        nth: 2,
        i: 2,
    },
    {
        attack: "Privilege Escalation",
        api: "Deno.writeTextFileSync",
        sink: "op_fs_write_file_sync",
        property: "mode",
        nth: 1,
        i: 2,
    },

    {
        attack: "Path Traversal",
        api: "Deno.run",
        sink: "op_run",
        property: "cwd",
        nth: 0,
    },
    {
        attack: "Privilege Escalation",
        api: "Deno.run",
        sink: "op_run",
        property: "gid",
        nth: 0,
    },
    {
        attack: "Privilege Escalation",
        api: "Deno.run",
        sink: "op_run",
        property: "uid",
        nth: 0,
    },

    {
        attack: "Path Traversal",
        api: "Deno.Command",
        sink: "op_spawn_child",
        property: "cwd",
        nth: 0,
        i: 1,
    },
    {
        attack: "Privilege Escalation",
        api: "Deno.Command",
        sink: "op_spawn_child",
        property: "gid",
        nth: 0,
        i: 1,
    },
    {
        attack: "Privilege Escalation",
        api: "Deno.Command",
        sink: "op_spawn_child",
        property: "uid",
        nth: 0,
        i: 1,
    },

    {
        attack: "Arbitrary Code Execution",
        api: "child_process.exec",
        sink: "op_spawn_child",
        property: "shell",
        nth: 0,
        i: 3,
    },
    {
        attack: "Arbitrary Code Execution",
        api: "child_process.exec",
        sink: "op_spawn_child",
        property: "env",
        nth: 0,
        i: 3,
    },

    {
        attack: "Arbitrary Code Execution",
        api: "child_process.execFileSync",
        sink: "op_spawn_child",
        property: "shell",
        nth: 0,
        i: 5,
    },
    {
        attack: "Arbitrary Code Execution",
        api: "child_process.execFileSync",
        sink: "op_spawn_child",
        property: "env",
        nth: 0,
        i: 5,
    },

    {
        attack: "Arbitrary Code Execution",
        api: "child_process.execSync",
        sink: "op_spawn_child",
        property: "shell",
        nth: 0,
        i: 4,
    },
    {
        attack: "Arbitrary Code Execution",
        api: "child_process.execSync",
        sink: "op_spawn_child",
        property: "env",
        nth: 0,
        i: 4,
    },

    {
        attack: "Arbitrary Code Execution",
        api: "child_process.spawn",
        sink: "op_spawn_child",
        property: "shell",
        nth: 0,
        i: 1,
    },
    {
        attack: "Arbitrary Code Execution",
        api: "child_process.spawn",
        sink: "op_spawn_child",
        property: "env",
        nth: 0,
        i: 1,
    },
    {
        attack: "Privilege Escalation",
        api: "child_process.spawn",
        sink: "op_spawn_child",
        property: "gid",
        nth: 0,
        i: 2,
    },
    {
        attack: "Privilege Escalation",
        api: "child_process.spawn",
        sink: "op_spawn_child",
        property: "uid",
        nth: 0,
        i: 2,
    },

    {
        attack: "Arbitrary Code Execution",
        api: "child_process.spawnSync",
        sink: "op_spawn_child",
        property: "shell",
        nth: 0,
        i: 2,
    },
    {
        attack: "Arbitrary Code Execution",
        api: "child_process.spawnSync",
        sink: "op_spawn_child",
        property: "env",
        nth: 0,
        i: 2,
    },

    {
        attack: "Loop",
        api: "fs.appendFile",
        testFile: "deno/cli/tests/unit_node/_fs/_fs_appendFile_test.ts",
        property: "length",
    },
    {
        attack: "Out Of Memory",
        api: "fs.appendFile",
        testFile: "deno/cli/tests/unit_node/_fs/_fs_appendFile_test.ts",
        property: "offset",
    },

    {
        attack: "Loop",
        api: "fs.writeFile",
        testFile: "deno/cli/tests/unit_node/_fs/_fs_writeFile_test.ts",
        property: "length",
    },
    {
        attack: "Out Of Memory",
        api: "fs.writeFile",
        testFile: "deno/cli/tests/unit_node/_fs/_fs_writeFile_test.ts",
        property: "offset",
    },

    {
        attack: "SSRF",
        api: "http.request",
        sink: "op_node_http_request",
        property: "hostname",
        nth: 2,
        i: 1,
    },
    {
        attack: "SSRF",
        api: "http.request",
        sink: "op_node_http_request",
        property: "method",
        nth: 0,
        i: 1,
    },
    {
        attack: "SSRF",
        api: "http.request",
        sink: "op_node_http_request",
        property: "path",
        nth: 1,
        i: 1,
    },
    {
        attack: "SSRF",
        api: "http.request",
        sink: "op_node_http_request",
        property: "port",
        nth: 1,
        i: 1,
    },

    {
        attack: "SSRF",
        api: "https.request",
        sink: "op_node_http_request",
        property: "hostname",
        nth: 2,
        i: 2,
    },
    {
        attack: "SSRF",
        api: "https.request",
        sink: "op_node_http_request",
        property: "method",
        nth: 0,
        i: 2,
    },
    {
        attack: "SSRF",
        api: "https.request",
        sink: "op_node_http_request",
        property: "path",
        nth: 1,
        i: 2,
    },
    {
        attack: "SSRF",
        api: "https.request",
        sink: "op_node_http_request",
        property: "port",
        nth: 1,
        i: 2,
    },

    {
        attack: "Panic",
        api: "zlib.createBrotliCompress",
        testFile: "deno/cli/tests/unit_node/zlib_test.ts",
        property: "params",
    },

    {
        attack: "Unauthorized Modifications",
        api: "json.JsonStringifyStream",
        sink: "op_get_non_index_property_names",
        property: "prefix",
        nth: 0,
    },
    {
        attack: "Unauthorized Modifications",
        api: "json.JsonStringifyStream",
        sink: "op_get_non_index_property_names",
        property: "suffix",
        nth: 0,
    },

    {
        attack: "Log Pollution",
        api: "log.FileHandler",
        sink: "op_encode",
        property: "formatter",
        nth: 0,
    },

    {
        attack: "Privelege Escalation",
        api: "tar.Tar.append",
        sink: "op_encode",
        property: "gid",
        nth: 0,
    },
    {
        attack: "Privelege Escalation",
        api: "tar.Tar.append",
        sink: "op_encode",
        property: "uid",
        nth: 0,
    },

    {
        attack: "Out Of Memory",
        api: "yaml.stringify",
        testFile: "deno_std/yaml/stringify_test.ts",
        property: "indent",
    },
];

function main(sarifFiles) {
    const data = sarifFiles
        .map(sarifFile => fs.readFileSync(sarifFile, { encoding: "utf-8" }))
        .map(sarifRaw => JSON.parse(sarifRaw))
        .reduce((acc, cur) => [...acc, ...cur.runs[0].results], [])

    const result = lookingFor
        .map(looking => {
            return {
                ...looking,
                found: data.filter(found =>
                    (
                        found.message.text.includes(`${looking.sink}()`)
                        && found.message.text.includes(`has ${looking.nth}th TAINTED`)
                        && found.message.text.includes(`property: "${looking.property}"`)
                    )
                    ||
                    (
                        found.message.text.includes(`"${looking.testFile}"`)
                        && found.message.text.includes(`property "${looking.property}"`)
                    )
                ).length >= (looking.i || 1),
            };
        })
        .map(entry => ({
            Found: entry.found,
            Gadget: entry.api,
            Property: entry.property,
        }));

    console.table(result);
}

const sarifFiles = process.argv
    .slice(2, /* end */)
    .map(entry => path.resolve(".", entry));
main(sarifFiles);
