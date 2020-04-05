import { renderHeadToString, RouterContext, RouterStore, URL } from '@postjs/core'
import { createHash } from 'crypto'
import { JSDOM } from 'jsdom'
import fetch from 'node-fetch'
import React, { ComponentType } from 'react'
import { renderToString } from 'react-dom/server'
import utils from '../shared/utils'

export const ssrStaticMethods = [
    'getStaticProps',
    'getStaticPaths'
]

export async function renderPage(
    APP: ComponentType<any>,
    appStaticProps: any,
    url: URL,
    PageComponent: ComponentType<any>
) {
    let staticProps: any = null
    if ('getStaticProps' in PageComponent) {
        const getStaticProps = (PageComponent as any)['getStaticProps']
        if (typeof getStaticProps === 'function') {
            const props = await getStaticProps(url)
            if (utils.isObject(props)) {
                staticProps = props
            } else {
                staticProps = {}
            }
        }
    }

    const body = renderToString(React.createElement(
        RouterContext.Provider,
        { value: new RouterStore(url) },
        React.createElement(
            APP,
            appStaticProps,
            React.createElement(
                PageComponent,
                Object.assign({}, appStaticProps, staticProps)
            )
        )
    ))
    const head = renderHeadToString()

    return {
        body,
        head,
        staticProps
    }
}

export function runJS(code: string, peerDeps: Record<string, any>, globalVars?: Record<string, any>) {
    const fn = new Function('require', 'exports', 'module', code)
    const exports: Record<string, any> = {}
    const { window } = new JSDOM(undefined, { url: 'http://localhost/', pretendToBeVisual: true })
    Object.keys(window).filter(key => {
        return !key.startsWith('_') && !/^(set|clear)(Timeout|Interval)$/.test(key)
    }).forEach(key => {
        globalThis[key] = window[key]
    })
    Object.assign(globalThis, { fetch }, globalVars)
    fn((name: string) => peerDeps[name], exports, undefined)
    return exports
}

export const html = ({
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
}) => (`<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charSet="utf-8" />
${head.filter(v => /^\s*<[a-z0-9\-]+[> ]/i.test(v))
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

function toAttrs(v: any) {
    return Object.keys(v).map(k => ` ${k}=${JSON.stringify(String(v[k]))}`).join('')
}
