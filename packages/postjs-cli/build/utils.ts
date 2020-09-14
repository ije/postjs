import { utils } from '@postjs/core'
import { createHash } from 'crypto'
import { ComponentType } from 'react'

export function runJS(code: string, peerDeps: Record<string, any>) {
    const exports: Record<string, any> = {}
    const fn = new Function('require', 'exports', 'module', code)
    fn((name: string) => peerDeps[name], exports, undefined)
    return exports
}

export async function callGetStaticProps(component: ComponentType, ...args: any[]) {
    const getStaticProps = component['getStaticProps']
    if (utils.isFunction(getStaticProps)) {
        const props = await getStaticProps(...args)
        if (utils.isObject(props)) {
            return props
        } else if (props !== undefined && props !== null) {
            return { _: props }
        }
    }
    return null
}

export function matchPath(routePath: string, locPath: string): [Record<string, string>, boolean] {
    const routeSegments = utils.cleanPath(routePath).replace(/^\//, '').split('/')
    const locSegments = utils.cleanPath(locPath).replace(/^\//, '').split('/')
    const isRoot = locSegments[0] === ''
    const max = Math.max(routeSegments.length, locSegments.length)
    const params: Record<string, string> = {}

    let ok = true

    for (let i = 0; i < max; i++) {
        const routeSeg = routeSegments[i]
        const locSeg = locSegments[i]

        if (locSeg === undefined || routeSeg === undefined) {
            ok = false
            break
        }

        if (routeSeg === '*') {
            params['*'] = locSegments.slice(i).map(decodeURIComponent).join('/')
            break
        }

        if (!isRoot && routeSeg.startsWith('$')) {
            params[routeSeg.slice(1)] = decodeURIComponent(locSeg)
        } else if (routeSeg !== locSeg) {
            ok = false
            break
        }
    }

    return [params, ok]
}

export function createHtml({
    lang = 'en',
    head = [],
    styles = [],
    scripts = [],
    body
}: {
    lang?: string,
    head?: string[],
    styles?: { [key: string]: any, content: string, plain?: boolean }[],
    scripts?: (string | { type?: string, id?: string, src?: string, async?: boolean, innerText?: string })[],
    body: string
}) {
    const headTags = head.filter(v => /^\s*<[a-z0-9-]+[> ]/i.test(v))
        .concat(scripts.map(v => {
            if (!utils.isString(v) && utils.isNEString(v.src) && v.async === true) {
                return `<link rel="preload" href=${JSON.stringify(v.src)} as="script" />`
            } else {
                return ''
            }
        }).filter(Boolean))
        .concat(styles.map(({ content, plain, ...rest }) => {
            content = content.trim()
            if (plain) {
                return content
            } else if (content) {
                return `<style${toAttrs(rest)}>\n${content}\n    </style>`
            } else {
                return ''
            }
        }).filter(Boolean))
    const scriptTags = scripts.map(v => {
        if (utils.isString(v)) {
            return `<script integrity="sha256-${createHash('sha256').update(v).digest('base64')}">${v}</script>`
        } else if (utils.isNEString(v.innerText)) {
            const { innerText, ...rest } = v
            return `<script${toAttrs(rest)}>${innerText}</script>`
        } else if (utils.isNEString(v.src)) {
            return `<script${toAttrs(v)}></script>`
        } else {
            return ''
        }
    }).filter(Boolean)

    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charSet="utf-8" />
    ${headTags.join('\n' + ' '.repeat(4))}
</head>
<body>
    <main>${body}</main>
    ${scriptTags.join('\n' + ' '.repeat(4))}
</body>
</html>`
}

function toAttrs(v: any) {
    return Object.keys(v).map(k => ` ${k}=${JSON.stringify(String(v[k]))}`).join('')
}
