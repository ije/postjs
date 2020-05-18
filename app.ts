import React, { useContext } from 'https://cdn.pika.dev/react'
import { hydrate } from 'https://cdn.pika.dev/react-dom'
import { EventEmitter } from './events.ts'
import { route, RouterContext, RouterState } from './mod.ts'
import { URI } from './router.ts'
import util from './util.ts'

export const events = new EventEmitter()
events.setMaxListeners(1 << 10)

export interface AppContextProps {
    readonly locale: string
}

export const AppContext = React.createContext<AppContextProps>({
    locale: 'en'
})
AppContext.displayName = 'AppContext'

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
        if (ssrData && 'uri' in ssrData) {
            const { uri: initialUri, staticProps } = ssrData
            const initialPageModule = util.cleanPath(baseUrl + pagePaths[initialUri.pagePath])
            const { default: InitialPageComponent } = await import(initialPageModule)

            Object.assign(window, {
                __POSTJS_BASEURL: baseUrl,
                __POSTJS_PAGEPATHS: pagePaths,
                __POSTJS_HMR: hmr,
                __POSTJS_COMPONENTS: {
                    [initialPageModule]: InitialPageComponent,
                },
                __POSTJS_SSR_DATA: {
                    [initialUri.asPath]: { staticProps }
                },
            })

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
                        { baseUrl, initialUri, pagePaths: Object.keys(pagePaths) },
                        React.createElement(AppLoader)
                    )
                )
            ), document.querySelector('main'))
        }
    }
}

interface AppRouterProps {
    baseUrl: string
    pagePaths: string[]
    initialUri: URI
}

function AppRouter({ baseUrl, pagePaths, initialUri, children }: React.PropsWithChildren<AppRouterProps>) {
    const [state, setState] = React.useState<RouterState>(() => new RouterState(initialUri))
    const onPopstate = React.useCallback(({ sideEffect }) => {
        const next = route(baseUrl, pagePaths, { fallback: '/404' })
        setState(prev => {
            const { current: prevUri } = prev
            if (next.pagePath === prevUri.pagePath && next.asPath === prevUri.asPath) {
                return prev
            }
            return new RouterState(next, prevUri, sideEffect)
        })
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

function AppLoader() {
    const { __POSTJS_PAGEPATHS: pagePaths = {}, __POSTJS_BASEURL = '/' } = window as any
    const { pagePath } = useContext(RouterContext)

    return React.createElement(
        HotComponent,
        { path: util.cleanPath(__POSTJS_BASEURL + pagePaths[pagePath]) }
    )
}

function HotComponent({ path, props, children }: React.PropsWithChildren<{ path: string, props?: Record<string, any> }>) {
    const [mod, setMod] = React.useState<{ Component: React.ComponentType | null }>(() => {
        let { __POSTJS_COMPONENTS = {} } = window as any
        return { Component: __POSTJS_COMPONENTS[path] || null }
    })

    React.useEffect(() => {
        const { __POSTJS_HMR: hmr = false, __POSTJS_COMPONENTS } = window as any
        const update = () => {
            import(path).then(({ default: Component }) => {
                setMod({ Component })
                if (__POSTJS_COMPONENTS) {
                    __POSTJS_COMPONENTS[path] = Component
                }
            })
        }

        if (mod.Component == null) {
            update()
        }

        if (hmr) {
            events.on(`hmr/${path}`, update)
        }

        return () => {
            if (hmr) {
                events.off(`hmr/${path}`, update)
            }
        }
    }, [path])

    return mod.Component ? React.createElement(
        mod.Component,
        props,
        children
    ) : null
}
