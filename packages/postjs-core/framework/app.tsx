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
            const { __POST_PAGES: pages = {}, __POST_SSR_DATA: ssrData = {} } = window as any
            const [url, component] = route(
                baseUrl,
                Object.values(pages).map(({ path, reqComponent }) => ({ path, component: reqComponent() }))
            )
            let staticProps = null
            if (url.pagePath && url.pagePath in ssrData) {
                staticProps = (ssrData[url.pagePath] || {}).staticProps || null
            }
            setPage(page => {
                if (page.url.pagePath !== url.pagePath) {
                    return { url, staticProps, Component: component || Default404Page }
                }
                return page
            })
        }
        const hotUpdate = (pagePath: string, component: ComponentType) => {
            setPage(page => {
                if (page.url.pagePath === pagePath) {
                    return { url: page.url, staticProps: page.staticProps, Component: component }
                }
                return page
            })
        }
        window.addEventListener('popstate', routeUpdate)
        hotEmitter.on('popstate', routeUpdate)
        hotEmitter.on('postPageHotUpdate', hotUpdate)
        return () => {
            window.removeEventListener('popstate', routeUpdate)
            hotEmitter.off('popstate', routeUpdate)
            hotEmitter.off('postPageHotUpdate', hotUpdate)
        }
    }, [])

    return (
        <RouterContext.Provider value={new RouterStore(page.url)}>
            <page.Component {...(page.staticProps || {})} />
        </RouterContext.Provider>
    )
}
