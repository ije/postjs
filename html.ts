import util from './util.ts'

export function createHtml({
    lang = 'en',
    head = [],
    scripts = [],
    body
}: {
    lang?: string,
    head?: string[],
    scripts?: (string | { type?: string, id?: string, src?: string, async?: boolean, innerText?: string })[],
    body: string
}) {
    const headTags = head.map(tag => tag.trim())
        .concat(scripts.map(v => {
            if (!util.isString(v) && util.isNEString(v.src)) {
                if (v.type === 'module') {
                    return `<link rel="modulepreload" href=${JSON.stringify(v.src)} />`
                } else if (v.async === true) {
                    return `<link rel="preload" href=${JSON.stringify(v.src)} as="script" />`
                }
            }
            return ''
        })).filter(Boolean)
    const scriptTags = scripts.map(v => {
        if (util.isString(v)) {
            return `<script>${v}</script>`
            // return `<script integrity="sha256-${createHash('sha256').update(v).digest('base64')}">${v}</script>`
        } else if (util.isNEString(v.innerText)) {
            const { innerText, ...rest } = v
            return `<script${toAttrs(rest)}>${innerText}</script>`
        } else if (util.isNEString(v.src)) {
            return `<script${toAttrs(v)}></script>`
        } else {
            return ''
        }
    }).filter(Boolean)

    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charSet="utf-8" />${
        headTags.map(tag => '\n' + ' '.repeat(4) + tag).join('')
        }
</head>
<body>
    ${body}${
        scriptTags.map(tag => '\n' + ' '.repeat(4) + tag).join('')
        }
</body>
</html>`
}

function toAttrs(v: any) {
    return Object.keys(v).map(k => ` ${k}=${JSON.stringify(String(v[k]))}`).join('')
}
