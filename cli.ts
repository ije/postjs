import { path } from './package.ts'
import { version } from './version.ts'

// parse deno args
const args: Array<string>= []
const argOptions: Record<string, string|boolean> = {}
for (let i = 0; i < Deno.args.length; i++) {
    const arg = Deno.args[i]
    if (arg.startsWith('-')) {
        if (arg.includes('=')) {
            const [key, value] = arg.replace(/^-+/, '').split('=', 2)
            argOptions[key] = value
        } else {
            const key = arg.replace(/^-+/, '')
            const nextArg = Deno.args[i+1]
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

const commands = ['dev', 'build', 'start', 'export']
const hasCommand = args.length > 0 && commands.includes(args[0])
const command = hasCommand? args.shift() : 'dev'
const helpMessage = `postjs v${version}
The radical new Front-End Framework with deno

Docs: https://postjs.io/docs
Bugs: https://github.com/postui/postjs/issues

Usage:
    deno --allow-all https://postjs.io/cli.ts <command> [...options]

Commands:
    ${commands.join(', ')}

Options:
    -h, --help     Prints help message
    -v, --version  Prints version information
`

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
if (!hasCommand && (argOptions.h || argOptions.help)) {
    console.log(helpMessage)
    Deno.exit(0)
}

// execute command
import(`./cli-${command}.ts`).then(({ default: cmd }) => {
    cmd(path.resolve(args[0] || '.'), argOptions)
})
