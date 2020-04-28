const Colors = {
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    underscore: '\x1b[4m',
    blink: '\x1b[5m',
    reverse: '\x1b[7m',
    hidden: '\x1b[8m',

    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',

    bgblack: '\x1b[40m',
    bgred: '\x1b[41m',
    bggreen: '\x1b[42m',
    bgyellow: '\x1b[43m',
    bgblue: '\x1b[44m',
    bgmagenta: '\x1b[45m',
    bgcyan: '\x1b[46m',
    bgwhite: '\x1b[47m'
}

type Color = keyof typeof Colors
export function colorful(text: string, ...colors: Color[]) {
    const colorCodes = Array.from(new Set(colors)).map(c => Colors[c]).filter(Boolean)
    if (colorCodes.length > 0) {
        return `${colorCodes.join('')}${text}\x1b[0m`
    }
    return text
}

export function colorfulTag(tag: string, ...colors: Color[]) {
    return [colorful('[', 'dim'), colorful(tag, ...colors), colorful(']', 'dim')].join(' ')
}
