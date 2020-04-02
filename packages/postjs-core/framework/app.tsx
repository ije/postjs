import React, { ComponentType, CSSProperties, useEffect, useState } from 'react'
import hotEmitter from 'webpack/hot/emitter'
import { Default404Page } from './404'
import { LazyPageComponent } from './component'
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
    const [pageStyle, setPageStyle] = useState<CSSProperties>({})
    const [outPage, setOutPage] = useState<null | typeof initialPage>(null)
    const [outPageStyle, setOutPageStyle] = useState<CSSProperties>({})

    useEffect(() => {
        const {
            __POST_PAGES: pages = {},
            __POST_SSR_DATA: ssrData = {},
            __POST_BUILD_MANIFEST: buildManifest = {}
        } = window as any
        let enterTimer: any = null
        let exitTimer: any = null
        const routeUpdate = (e: PopStateEvent) => {
            const { transition } = e.state || {}
            const [url, component] = route(
                baseUrl,
                Object.keys(buildManifest.pages).map(pagePath => {
                    if (pagePath in pages) {
                        return {
                            path: pagePath,
                            component: pages[pagePath].reqComponent()
                        }
                    } else {
                        return {
                            path: pagePath,
                            component: (props: any) => <LazyPageComponent {...props} pagePath={pagePath} />
                        }
                    }
                }),
                { fallback: { path: '/_404', component: Default404Page } }
            )

            let staticProps = null
            if (url.pagePath && url.pagePath in ssrData) {
                staticProps = (ssrData[url.pagePath] || {}).staticProps || null
            }

            setPage(page => {
                if (page.url.pagePath !== url.pagePath) {
                    if (transition) {
                        setOutPage(page)
                    }
                    return { url, staticProps, Component: component! }
                }
                return page
            })

            if (enterTimer !== null) {
                clearTimeout(enterTimer)
                enterTimer = null
                setPageStyle({})
            }
            if (exitTimer !== null) {
                clearTimeout(exitTimer)
                exitTimer = null
                setOutPageStyle({})
                setOutPage(null)
            }

            if (transition) {
                const enterDuration = transition.duration.enter || transition.duration
                const exitDuration = transition.duration.exit || transition.duration
                setPageStyle({
                    ...transition.enterStyle,
                    transition: `all ${Math.round(enterDuration)}ms ${transition.timing?.enter || transition.timing || ''}`
                })
                setOutPageStyle({
                    ...transition.exitStyle,
                    transition: `all ${Math.round(exitDuration)}ms ${transition.timing?.exit || transition.timing || ''}`
                })
                setTimeout(() => {
                    setPageStyle(style => ({
                        ...transition.enterActiveStyle,
                        transition: style.transition
                    }))
                }, 0)
                setTimeout(() => {
                    setOutPageStyle(style => ({
                        ...transition.exitActiveStyle,
                        transition: style.transition
                    }))
                }, 0)
                enterTimer = setTimeout(() => {
                    enterTimer = null
                    setPageStyle({})
                }, enterDuration)
                exitTimer = setTimeout(() => {
                    setOutPageStyle({})
                    setOutPage(null)
                }, exitDuration)
            }
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
            {outPage && (
                <outPage.Component {...outPage.staticProps} style={outPageStyle} key={outPage.url.pagePath} />
            )}
            <page.Component {...page.staticProps} style={pageStyle} key={page.url.pagePath} />
        </RouterContext.Provider>
    )
}
