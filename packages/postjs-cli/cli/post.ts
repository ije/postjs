#!/usr/bin/env node
import arg from 'arg'
import fs from 'fs-extra'
import fetch from 'node-fetch'
import path from 'path'

const {
    '--version': v,
    '--help': h,
    _: args
} = arg(
    {
        '--version': Boolean,
        '--help': Boolean,
        '-v': '--version',
        '-h': '--help'
    },
    { permissive: true }
)
const commands = ['build', 'dev', 'start']
const hasCommand = args.length > 0 && commands.includes(args[0])
const command = hasCommand ? args[0] : 'dev'
const commandArgs = hasCommand ? args.slice(1) : args
const helpMessage = `Usage
    $ post <command> [...option]
Commands
    ${commands.join(', ')}
Options
    --version, -v    Print version number
    --help, -h       Print help message
`

// print the version number in package.json
if (v) {
    const { version } = fs.readJSONSync(path.join(__dirname, '../../package.json'))
    console.log(`postjs v${version}`)
    process.exit(0)
}

// print help message
if (!hasCommand && h) {
    console.log(helpMessage)
    process.exit(0)
}

// extend globalThis
Object.assign(globalThis, { fetch })
// const { window: vw } = new JSDOM(undefined, { url: 'http://localhost/', pretendToBeVisual: true })
// Object.keys(vw).forEach(key => {
//     if (!key.startsWith('_') && !/^(set|clear)(Timeout|Interval)$/.test(key)) {
//         globalThis[key] = vw[key]
//     }
// })

// execute command
if (h) {
    commandArgs.push('--help')
}
import(`./post-${command}`).then(({ default: cmd }) => {
    cmd(...commandArgs)
})
