import React, { ComponentType, CSSProperties, useEffect, useState } from 'react'
import hotEmitter from 'webpack/hot/emitter'
import { LazyPageComponent } from '../component'
import { RouterContext, RouterStore, URL } from './context'
import { route } from './route'
import { Transition } from './transition'

export * from './context'
export * from './fetch'
export * from './redirect'
export * from './route'
export * from './transition'

type Page = { url: URL, staticProps: any, Component: ComponentType<any> }

export function AppRouter(props: { baseUrl: string, initialPage: Page }) {
    const { baseUrl, initialPage } = props
    const [page, setPage] = useState(initialPage)
    const [pageStyle, setPageStyle] = useState<CSSProperties>({})
    const [outPage, setOutPage] = useState<Page | null>(null)
    const [outPageStyle, setOutPageStyle] = useState<CSSProperties>({})

    useEffect(() => {
        let enterTimer: any = null
        let exitTimer: any = null
        const routeUpdate = ({ state }) => {
            const {
                __POST_PAGES: pages = {},
                __POST_SSR_DATA: ssrData = {},
                __POST_BUILD_MANIFEST: buildManifest = {}
            } = window as any
            const transition: Transition | undefined = state?.transition
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
                {
                    fallback: {
                        path: '/_404',
                        component: (props: any) => <LazyPageComponent {...props} pagePath={'/_404'} />
                    }
                }
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
                setPageStyle({
                    ...transition.enterStyle,
                    transition: `all ${transition.enterDuration}ms ${transition.enterTiming}`
                })
                setOutPageStyle({
                    ...transition.exitStyle,
                    transition: `all ${transition.exitDuration}ms ${transition.exitTiming}`
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
                }, transition.enterDuration)
                exitTimer = setTimeout(() => {
                    setOutPageStyle({})
                    setOutPage(null)
                }, transition.exitDuration)
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
