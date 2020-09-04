import React, { ComponentType, createContext, useCallback, useEffect, useState } from 'react'
import { hydrate } from 'react-dom'
import { EventEmitter } from './events.ts'
import { route, RouterContext, RouterURL } from './router.ts'
import util from './util.ts'

interface AppManifestProps {
    baseUrl: string
    defaultLocale: string
    locales: Record<string, Record<string, string>>
    appModule: { hash: string } | null
    pageModules: Record<string, { moduleId: string, hash: string }>
}
export const AppManifestContext = createContext<AppManifestProps>({
    baseUrl: '/',
    defaultLocale: 'en',
    locales: {},
    appModule: null,
    pageModules: {},
})
AppManifestContext.displayName = 'AppManifestContext'

export const events = new EventEmitter()
events.setMaxListeners(1 << 10)

function Main({
    manifest: initialManifest,
    url: initialUrl,
    app: initialApp,
    page: initialPage
}: {
    manifest: AppManifestProps
    url: RouterURL
    app?: { Component: ComponentType<any>, staticProps: any }
    page: { Component: ComponentType<any>, staticProps: any }
}) {
    const [manifest, setManifest] = useState(() => initialManifest)
    const [app, setApp] = useState(() => ({
        Component: initialApp?.Component,
        staticProps: initialApp?.staticProps
    }))
    const [page, setPage] = useState(() => ({
        url: initialUrl,
        Component: initialPage.Component,
        staticProps: initialPage.staticProps
    }))
    const onpopstate = useCallback(async () => {
        const { baseUrl, pageModules, defaultLocale, locales } = manifest
        const url = route(
            baseUrl,
            Object.keys(pageModules),
            {
                defaultLocale,
                locales: Object.keys(locales),
                fallback: '/404'
            }
        )
        if (url.pagePath in pageModules) {
            const mod = pageModules[url.pagePath]!
            const importPath = util.cleanPath(baseUrl + '_dist/' + mod.path.replace(/\.js$/, `.${mod.hash.slice(0, 9)}.js`))
            const { default: Component, __staticProps: staticProps } = await import(importPath)
            setPage({ url, Component, staticProps })
        } else {
            setPage({ url, Component: Default404Page, staticProps: null })
        }
    }, [manifest])

    useEffect(() => {
        window.addEventListener('popstate', onpopstate)
        events.on('popstate', onpopstate)

        return () => {
            window.removeEventListener('popstate', onpopstate)
            events.off('popstate', onpopstate)
        }
    }, [onpopstate])

    const pageEl = React.createElement(page.Component, page.staticProps)
    return React.createElement(
        AppManifestContext.Provider,
        { value: manifest },
        React.createElement(
            RouterContext.Provider,
            { value: page.url },
            app.Component ? React.createElement(app.Component, app.staticProps, pageEl) : pageEl
        )
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

export async function bootstrap(manifest: AppManifest) {
    const { document } = window as any
    const { baseUrl, appModule, pageModules } = manifest
    const el = document.getElementById('ssr-data')

    if (el) {
        const { url } = JSON.parse(el.innerHTML)
        if (url && util.isNEString(url.pagePath) && url.pagePath in pageModules) {
            const pageModule = pageModules[url.pagePath]!
            const [
                { default: AppComponent, __staticProps: appStaticProps },
                { default: PageComponent, __staticProps: staticProps }
            ] = await Promise.all([
                appModule ? import(baseUrl + `_dist/app.${appModule.hash.slice(0, 9)}.js`) : async () => ({}),
                import(baseUrl + '_dist/' + pageModule.moduleId.replace(/\.js$/, `.${pageModule.hash.slice(0, 9)}.js`)),
            ])
            const el = React.createElement(
                Main,
                {
                    url,
                    manifest,
                    app: { Component: AppComponent, staticProps: appStaticProps },
                    page: { Component: PageComponent, staticProps },
                }
            )
            hydrate(el, document.querySelector('main'))
        }
    }
}
