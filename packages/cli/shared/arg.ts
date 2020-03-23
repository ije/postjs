import arg from 'arg'

interface Options extends arg.Options {
    helpMessage?: string
}

export default function <T extends arg.Spec>(spec: T, options?: Options): arg.Result<T> {
    const { helpMessage } = options || {}
    if (helpMessage) {
        Object.assign(spec, {
            '--help': Boolean,
            '-h': '--help'
        })
    }
    const ret = arg(spec, options)
    if (ret['--help'] && helpMessage) {
        console.log(helpMessage)
        process.exit(0)
    }
    return ret
}
