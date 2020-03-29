import fs from 'fs'
import path from 'path'
import arg from '../shared/arg'
import { Server } from '../server'

const helpMessage = `Starts the postjs app in development mode

Usage
    $ post dev <dir> [...option]

<dir> represents the directory of the postjs app.
If the <dir> is empty, the current directory will be used.

Options
    --port, -p   A port number to start the postjs app, default is 8080
    --help, -h   Print the help message
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
        console.log(`invalid port ${port}`)
        process.exit(0)
        return
    }

    (new Server(appDir, 'development')).start(parseInt(port))
    console.log(`Server ready on http://localhost:${port}`)
}
