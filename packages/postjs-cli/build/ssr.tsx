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

    const body = renderToString((
        <RouterContext.Provider value={new RouterStore(url)}>
            <PageComponent {...staticProps} />
        </RouterContext.Provider>
    ))
    const helmet = renderHeadToString()

    return {
        body,
        helmet,
        staticProps
    }
}

export function runSSRCode(code: string, peerDeps: Record<string, any>, globalVars?: Record<string, any>) {
    const { window } = new JSDOM('', { pretendToBeVisual: true })
    Object.assign(window, { fetch })
    Object.assign(globalThis, {
        window,
        fetch,
        document: window.document,
        location: window.location
    })

    const exports: Record<string, any> = {}
    const func = new Function('require', 'exports', ...Object.keys(globalVars || {}).concat(['module', code]))
    func((name: string) => peerDeps[name], exports, ...Object.values(globalVars || {}))
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
