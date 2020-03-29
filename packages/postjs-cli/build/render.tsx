import React, { ComponentType } from 'react'
import { renderToString } from 'react-dom/server'
import { renderHeadToString, RouterContext, RouterStore, URL } from '@postjs/core'
import { createHash } from 'crypto'
import { JSDOM } from 'jsdom'
import fetch from 'node-fetch'
import utils from '../shared/utils'

export const html = ({ lang, helmet, body, scripts }: { lang: string, helmet: string, body: string, scripts?: any[] }) => (
    `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="utf-8">
    ${helmet.trimLeft()}
</head>
<body>
    <main>${body}</main>
${(scripts || []).map(v => {
        if (utils.isNEString(v)) {
            return `<script integrity="sha256-${createHash('sha256').update(v).digest('base64')}">${v}</script>`
        } else if (utils.isObject(v) && utils.isNEString(v.src)) {
            return `<script src="${v.src}"${v.async ? ' async' : ''}></script>`
        }
        return ''
    }).filter(v => v !== '').map(v => ' '.repeat(4) + v).join('\n')}
</body>
</html>`
)

export async function renderPage(url: URL, PageComponent: ComponentType) {
    let staticProps: any = null
    if ('getStaticProps' in PageComponent) {
        const getStaticProps = (PageComponent as any)['getStaticProps']
        if (typeof getStaticProps === 'function') {
            const props = await getStaticProps(url)
            if (utils.isObject(props)) {
                staticProps = props
            }
        }
    }

    const body = renderToString((
        <RouterContext.Provider value={new RouterStore(url)}>
            <PageComponent {...staticProps} />
        </RouterContext.Provider>
    ))
    const helmet = renderHeadToString(4)

    return {
        body,
        helmet,
        staticProps
    }
}

export function runJS(source: string, deps: Record<string, any>, injects?: Record<string, any>) {
    const exports: { [key: string]: any } = {}
    const fn = new Function('require', 'exports', ...Object.keys(injects || {}).concat(['module', source]))
    const { window } = new JSDOM('', { pretendToBeVisual: true })
    Object.assign(window, { fetch })
    Object.assign(globalThis, { window, fetch, document: window.document })
    fn((name: string) => deps[name], exports, ...Object.values(injects || {}))
    return exports
}
