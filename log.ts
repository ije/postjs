import { fmt } from './package.ts'

export default {
    debug(...args: unknown[]) {
        console.log(colorfulTag('debug', fmt.blue), ...args)
    },
    info(...args: unknown[]) {
        console.log(colorfulTag('info', fmt.green), ...args)
    },
    warn(...args: unknown[]) {
        console.log(colorfulTag('warn', fmt.yellow), ...args)
    },
    error(...args: unknown[]) {
        console.log(colorfulTag('error', fmt.red), ...args)
    }
}

function colorfulTag(tag: string, colorful: (text: string) => string) {
    return [fmt.dim('['), colorful(tag), fmt.dim(']')].join(' ')
}
