import React, { ComponentType, CSSProperties, useEffect, useState } from 'react'
import hotEmitter from 'webpack/hot/emitter'
import { LazyPageComponent } from '../component'
import { RouterContext, RouterStore, URL } from './context'
import { route } from './route'
import { PageTransition, transitionsToStyle } from './transition'

export * from './context'
export * from './fetch'
export * from './redirect'
export * from './route'
export * from './transition'

type Page = { url: URL, staticProps: any, style?: CSSProperties, className?: string, Component: ComponentType<any> }

export function AppRouter({ baseUrl, initialPage }: { baseUrl: string, initialPage: Page }) {
    const [page, setPage] = useState(initialPage)
    const [outPage, setOutPage] = useState<Page | null>(null)

    useEffect(() => {
        let enterTimer: any = null
        let exitTimer: any = null
        const routeUpdate = ({ state }) => {
            const {
                __POST_PAGES: pages = {},
                __POST_SSR_DATA: ssrData = {},
                __POST_BUILD_MANIFEST: buildManifest = {}
            } = window as any
            const transition: string | PageTransition | undefined = state?.transition
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
                        component: (props: any) => <LazyPageComponent {...props} pagePath="/_404" />
                    }
                }
            )

            if (enterTimer !== null) {
                clearTimeout(enterTimer)
                enterTimer = null
                setPage(({ style, ...page }) => page)
            }
            if (exitTimer !== null) {
                clearTimeout(exitTimer)
                exitTimer = null
                setOutPage(null)
            }

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

            if (typeof transition === 'string') {
                setPage(page => ({ ...page, className: transition + '-enter' }))
                setOutPage(page => page ? ({ ...page, className: transition + '-exit' }) : null)
                setTimeout(() => {
                    setPage(page => ({ ...page, className: transition + '-enter-active' }))
                    setOutPage(page => page ? ({ ...page, className: transition + '-exit-active' }) : null)
                }, 0)
            } else if (transition !== undefined) {
                const [enterStye, enterActiveStyle, enterDuration] = transitionsToStyle(transition.enter)
                const [exitStye, exitActiveStyle, exitDuration] = transitionsToStyle(transition.exit)
                setPage(page => ({ ...page, style: enterStye }))
                setOutPage(page => page ? ({ ...page, style: exitStye }) : null)
                setTimeout(() => {
                    setPage(page => ({ ...page, style: enterActiveStyle }))
                    setOutPage(page => page ? ({ ...page, style: exitActiveStyle }) : null)
                }, 0)
                enterTimer = setTimeout(() => {
                    enterTimer = null
                    setPage(({ style, ...page }) => page)
                }, enterDuration)
                exitTimer = setTimeout(() => {
                    exitTimer = null
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
                <outPage.Component
                    {...outPage.staticProps}
                    style={outPage.style}
                    className={outPage.className}
                    key={outPage.url.pagePath}
                />
            )}
            <page.Component
                {...page.staticProps}
                style={page.style}
                className={page.className}
                key={page.url.pagePath}
            />
        </RouterContext.Provider>
    )
}
