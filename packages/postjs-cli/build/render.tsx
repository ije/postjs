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

export const html = ({ lang, helmet, body, scripts }: { lang: string, body: string, helmet?: string[], scripts?: (string | { src: string, async?: boolean })[] }) => (
    `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="utf-8">
${(helmet || [])
        .concat((scripts || []).map(v => {
            if (!utils.isNEString(v) && v.async && utils.isNEString(v.src.trim())) {
                return `<link rel="preload" href="${v.src.trim()}" as="script">`
            } else {
                return ''
            }
        }).filter(v => !!v))
        .map(v => v.trim()).filter(v => !!v).map(v => ' '.repeat(4) + v).join('\n')}
</head>
<body>
    <main>${body}</main>
${(scripts || [])
        .map(v => {
            if (utils.isNEString(v)) {
                const js = v.trim()
                return `<script integrity="sha256-${createHash('sha256').update(js).digest('base64')}">${js}</script>`
            } else if (utils.isNEString(v.src.trim())) {
                return `<script src="${v.src.trim()}"${v.async ? ' async' : ''}></script>`
            } else {
                return ''
            }
        }).filter(v => !!v).map(v => ' '.repeat(4) + v).join('\n')}
</body>
</html>`
)

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

export function runJS(source: string, deps: Record<string, any>, injects?: Record<string, any>) {
    const exports: { [key: string]: any } = {}
    const func = new Function('require', 'exports', ...Object.keys(injects || {}).concat(['module', source]))
    const { window } = new JSDOM('', { pretendToBeVisual: true })
    Object.assign(window, { fetch })
    Object.assign(globalThis, { window, fetch, document: window.document })
    func((name: string) => deps[name], exports, ...Object.values(injects || {}))
    return exports
}
