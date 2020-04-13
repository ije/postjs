import { fetchPage, isDev, Loading, PageTransition, route, RouterContext, RouterStore, transitionsToStyle, URL, utils } from '@postjs/core'
import { ComponentType, createElement, CSSProperties, Fragment, PropsWithChildren, useCallback, useEffect, useState } from 'react'
import hotEmitter from 'webpack/hot/emitter'

export function AppRouter({ baseUrl, initialUrl }: { baseUrl: string, initialUrl: URL }) {
    const [url, setUrl] = useState<{ current: URL, prev?: URL }>(() => ({ current: initialUrl }))
    const [sideEffect, setSideEffect] = useState<{ transition?: string | PageTransition }>(() => ({}))

    useEffect(() => {
        const buildManifest = window['__POST_BUILD_MANIFEST'] || {}
        const onpopstate = ({ state }) => {
            const url = route(baseUrl, Object.keys(buildManifest.pages), { fallback: '/_404' })
            setUrl(prevUrl => {
                const { current } = prevUrl
                if (url.pagePath === current.pagePath && url.pathname === current.pathname) {
                    return prevUrl
                }
                return { current: url, prev: current }
            })
            setSideEffect({ transition: state?.transition })
        }

        if (isDev()) {
            console.log(`[postjs] page ${url.current.pagePath} hydrated.`)
        }

        hotEmitter.on('popstate', onpopstate)
        window.addEventListener('popstate', onpopstate)

        return () => {
            hotEmitter.off('popstate', onpopstate)
            window.removeEventListener('popstate', onpopstate)
        }
    }, [])

    console.log('[render] AppRouter')
    return createElement(
        RouterContext.Provider,
        { value: new RouterStore(url.current) },
        createElement(
            HotAPP,
            null,
            createElement(
                Switch,
                {
                    enterPage: url.current.pagePath,
                    exitPage: url.prev?.pagePath,
                    sideEffect
                }
            )
        )
    )
}

function HotAPP({ children }: PropsWithChildren<{}>) {
    const [app, setApp] = useState<{ Component: ComponentType, staticProps: any }>(() => {
        return window['__POST_APP'] || {}
    })

    useEffect(() => {
        const hmr = Boolean(window['__POST_HMR'])
        const hotUpdate = (Component: ComponentType) => setApp(({ staticProps }) => ({ Component, staticProps }))

        if (hmr) {
            hotEmitter.on('postAppHotUpdate', hotUpdate)
        }

        return () => {
            if (hmr) {
                hotEmitter.off('postAppHotUpdate', hotUpdate)
            }
        }
    }, [])

    console.log('[render] HotAPP')
    return createElement(
        app.Component || Fragment,
        app.staticProps,
        children
    )
}

function Switch({ enterPage, exitPage, sideEffect }: { enterPage: string, exitPage: string, sideEffect: { transition?: string | PageTransition } }) {
    type TransitionProps = { className?: string, style?: CSSProperties }
    const [pages, setPages] = useState<({ pagePath: string } & TransitionProps)[]>(() => [{ pagePath: enterPage }])
    const setTransitionPages = useCallback((enterProps: TransitionProps, exitProps: TransitionProps) => {
        setPages([
            { pagePath: enterPage, ...enterProps },
            { pagePath: exitPage, ...exitProps }
        ])
    }, [enterPage, exitPage])

    useEffect(() => {
        const { transition } = sideEffect
        let timer: any = null
        if (transition && exitPage) {
            if (utils.isString(transition)) {
                setTransitionPages(
                    { className: transition + 'enter' },
                    { className: transition + 'exit' }
                )
                setTimeout(() => {
                    setTransitionPages(
                        { className: transition + 'enter-active' },
                        { className: transition + 'exit-active' }
                    )
                }, 0)
            } else {
                const [enterStyle, enterActiveStyle, enterDuration] = transitionsToStyle(transition.enter)
                const [exitStyle, exitActiveStyle, exitDuration] = transitionsToStyle(transition.exit)
                setTransitionPages(
                    { style: enterStyle },
                    { style: exitStyle }
                )
                setTimeout(() => {
                    setTransitionPages(
                        { style: enterActiveStyle },
                        { style: exitActiveStyle }
                    )
                }, 0)
                timer = setTimeout(() => {
                    timer = null
                    setPages([{ pagePath: enterPage }])
                }, Math.max(enterDuration, exitDuration))
            }
        } else {
            setPages(pages => {
                if (pages.length === 1 && pages[0].pagePath === enterPage) {
                    return pages
                }
                return [{ pagePath: enterPage }]
            })
        }

        return () => {
            if (timer !== null) {
                clearTimeout(timer)
                timer = null
                setPages([{ pagePath: enterPage }])
            }
        }
    }, [enterPage, exitPage, sideEffect])

    console.log('[render] Switch', 'enter:', enterPage, 'exit:', exitPage)

    if (pages.length === 1) {
        const pageProps = pages[0]
        return createElement(HotPage, { ...pageProps, key: pageProps.pagePath })
    }

    return createElement(Fragment, null, pages.map(pageProps => createElement(HotPage, { ...pageProps, key: pageProps.pagePath })))
}

function HotPage({ pagePath, className, style }: { pagePath: string, className?: string, style?: CSSProperties }) {
    const [hot, setHot] = useState<{ Component: ComponentType<any> | null, staticProps?: Record<string, any> | null }>(() => {
        const {
            __POST_PAGES: pages = {},
            __POST_SSR_DATA: ssrData = {}
        } = window as any
        if (pagePath in pages) {
            return {
                Component: pages[pagePath].reqComponent(),
                staticProps: ssrData[pagePath]?.staticProps
            }
        }
        return { Component: null }
    })
    const [isFetching, setIsFetching] = useState<boolean>(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const {
            __POST_HMR: hmr = false,
            __POST_PAGES: pages = {},
            __POST_SSR_DATA: ssrData = {}
        } = window as any
        const hotUpdate = (Component: ComponentType) => setHot({
            Component,
            staticProps: ssrData[pagePath]?.staticProps
        })

        if (!(pagePath in pages)) {
            setIsFetching(true)
            setHot({ Component: null })
            fetchPage(pagePath).then(() => {
                setHot({
                    Component: pages[pagePath].reqComponent(),
                    staticProps: ssrData[pagePath]?.staticProps
                })
            }).catch(error => {
                setError(error.message)
            }).finally(() => {
                setIsFetching(false)
            })
        }

        if (hmr) {
            hotEmitter.on('postPageHotUpdate:' + pagePath, hotUpdate)
        }

        return () => {
            if (hmr) {
                hotEmitter.off('postPageHotUpdate:' + pagePath, hotUpdate)
            }
        }
    }, [pagePath])

    if (isFetching) {
        return createElement(Loading)
    }

    if (error !== null) {
        return createElement(Loading, { error })
    }

    if (hot.Component !== null) {
        return createElement(
            hot.Component,
            { ...hot.staticProps, className, style }
        )
    }
    return null
}

