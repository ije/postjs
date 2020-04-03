import fs from 'fs'
import path from 'path'
import { start } from '../server'
import arg from '../shared/arg'

const helpMessage = `Starts the postjs app in production mode

Usage
    $ post start <dir> [...option]

<dir> represents the directory of the postjs app.
If the <dir> is empty, the current directory will be used.

Options
    --port, -p    A port number to start the postjs app, default is 8080
    --help, -h    Print help message
`

export default function (...argv: string[]) {
    const {
        '--port': port = '8080',
        _: [dir = '.']
    } = arg({
        '--port': String,
        '-p': '--port'
    }, {
        argv,
        helpMessage
    })

    const appDir = path.resolve(dir)
    if (!fs.existsSync(appDir)) {
        console.error(`no such directory: ${dir}`)
        process.exit(0)
    }

    if (!(/^\d+$/.test(port))) {
        console.log(`invalid port number ${port}`)
        process.exit(0)
        return
    }

    start(appDir, parseInt(port))
    console.log(`Server ready on http://localhost:${port}`)
}
