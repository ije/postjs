import React from 'react'
import { hydrate } from 'react-dom'
import { EventEmitter } from './events.ts'
import { route, RouterContext, RouterURL, withRouter } from './router.ts'
import util from './util.ts'
import ReactDomServer from './vendor/react-dom/server.js'

const runtime: {
    baseUrl: string
    pageModules: Record<string, string>
    pageComponents: Record<string, React.ComponentType<any>>,
    ssrData: Record<string, { staticProps: any }>,
    hmr: boolean
} = {
    baseUrl: '/',
    pageModules: {},
    pageComponents: {},
    ssrData: {},
    hmr: false,
}

export const events = new EventEmitter()
events.setMaxListeners(1 << 10)

export function renderPage(
    url: RouterURL,
    Page: { Component: React.ComponentType, staticProps: any },
    App?: { Component: React.ComponentType, staticProps: any }
) {
    const PageEl = React.createElement(Page.Component, Page.staticProps)
    const html = ReactDomServer.renderToString(
        React.createElement(
            RouterContext.Provider,
            { value: url },
            App ? React.createElement(App.Component, App.staticProps, PageEl) : PageEl
        )
    )
    return html
}

export async function bootstrap({
    baseUrl = '/',
    defaultLocale = 'en',
    locales = {},
    pageModules = {},
    hmr = false
}: {
    baseUrl?: string
    defaultLocale?: string
    locales: Record<string, Record<string, string>>
    pageModules?: Record<string, string>
    hmr?: boolean
}) {
    const { document } = window as any
    const el = document.getElementById('ssr-data')

    if (el) {
        const ssrData = JSON.parse(el.innerHTML)
        if (ssrData && 'url' in ssrData && ssrData.url.pagePath in pageModules) {
            const { url: initialUrl, staticProps } = ssrData
            const InitialPageModulePath = util.cleanPath(baseUrl + pageModules[initialUrl.pagePath])
            const { default: InitialPageComponent } = await import(InitialPageModulePath)

            InitialPageComponent.hasStaticProps = staticProps !== null
            Object.assign(runtime, {
                baseUrl,
                pageModules,
                pageComponents: {
                    [initialUrl.pagePath]: InitialPageComponent,
                },
                ssrData: {
                    [initialUrl.asPath]: { staticProps }
                },
                hmr
            } as typeof runtime)

            hydrate(React.createElement(
                AppRouter,
                {
                    baseUrl,
                    initialUrl,
                    pagePaths: Object.keys(pageModules)
                },
                React.createElement(withRouter(AppLoader))
            ), document.querySelector('main'))
        }
    }
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

function AppLoader({ router: { pagePath, asPath } }: { router: RouterURL }) {
    const page = React.useMemo(() => {
        const { pageComponents } = runtime
        return { Component: pageComponents[pagePath] }
    }, [pagePath])
    const staticProps = React.useMemo(() => {
        const { ssrData } = runtime
        return ssrData[asPath]?.staticProps
    }, [asPath])

    return React.createElement(page.Component, staticProps)
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
        ssrData[asPath] = { staticProps }
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
