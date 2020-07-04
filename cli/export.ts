
export const helpMessage = `Exports the postjs app to static webiste.

Usage:
    deno -A run https://postjs.io/cli.ts export <dir> [...options]

<dir> represents the directory of the postjs app,
if the <dir> is empty, the current directory will be used.

Options:
    -h, --help  Prints help message
`

export default function (appDir: string, options: Record<string, string | boolean>) {

}
