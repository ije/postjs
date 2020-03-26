import * as React from 'react'
import * as ReactDom from 'react-dom'
import * as Postjs from '@postjs/core'
import fs from 'fs-extra'
import path from 'path'
import { createHash } from 'crypto'
import { JSDOM } from 'jsdom'
import fetch from 'node-fetch'
import { getAppConfig, pageComponentStaticMethods } from './app'
import { renderPage } from './renderer'
import { Compiler } from './webpack'

const peerDeps = {
    'react': React,
    'react-dom': ReactDom,
    '@postjs/core': Postjs
}
const { window } = new JSDOM('', { pretendToBeVisual: true })

Object.assign(window, { fetch })
Object.assign(globalThis, { window, fetch, document: window.document })

export default async function (dir: string) {
    const appDir = path.resolve(dir)
    if (!fs.existsSync(appDir)) {
        console.error(`no such directory: ${dir}`)
        process.exit(0)
    }

    const appConfig = await getAppConfig(appDir)
    const { chuncks } = await new Compiler(appDir, `
        const req = require.context('./pages', true, /\\.(js|ts)x?$/i)
        const pages = {}

        req.keys().forEach(path => {
            const mod = req(path)
            const component = mod.default
            const pathname = path.replace(/^\\.+/, '').replace(/(\\/index)?\\\.(js|ts)x?$/i, '') || '/'
            const staticMethods = ['${pageComponentStaticMethods.join("','")}']
            staticMethods.forEach(name => {
                if (typeof mod[name] === 'function' && typeof component[name] !== 'function') {
                    component[name] = mod[name]
                }
            })
            pages[pathname] = { format: path.split('.').pop(), component }
        })

        exports.pages = pages
    `, {
        mode: 'production',
        target: 'node',
        externals: Object.keys(peerDeps)
    }).compile()
    const { pages } = runJS(chuncks.get('app')!.content, peerDeps)
    const { hash, chuncks: chuncks2 } = await new Compiler(appDir, (() => {
        const entry: Record<string, string> = {
            app: `
                import React, { useEffect, useMemo, useState } from 'react'
                import ReactDom from 'react-dom'
                import { route, RouterContext, RouterStore } from '@postjs/core'

                function Router({ initialPage }) {
                    const [page, setPage] = useState(initialPage)

                    useEffect(() => {
                        const update = () => {
                            const [url, Component] = route('${appConfig.baseUrl}', Object.values(window.__POST_PAGES || {}))
                            const ssrData = window.__POST_SSR_DATA || {}
                            let staticProps = null
                            if (url.pagePath && url.pagePath in ssrData) {
                                staticProps = (ssrData[url.pagePath] ||{}).staticProps || null
                            }
                            setPage({ url, staticProps, Component })
                        }
                        window.addEventListener('popstate', update, false)
                        return () => window.removeEventListener('popstate', update, false)
                    }, [])

                    return (
                        <RouterContext.Provider value={new RouterStore(page.url)}>
                            <page.Component {...page.staticProps} />
                        </RouterContext.Provider>
                    )
                }

                window.addEventListener('load', () => {
                    const { __POST_INITIAL_PAGE, __POST_SSR_DATA } = window
                    if (__POST_INITIAL_PAGE) {
                        const { component } = __POST_INITIAL_PAGE
                        const { url, staticProps } = __POST_SSR_DATA
                        __POST_SSR_DATA[url.pagePath] = staticProps
                        ReactDom.hydrate((
                            <Router initialPage={{ url, staticProps, Component: component }} />
                        ), document.querySelector('main'))
                    }
                }, false)
            `
        }
        for (const pagePath of Object.keys(pages)) {
            const pageName = pagePath.replace(/^\/+/, '') || 'index'
            entry['pages/' + pageName] = `
                import component from '${path.join(appDir, 'pages', pageName)}.${pages[pagePath].format}'

                const exportAs = { path: '${pagePath}', component }
                if (!window.__POST_INITIAL_PAGE) {
                    window.__POST_INITIAL_PAGE = exportAs
                }
                (window.__POST_PAGES = window.__POST_PAGES || {})['${pagePath}'] = exportAs
            `
        }
        return entry
    })(), {
        mode: 'production'
    }).compile()
    const buildManifest: Record<string, any> = { pages: {} }
    for (const name of chuncks2.keys()) {
        const jsFile = path.join(appDir, '.post/builds', hash, '_dist', `${name}.js`)
        await fs.ensureDir(path.dirname(jsFile))
        await fs.writeFile(jsFile, chuncks2.get(name)!.content)
    }
    for (const pagePath of Object.keys(pages)) {
        const pageName = pagePath.replace(/^\/+/, '') || 'index'
        const url = { pagePath, pathname: pagePath, params: {}, query: {} }
        const { staticProps, helmet, body } = await renderPage(url, pages[pagePath].component)
        const htmlFile = path.join(appDir, '.post/builds', hash, pageName + '.html')
        const pageJS = chuncks2.get('pages/' + pageName)!
        const dataJS = 'window.__POST_SSR_DATA = ' + JSON.stringify({ url, staticProps })
        await fs.ensureDir(path.dirname(htmlFile))
        await fs.writeFile(htmlFile, `<!DOCTYPE html>
<html lang="${appConfig.lang}">
<head>
    <meta charset="utf-8">
${helmet}
</head>
<body>
    <main>${body}</main>
    <script integrity="sha256-${createHash('sha256').update(dataJS).digest('base64')}">${dataJS}</script>
    <script src="_dist/build-manifest.js?v=${hash}"></script>
    <script src="_dist/pages/${pageName}.js?v=${pageJS.hash}"></script>
${Array.from(chuncks2.values()).filter(({ name }) => !name.startsWith('pages/')).map(({ name, hash }) => ' '.repeat(4) + `<script src="_dist/${name}.js?v=${hash}"></script>`).join('\n')}
</body>
</html>`)
        buildManifest.pages[pagePath] = {
            hash: pageJS.hash,
            hasStaticProps: staticProps !== null
        }
    }
    await fs.writeFile(path.join(appDir, '.post/builds', hash, '_dist', 'build-manifest.js'), 'window.__POST_BUILD_MANIFEST = ' + JSON.stringify(buildManifest))
    console.log('done', hash)
}

function runJS(source: string, deps: Record<string, any>) {
    const exports: { [key: string]: any } = {}
    new Function('require', 'exports', 'module', source)((name: string) => deps[name], exports)
    return exports
}
