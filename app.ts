import React from 'https://cdn.pika.dev/react'
import { hydrate } from 'https://cdn.pika.dev/react-dom'
import { EventEmitter } from './events.ts'
import { route, RouterContext, RouterURL, withRouter } from './router.ts'
import util from './util.ts'

interface Runtime {
    baseUrl: string
    pagePaths: Record<string, string>
    pageComponents: Record<string, React.ComponentType>,
    ssrData: Record<string, { staticProps: any }>,
    hmr: boolean
}
const runtime: Runtime = {
    baseUrl: '/',
    pagePaths: {},
    pageComponents: {},
    ssrData: {},
    hmr: false,
}

interface AppContextProps {
    readonly locale: string
}
export const AppContext = React.createContext<AppContextProps>({
    locale: 'en'
})
AppContext.displayName = 'AppContext'

export const events = new EventEmitter()
events.setMaxListeners(1 << 10)

export async function bootstrap({
    baseUrl = '/',
    pagePaths = {},
    hmr = false
}: {
    baseUrl?: string
    pagePaths?: Record<string, string>
    hmr?: boolean
}) {
    const { document } = window as any
    const el = document.getElementById('ssr-data')

    if (el) {
        const ssrData = JSON.parse(el.innerHTML)
        if (ssrData && 'url' in ssrData && ssrData.url.pagePath in pagePaths) {
            const { url: initialUrl, staticProps } = ssrData
            const InitialPageModulePath = util.cleanPath(baseUrl + pagePaths[initialUrl.pagePath])
            const { default: InitialPageComponent } = await import(InitialPageModulePath)

            InitialPageComponent.hasStaticProps = staticProps !== null
            Object.assign(runtime, {
                baseUrl,
                pagePaths,
                pageComponents: {
                    [initialUrl.pagePath]: InitialPageComponent,
                },
                ssrData: {
                    [initialUrl.asPath]: { staticProps }
                },
                hmr
            } as Runtime)

            hydrate((
                React.createElement(
                    AppContext.Provider,
                    {
                        value: {
                            locale: 'en'
                        }
                    },
                    React.createElement(
                        AppRouter,
                        {
                            baseUrl,
                            initialUrl,
                            pagePaths: Object.keys(pagePaths)
                        },
                        React.createElement(withRouter(AppLoader))
                    )
                )
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
    const Component = React.useMemo(() => {
        const { pageComponents } = runtime
        return pageComponents[pagePath]
    }, [pagePath])
    const staticProps = React.useMemo(() => {
        const { ssrData } = runtime
        return ssrData[asPath]?.staticProps
    }, [asPath])

    return React.createElement(Component, staticProps)
}

async function importPageComponent(pagePath: string) {
    const { baseUrl, pagePaths, pageComponents } = runtime
    if (!(pagePath in pagePaths)) {
        throw new Error(`invalid pagePath '${pagePath}'`)
    }

    const importPath = util.cleanPath(baseUrl + pagePaths[pagePath])
    const { default: Component, getStaticProps } = await import(importPath)
    const gsp = [Component.getStaticProps, getStaticProps].filter(util.isFunction)
    Component.hasStaticProps = gsp.length > 0
    pageComponents[pagePath] = Component
    return Component
}

export async function prefetchPage(url: string) {
    const { baseUrl, pagePaths, pageComponents, ssrData } = runtime

    if (!url.startsWith('/')) {
        return false
    }

    const [pathname] = url.split('?', 1)
    const { pagePath, asPath } = route(baseUrl, Object.keys(pagePaths), { location: { pathname } })
    if (pagePath === '') {
        return false
    }

    let hasStaticProps = false
    if (pagePath in pagePaths) {
        let Component: any
        if (!(pagePath in pageComponents)) {
            Component = await importPageComponent(pagePath)
        } else {
            Component = pageComponents[pagePath]
        }
        hasStaticProps = !!Component.hasStaticProps
    }

    if (hasStaticProps && !(asPath in ssrData)) {
        const staticProps = await fetch(asPath + '/ssr-data.json').then(resp => resp.json())
        ssrData[asPath] = { staticProps }
    }

    return true
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
                    '/' + (util.trimPrefix(initialPagePath, '/') || 'index') + '.html',
                    '/' + (util.trimPrefix(url, '/') || 'index') + '.html'
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
