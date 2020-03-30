import React, { ComponentType, useEffect, useState } from 'react'
import hotEmitter from 'webpack/hot/emitter'
import { Default404Page } from './404'
import { route, RouterContext, RouterStore, URL } from './router'

interface AppProps {
    baseUrl: string
    initialPage: {
        url: URL,
        staticProps: any,
        Component: ComponentType<any>
    }
}

export function App({ baseUrl, initialPage }: AppProps) {
    const [page, setPage] = useState(initialPage)

    useEffect(() => {
        const routeUpdate = () => {
            const { __POST_PAGES = {}, __POST_SSR_DATA = {} } = window as any
            const [url, component] = route(
                baseUrl,
                Object.values(__POST_PAGES).map(({ path, reqComponent }) => ({ path, component: reqComponent() }))
            )
            let staticProps = null
            if (url.pagePath && url.pagePath in __POST_SSR_DATA) {
                staticProps = (__POST_SSR_DATA[url.pagePath] || {}).staticProps || null
            }
            setPage({ url, staticProps, Component: component || Default404Page })
        }
        const hotUpdate = (pagePath: string, component: ComponentType) => {
            setPage(page => {
                if (page.url.pagePath === pagePath) {
                    return { url: page.url, staticProps: page.staticProps, Component: component }
                }
                return page
            })
        }
        window.addEventListener('popstate', routeUpdate, false)
        hotEmitter.on('postPageHotUpdate', hotUpdate)
        return () => {
            window.removeEventListener('popstate', routeUpdate, false)
            hotEmitter.off('postPageHotUpdate', hotUpdate)
        }
    }, [])

    return (
        <RouterContext.Provider value={new RouterStore(page.url)}>
            <page.Component {...(page.staticProps || {})} />
        </RouterContext.Provider>
    )
}
