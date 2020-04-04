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

export async function renderPage(url: URL, PageComponent: ComponentType<any>) {
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
        React.createElement(PageComponent, staticProps)
    ))
    const helmet = renderHeadToString()

    return {
        body,
        helmet,
        staticProps
    }
}

export function runSSRCode(code: string, peerDeps: Record<string, any>, globalVars?: Record<string, any>) {
    const { window } = new JSDOM(undefined, {
        url: 'http://localhost',
        pretendToBeVisual: true
    })
    Object.keys(window).filter(key => {
        return !key.startsWith('_') && !/^setTimeout|setInterval|clearTimeout|clearInterval$/.test(key)
    }).forEach(key => {
        globalThis[key] = window[key]
    })
    Object.assign(globalThis, { fetch }, globalVars)

    const exports: Record<string, any> = {}
    const func = new Function('require', 'exports', 'module', code)
    func.call(window, (name: string) => peerDeps[name], exports, undefined)
    return exports
}

export const html = ({ lang, helmet, body, scripts }: { lang: string, body: string, helmet?: string[], scripts?: (string | Record<string, any>)[] }) => (
    `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="utf-8">
${(helmet || [])
        .concat((scripts || []).map(v => {
            if (!utils.isNEString(v) && v.async === true && utils.isNEString(v.src)) {
                return `<link rel="preload" href=${JSON.stringify(v.src)} as="script">`
            } else {
                return ''
            }
        }).filter(Boolean))
        .map(v => v.trim()).filter(Boolean).map(v => ' '.repeat(4) + v).join('\n')}
</head>
<body>
    <main>${body}</main>
${(scripts || [])
        .map(v => {
            if (utils.isNEString(v)) {
                const js = v.trim()
                return `<script integrity="sha256-${createHash('sha256').update(js).digest('base64')}">${js}</script>`
            } else if (utils.isNEString(v.src)) {
                return `<script src=${JSON.stringify(v.src)}${v.async ? ' async' : ''}></script>`
            } else if (v.json && utils.isNEString(v.id) && utils.isObject(v.data)) {
                return `<script id=${JSON.stringify(v.id)} type="application/json">${JSON.stringify(v.data)}</script>`
            } else {
                return ''
            }
        }).filter(Boolean).map(v => ' '.repeat(4) + v).join('\n')}
</body>
</html>`
)
