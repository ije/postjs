import React from 'react'
import { hydrate } from 'react-dom'
import { EventEmitter } from './events.ts'
import { route, RouterContext, RouterURL, withRouter } from './router.ts'
import util from './util.ts'
import ReactDomServer from './vendor/react-dom/server.js'

interface Runtime {
    baseUrl: string
    AppComponent?: React.ComponentType<any>
    pageModules: Record<string, string>
    pageComponents: Record<string, React.ComponentType<any>>
    ssrData: {
        app: { staticProps: any }
        pages: Record<string, { staticProps: any }>
    }
    hmr: boolean
}
const runtime: Runtime = {
    baseUrl: '/',
    pageModules: {},
    pageComponents: {},
    ssrData: { app: { staticProps: null }, pages: {} },
    hmr: false,
}

export const events = new EventEmitter()
events.setMaxListeners(1 << 10)

export async function bootstrap({
    baseUrl = '/',
    defaultLocale = 'en',
    appModule,
    pageModules = {},
    hmr = false
}: {
    baseUrl?: string
    defaultLocale?: string
    appModule?: { hash: string }
    pageModules?: Record<string, string>
    hmr?: boolean
}) {
    const { document } = window as any
    const el = document.getElementById('ssr-data')

    if (el) {
        const ssrData = JSON.parse(el.innerHTML)
        if (ssrData && 'url' in ssrData && ssrData.url.pagePath in pageModules) {
            const { url: initialUrl, staticProps, appStaticProps } = ssrData
            const InitialPageModulePath = util.cleanPath(baseUrl + pageModules[initialUrl.pagePath])
            const [{ default: AppComponent }, { default: InitialPageComponent }] = await Promise.all([
                appModule ? import(util.cleanPath(baseUrl + `./app.${appModule.hash}.js`)) : async () => ({}),
                import(InitialPageModulePath),
            ])

            InitialPageComponent.hasStaticProps = staticProps !== null
            Object.assign(runtime, {
                baseUrl,
                pageModules,
                AppComponent,
                pageComponents: {
                    [initialUrl.pagePath]: InitialPageComponent,
                },
                ssrData: {
                    app: { staticProps: util.isObject(appStaticProps) ? appStaticProps : null },
                    pages: { [initialUrl.asPath]: { staticProps } }
                },
                hmr
            } as Partial<Runtime>)

            hydrate(React.createElement(App, { initialUrl }), document.querySelector('main'))
        }
    }
}

function App({ initialUrl }: { initialUrl: RouterURL }) {
    const AppComponent = React.useMemo(() => {
        const { AppComponent } = runtime
        return AppComponent
    }, [])
    const appStaticProps = React.useMemo(() => {
        const { ssrData } = runtime
        return ssrData.app.staticProps
    }, [])
    const pagePaths = React.useMemo(() => {
        const { pageModules } = runtime
        return Object.keys(pageModules)
    }, [])

    const pageEl = React.createElement(withRouter(PageLoader))
    return React.createElement(
        AppRouter,
        {
            baseUrl: runtime.baseUrl,
            initialUrl,
            pagePaths
        },
        AppComponent ? React.createElement(AppComponent, appStaticProps, pageEl) : pageEl
    )
}

function AppRouter({
    baseUrl,
    pagePaths,
    initialUrl,
    children
}: React.PropsWithChildren<{
    baseUrl: string
    pagePaths: string[]
    initialUrl: RouterURL
}>) {
    const [state, setState] = React.useState<RouterURL>(() => initialUrl)
    const onPopstate = React.useCallback(() => {
        const next = route(baseUrl, pagePaths, { fallback: '/404' })
        setState(next)
    }, [baseUrl, pagePaths])

    React.useEffect(() => {
        window.addEventListener('popstate', onPopstate)
        events.on('popstate', onPopstate)

        return () => {
            window.removeEventListener('popstate', onPopstate)
            events.off('popstate', onPopstate)
        }
    }, [])

    return React.createElement(
        RouterContext.Provider,
        { value: state },
        children
    )
}

function PageLoader({ router: { pagePath, asPath } }: { router: RouterURL }) {
    const page = React.useMemo(() => {
        const { pageComponents } = runtime
        return { Component: pageComponents[pagePath] }
    }, [pagePath])
    const staticProps = React.useMemo(() => {
        const { ssrData } = runtime
        return ssrData.pages[asPath]?.staticProps
    }, [asPath])

    return React.createElement(page.Component, staticProps)
}

export function renderPage(
    url: RouterURL,
    App: { Component: React.ComponentType, staticProps: any } | undefined,
    Page: { Component: React.ComponentType, staticProps: any },
) {
    const El = React.createElement(
        RouterContext.Provider,
        { value: url },
        React.createElement(
            Page.Component,
            Page.staticProps
        )
    )
    const html = ReactDomServer.renderToString(App ? React.createElement(App.Component, App.staticProps, El) : El)
    return html
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

    const ok = await prefetchPage(url)
    if (!ok) {
        return
    }

    if (replace) {
        history.replaceState(null, '', url)
    } else {
        history.pushState(null, '', url)
    }
    events.emit('popstate', { type: 'popstate' })
}

export async function prefetchPage(url: string) {
    const { baseUrl, pageModules, pageComponents, ssrData } = runtime

    if (!url.startsWith('/')) {
        return false
    }

    const [pathname] = url.split('?', 1)
    const { pagePath, asPath } = route(baseUrl, Object.keys(pageModules), { location: { pathname } })
    if (pagePath === '') {
        return false
    }

    let hasStaticProps = false
    if (pagePath in pageModules) {
        let Component: any
        if (!(pagePath in pageComponents)) {
            Component = await importPageComponent(pagePath)
        } else {
            Component = pageComponents[pagePath]
        }
        hasStaticProps = !!Component.hasStaticProps
    }

    if (hasStaticProps && !(asPath in ssrData)) {
        const dataUrl = '/data/' + (util.trimPrefix(asPath, '/') || 'index') + '.json'
        const staticProps = await fetch(dataUrl).then(resp => resp.json())
        ssrData.pages[asPath] = { staticProps }
    }

    return true
}

async function importPageComponent(pagePath: string) {
    const { baseUrl, pageModules, pageComponents } = runtime
    if (!(pagePath in pageModules)) {
        throw new Error(`invalid pagePath '${pagePath}'`)
    }

    const importPath = util.cleanPath(baseUrl + pageModules[pagePath])
    const { default: Component, getStaticProps } = await import(importPath)
    const gsp = [Component.getStaticProps, getStaticProps].filter(util.isFunction)
    Component.hasStaticProps = gsp.length > 0
    pageComponents[pagePath] = Component
    return Component
}
