import fs from 'fs'
import path from 'path'
import arg from '../shared/arg'
import build from '../build'

const helpMessage = `Compiles the postjs app for production deployment

Usage
    $ post build <dir>

<dir> represents the directory of the postjs app.
If the <dir> is empty, the current directory will be used.
`

export default function (...argv: string[]) {
    const { _: [dir = '.'] } = arg({}, { argv, helpMessage })

    const appDir = path.resolve(dir)
    if (!fs.existsSync(appDir)) {
        console.error(`no such directory: ${dir}`)
        process.exit(0)
    }

    build(appDir)
}
