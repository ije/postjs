import React, { ComponentType, CSSProperties, Fragment, useEffect, useState } from 'react'
import hotEmitter from 'webpack/hot/emitter'
import { RouterContext, RouterStore, URL } from './context'
import { Page } from './page'
import { route } from './route'
import { PageTransition, transitionsToStyle } from './transition'

export * from './context'
export * from './redirect'
export * from './transition'

interface IPage {
    url: URL
    staticProps: any
    Component: ComponentType<any>
    className?: string
    style?: CSSProperties
}

export function AppRouter({ baseUrl, initialPage, initialApp = { App: Fragment, staticProps: {} } }: { baseUrl: string, initialPage: IPage, initialApp?: { App: ComponentType, staticProps: Record<string, any> } }) {
    const [app, setApp] = useState(initialApp)
    const [page, setPage] = useState(initialPage)
    const [outPage, setOutPage] = useState<IPage | null>(null)

    useEffect(() => {
        const {
            __POST_HMR: hmr,
            __POST_PAGES: pages = {},
            __POST_SSR_DATA: ssrData = {},
            __POST_BUILD_MANIFEST: buildManifest = {}
        } = window as any
        const appHotUpdate = (App: ComponentType) => setApp(({ staticProps }) => ({ App, staticProps }))
        const pageHotUpdate = (pagePath: string, component: ComponentType) => {
            setPage(page => {
                if (page.url.pagePath === pagePath) {
                    return { url: page.url, staticProps: page.staticProps, Component: component }
                }
                return page
            })
        }
        let enterTimer: any = null
        let exitTimer: any = null
        const routeUpdate = ({ state }) => {
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
                            component: (props: any) => <Page pagePath={pagePath} props={props} />
                        }
                    }
                }),
                {
                    fallback: {
                        path: '/_404',
                        component: (props: any) => <Page pagePath="/_404" props={props} />
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

        if (hmr) {
            hotEmitter.on('postAppHotUpdate', appHotUpdate)
            hotEmitter.on('postPageHotUpdate', pageHotUpdate)
        }

        hotEmitter.on('popstate', routeUpdate)
        window.addEventListener('popstate', routeUpdate)

        return () => {
            if (hmr) {
                hotEmitter.off('postAppHotUpdate', appHotUpdate)
                hotEmitter.off('postPageHotUpdate', pageHotUpdate)
            }
            hotEmitter.off('popstate', routeUpdate)
            window.removeEventListener('popstate', routeUpdate)
        }
    }, [])

    return (
        <RouterContext.Provider value={new RouterStore(page.url)}>
            <app.App {...app.staticProps}>
                {outPage && (
                    <outPage.Component
                        {...Object.assign({}, app.staticProps, outPage.staticProps)}
                        style={outPage.style}
                        className={outPage.className}
                        key={outPage.url.pagePath}
                    />
                )}
                <page.Component
                    {...Object.assign({}, app.staticProps, page.staticProps)}
                    style={page.style}
                    className={page.className}
                    key={page.url.pagePath}
                />
            </app.App>
        </RouterContext.Provider>
    )
}
