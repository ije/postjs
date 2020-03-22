#!/usr/bin/env node
import arg from 'arg'
import fs from 'fs-extra'
import path from 'path'

const commands = {
    build: () => import('./post-build').then(mod => mod.default),
    dev: () => import('./post-dev').then(mod => mod.default),
    export: () => import('./post-export').then(mod => mod.default),
    start: () => import('./post-start').then(mod => mod.default)
} as { [key: string]: () => Promise<{ (...args: string[]): void }> }
const helpMessage = `Usage
    $ post <command> [...option]
Commands
    ${Object.keys(commands).join(', ')}
Options
    --version, -v   Print version number
    --help, -h      Print help message
`
const {
    '--version': v,
    '--help': h,
    _: args
} = arg(
    {
        '--version': Boolean,
        '--help': Boolean,
        // aliases
        '-v': '--version',
        '-h': '--help'
    },
    { permissive: true }
)
const hasCommand = args.length > 0 && args[0] in commands
const command = hasCommand ? args[0] : 'dev'
const commandArgs = hasCommand ? args.slice(1) : args

// print version
if (v) {
    const { version } = fs.readJSONSync(path.join(__dirname, '../../package.json'))
    console.log(`postUI v${version}`)
    process.exit(0)
}

// print help message
if (!hasCommand && h) {
    console.log(helpMessage)
    process.exit(0)
}

// execute command
commands[command]().then(cmd => {
    cmd(...commandArgs)
})
