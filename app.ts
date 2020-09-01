import React, { ComponentType, useState } from 'react'
import { hydrate } from 'react-dom'
import { EventEmitter } from './events.ts'
import { route, RouterContext, RouterURL } from './router.ts'
import util from './util.ts'

interface Runtime {
    baseUrl: string
    defaultLocale: string
    locales: Record<string, Record<string, string>>
    appModule: { hash: string } | null
    pageModules: Record<string, { path: string, hash: string }>
    hmr: boolean
}

interface SSRData {
    url: RouterURL
    staticProps: Record<string, any> | null
    appStaticProps?: Record<string, any>
}

export const events = new EventEmitter()
events.setMaxListeners(1 << 10)

export async function bootstrap({
    baseUrl = '/',
    defaultLocale = 'en',
    locales = {},
    appModule = null,
    pageModules = {},
    hmr = false
}: Partial<Runtime>) {
    const { document } = window as any
    const el = document.getElementById('ssr-data')

    if (el) {
        const ssrData = JSON.parse(el.innerHTML)
        if (ssrData && 'url' in ssrData && ssrData.url.pagePath in pageModules) {
            const runtime: Runtime = {
                baseUrl,
                defaultLocale,
                locales,
                appModule,
                pageModules,
                hmr
            }
            const pageModule = pageModules[ssrData.url.pagePath]!
            const [{ default: AppComponent }, { default: PageComponent }] = await Promise.all([
                appModule ? import(baseUrl + `_dist/app.${appModule.hash.slice(0, 9)}.js`) : async () => ({}),
                import(baseUrl + '_dist/' + pageModule.path.replace(/\.js$/, `.${pageModule.hash.slice(0, 9)}.js`)),
            ])
            hydrate(React.createElement(Main, { ssrData, runtime, AppComponent, PageComponent }), document.querySelector('main'))
        }
    }
}

function Main({
    runtime,
    ssrData,
    AppComponent: initialAppComponent,
    PageComponent: initialPageComponent
}: {
    runtime: Runtime,
    ssrData: SSRData,
    AppComponent?: ComponentType<any>,
    PageComponent: ComponentType<any>
}) {
    const [baseUrl, setBaseUrl] = useState(() => runtime.baseUrl)
    const [pageModules, setPageModules] = useState(() => runtime.pageModules)
    const [app, setApp] = useState(() => ({
        Component: initialAppComponent,
        staticProps: ssrData.appStaticProps
    }))
    const [page, setPage] = useState(() => ({
        url: ssrData.url,
        Component: initialPageComponent,
        staticProps: ssrData.staticProps
    }))
    const onpopstate = React.useCallback(async () => {
        const url = route(baseUrl, Object.keys(pageModules), { fallback: '/404' })
        if (url.pagePath in pageModules) {
            const mod = pageModules[url.pagePath]!
            const importPath = util.cleanPath(baseUrl + mod.path.replace(/\.js$/, `.${mod.hash.slice(0, 9)}.js`))
            const { default: Component, staticProps } = await import(importPath)
            setPage({ url, Component, staticProps })
        } else {
            setPage({ url, Component: Default404Page, staticProps: null })
        }
    }, [baseUrl, pageModules])

    React.useEffect(() => {
        window.addEventListener('popstate', onpopstate)
        events.on('popstate', onpopstate)

        return () => {
            window.removeEventListener('popstate', onpopstate)
            events.off('popstate', onpopstate)
        }
    }, [onpopstate])

    const pageEl = React.createElement(page.Component, page.staticProps)
    return React.createElement(
        RouterContext.Provider,
        { value: page.url },
        app.Component ? React.createElement(app.Component, app.staticProps, pageEl) : pageEl
    )
}

export async function redirect(url: string, replace: boolean) {
    const { location, document, history } = window as any

    if (util.isHttpUrl(url)) {
        location.href = url
        return
    }

    url = util.cleanPath(url)
    if (location.protocol === 'file:') {
        const dataEl = document.getElementById('ssr-data')
        if (dataEl) {
            const ssrData = JSON.parse(dataEl.innerHTML)
            if (ssrData && 'url' in ssrData) {
                const { url: { pagePath: initialPagePath } } = ssrData
                location.href = location.href.replace(
                    `/${util.trimPrefix(initialPagePath, '/') || 'index'}.html`,
                    `/${util.trimPrefix(url, '/') || 'index'}.html`
                )
            }
        }
        return
    }

    if (replace) {
        history.replaceState(null, '', url)
    } else {
        history.pushState(null, '', url)
    }
    events.emit('popstate', { type: 'popstate' })
}

function Default404Page() {
    return React.createElement(
        'p',
        null,
        React.createElement(
            'strong',
            null,
            React.createElement(
                'code',
                null,
                '404'
            )
        ),
        React.createElement(
            'small',
            null,
            ' - '
        ),
        React.createElement(
            'span',
            null,
            'page not found'
        )
    )
}
