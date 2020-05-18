import { base64, Sha256 } from './deps.ts'
import util from './util.ts'

export function createHtml({
    lang = 'en',
    head = [],
    scripts = [],
    body,
    minify = false
}: {
    lang?: string,
    head?: string[],
    scripts?: (string | { type?: string, id?: string, src?: string, async?: boolean, innerText?: string, preload?: boolean })[],
    body: string,
    minify?: boolean
}) {
    const indent = minify ? '' : ' '.repeat(4)
    const eol = minify ? '' : '\n'
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
            return `<script integrity="${genIntegrity(v)}">${v}</script>`
        } else if (util.isNEString(v.innerText)) {
            const { innerText, ...rest } = v
            return `<script${toAttrs(rest)}>${innerText}</script>`
        } else if (util.isNEString(v.src) && !v.preload) {
            return `<script${toAttrs(v)}></script>`
        } else {
            return ''
        }
    }).filter(Boolean)

    return [
        '<!DOCTYPE html>',
        `<html lang="${lang}">`,
        '<head>',
        `${indent}<meta charSet="utf-8" />`,
        ...headTags.map(tag => indent + tag),
        '</head>',
        '<body>',
        indent + body,
        ...scriptTags.map(tag => indent + tag),
        '</body>',
        '</html>'
    ].join(eol)
}

function toAttrs(v: any): string {
    return Object.keys(v).map(k => ` ${k}=${JSON.stringify(String(v[k]))}`).join('')
}

function genIntegrity(v: string): string {
    const sha256 = new Sha256()
    const arr = new Uint8Array(sha256.update(v).digest())
    return 'sha256-' + base64.fromUint8Array(arr)
}
