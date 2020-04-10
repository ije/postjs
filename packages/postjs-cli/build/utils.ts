import * as postjs from '@postjs/core'
import { utils } from '@postjs/core'
import { createHash } from 'crypto'
import glob from 'glob'
import * as React from 'react'
import * as ReactDom from 'react-dom'
import webpack from 'webpack'
import DynamicEntryPlugin from 'webpack/lib/DynamicEntryPlugin'

export const peerDeps = {
    'react': React,
    'react-dom': ReactDom,
    '@postjs/core': postjs
}

// A component returns nothing
export const NullComponent = () => null

// Based on https://github.com/webpack/webpack/blob/master/lib/DynamicEntryPlugin.js
export function addEntry(
    compilation: webpack.compilation.Compilation,
    context: string,
    name: string,
    entry: string[]
) {
    return new Promise((resolve, reject) => {
        const dep = DynamicEntryPlugin.createDependency(entry, name)
        compilation.addEntry(context, dep, name, (err: Error | null) => {
            if (err) {
                reject(err)
                return
            }
            resolve()
        })
    })
}

export function getJSXFiles(dir: string, root: string) {
    return glob.sync(
        dir + '**/*.{js,jsx,mjs,ts,tsx}',
        { cwd: root }
    ).filter(p => /^[a-z0-9/.$*_~ -]+$/i.test(p))
}

export function runJS(code: string, peerDeps: Record<string, any>) {
    const exports: Record<string, any> = {}
    const fn = new Function('require', 'exports', 'module', code)
    fn((name: string) => peerDeps[name], exports, undefined)
    return exports
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
    styles?: { [key: string]: string, content: string }[],
    scripts?: (string | { type?: string, id?: string, src?: string, async?: boolean, innerText?: string })[],
    body: string
}) {
    return (`<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charSet="utf-8" />
${head.filter(v => /^\s*<[a-z0-9-]+[> ]/i.test(v))
            .concat(scripts.map(v => {
                if (!utils.isString(v) && utils.isNEString(v.src) && v.async === true) {
                    return `<link rel="preload" href=${JSON.stringify(v.src)} as="script" />`
                } else {
                    return ''
                }
            }).filter(Boolean))
            .concat(styles.map(({ content, ...rest }) => {
                if (utils.isNEString(content)) {
                    return `<style${toAttrs(rest)}>${content}</style>`
                } else {
                    return ''
                }
            }).filter(Boolean))
            .map(v => ' '.repeat(4) + v).join('\n')}
</head>
<body>
    <main>${body}</main>
${scripts
            .map(v => {
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
            .map(v => ' '.repeat(4) + v).join('\n')}
</body>
</html>`)
}

function toAttrs(v: any) {
    return Object.keys(v).map(k => ` ${k}=${JSON.stringify(String(v[k]))}`).join('')
}
