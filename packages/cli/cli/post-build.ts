import arg from '../shared/arg'
import build from '../build'

const helpMessage = `Compiles the postio for production deployment

Usage
    $ post build <dir>

<dir> represents the directory of the postio.
If the <dir> is empty, the current directory will be used.
`

export default function (...argv: string[]) {
    const { _: [dir = '.'] } = arg({}, { argv, helpMessage })

    build(dir)
}
