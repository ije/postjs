import { existsSync, listenAndServe, path, ServerRequest } from './deps.ts'
import { createHtml } from './html.ts'
import log from './log.ts'
import { getContentType } from './server/mime.ts'
import { version } from './version.ts'

const commands = ['init', 'dev', 'build', 'start', 'export', 'fetch']
const helpMessage = `postjs v${version}
The radical new Front-End Framework with deno.

Docs: https://postjs.io/docs
Bugs: https://github.com/postui/postjs/issues

Usage:
    deno -A run https://postjs.io/cli.ts <command> [...options]

Commands:
    ${commands.join(', ')}

Options:
    -h, --help     Prints help message
    -v, --version  Prints version number
`

function main() {
    // parse deno args
    const args: Array<string> = []
    const argOptions: Record<string, string | boolean> = {}
    for (let i = 0; i < Deno.args.length; i++) {
        const arg = Deno.args[i]
        if (arg.startsWith('-')) {
            if (arg.includes('=')) {
                const [key, value] = arg.replace(/^-+/, '').split('=', 2)
                argOptions[key] = value
            } else {
                const key = arg.replace(/^-+/, '')
                const nextArg = Deno.args[i + 1]
                if (nextArg && !nextArg.startsWith('-')) {
                    argOptions[key] = nextArg
                    i++
                } else {
                    argOptions[key] = true
                }
            }
        } else {
            args.push(arg)
        }
    }

    // prints postjs version
    if (argOptions.v) {
        console.log(`postjs v${version}`)
        Deno.exit(0)
    }

    // prints postjs and deno version
    if (argOptions.version) {
        const { deno, v8, typescript } = Deno.version
        console.log(`postjs v${version}\ndeno v${deno}\nv8 v${v8}\ntypescript v${typescript}`)
        Deno.exit(0)
    }

    // prints help message
    const hasCommand = args.length > 0 && commands.includes(args[0])
    if (!hasCommand && (argOptions.h || argOptions.help)) {
        console.log(helpMessage)
        Deno.exit(0)
    }

    if (existsSync('./importmap.json')) {
        const { imports } = JSON.parse(Deno.readTextFileSync('./importmap.json'))
        Object.assign(globalThis, { POSTJS_IMPORT_MAP: { imports } })
        if (imports['https://postjs.io/']) {
            const match = String(imports['https://postjs.io/']).match(/^http:\/\/(localhost|127.0.0.1):(\d+)\/$/)
            if (match) {
                const port = parseInt(match[2])
                listenAndServe({ port }, async (req: ServerRequest) => {
                    const filepath = path.join(Deno.cwd(), req.url)
                    try {
                        const info = await Deno.lstat(filepath)
                        if (info.isDirectory) {
                            const r = Deno.readDir(filepath)
                            const items: string[] = []
                            for await (const item of r) {
                                if (!item.name.startsWith('.')) {
                                    items.push(`<li><a href="${path.join(req.url, encodeURI(item.name))}">${item.name}${item.isDirectory ? '/' : ''}<a></li>`)
                                }
                            }
                            req.respond({
                                status: 200,
                                headers: new Headers({
                                    'Content-Type': getContentType('.html')
                                }),
                                body: createHtml({
                                    head: [`<title>postjs.io</title>`],
                                    body: `<h1>&nbsp;postjs.io/</h1><ul>${Array.from(items).join('')}</ul>`
                                })
                            })
                            return
                        }

                        const body = await Deno.readFile(filepath)
                        req.respond({
                            status: 200,
                            headers: new Headers({
                                'Content-Type': getContentType(filepath),
                                'Content-Length': info.size.toString()
                            }),
                            body
                        })
                    } catch (err) {
                        if (err instanceof Deno.errors.NotFound) {
                            req.respond({
                                status: 404,
                                body: 'not found'
                            })
                            return
                        }
                        req.respond({
                            status: 500,
                            body: err.message
                        })
                    }
                })
                log.info(`Start postjs.io proxy server on http://localhost:${port}`)
            }
        }
    }

    // execute command
    const command = hasCommand ? args.shift() : 'dev'
    import(`./cli-${command}.ts`).then(({ default: cmd }) => {
        const appDir = path.resolve(args[0] || '.')
        if (!existsSync(appDir)) {
            log.error("No such app directory:", appDir)
            return
        }
        cmd(appDir, argOptions)
    })
}

if (import.meta.main) {
    main()
}
