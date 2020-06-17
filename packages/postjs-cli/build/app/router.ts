import { fetchPage, Loading, PageTransition, route, RouterContext, RouterStore, transitionsToStyle, URL, utils } from '@postjs/core'
import { ComponentType, createElement, CSSProperties, Fragment, PropsWithChildren, useCallback, useEffect, useState } from 'react'
import hotEmitter from 'webpack/hot/emitter'

export function AppRouter({ baseUrl, initialUrl }: { baseUrl: string, initialUrl: URL }) {
    const [url, setUrl] = useState<{ current: URL, prev?: URL }>(() => ({ current: initialUrl }))
    const [sideEffect, setSideEffect] = useState<{ transition?: string | PageTransition }>(() => ({}))

    useEffect(() => {
        const buildManifest = window['__POST_BUILD_MANIFEST'] || {}
        const onpopstate = e => {
            const url = route(baseUrl, Object.keys(buildManifest.pages), { fallback: '/_404' })
            setUrl(prevUrl => {
                const { current } = prevUrl
                if (url.pagePath === current.pagePath && url.asPath === current.asPath) {
                    return prevUrl
                }
                return { current: url, prev: current }
            })
            setSideEffect({ transition: e.state?.transition })
            if (e.resetScroll) {
                window.scrollTo({ top: 0, left: 0 })
            }
        }

        if (process.env.NODE_ENV === 'development') {
            console.log(`[postjs] page ${url.current.pagePath} hydrated.`)
        }

        hotEmitter.on('popstate', onpopstate)
        window.addEventListener('popstate', onpopstate)

        return () => {
            hotEmitter.off('popstate', onpopstate)
            window.removeEventListener('popstate', onpopstate)
        }
    }, [])

    // console.log('[render] AppRouter')

    return createElement(
        RouterContext.Provider,
        { value: new RouterStore(url.current) },
        createElement(
            HotAPP,
            null,
            createElement(
                Switch,
                {
                    enterPage: url.current,
                    exitPage: url.prev,
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
        const hotUpdate = (Component: ComponentType) => {
            setApp(({ staticProps }) => ({ Component, staticProps }))
        }

        if (hmr) {
            hotEmitter.on('postAppHotUpdate', hotUpdate)
        }

        return () => {
            if (hmr) {
                hotEmitter.off('postAppHotUpdate', hotUpdate)
            }
        }
    }, [])

    // console.log('[render] HotAPP')

    return createElement(
        app.Component || Fragment,
        app.staticProps,
        children
    )
}

interface TransitionProps { className?: string, style?: CSSProperties }
function Switch({ enterPage, exitPage, sideEffect }: { enterPage: URL, exitPage?: URL, sideEffect: { transition?: string | PageTransition } }) {
    const [pages, setPages] = useState<(URL & TransitionProps)[]>(() => {
        return [{ ...enterPage }]
    })
    const setTransitionPages = useCallback((enterProps: TransitionProps, exitProps: TransitionProps) => {
        setPages([
            { ...enterPage, ...enterProps },
            { ...exitPage!, ...exitProps }
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
                    setPages([{ ...enterPage }])
                }, Math.max(enterDuration, exitDuration))
            }
        } else {
            setPages(pages => {
                if (pages.length === 1 && pages[0].pagePath === enterPage.pagePath && pages[0].asPath === enterPage.asPath) {
                    return pages
                }
                return [{ ...enterPage }]
            })
        }

        return () => {
            if (timer !== null) {
                clearTimeout(timer)
                timer = null
                setPages([{ ...enterPage }])
            }
        }
    }, [enterPage, exitPage, sideEffect])

    // console.log('[render] Switch', 'enter:', enterPage.asPath, 'exit:', exitPage?.asPath)

    if (pages.length === 1) {
        const pageProps = pages[0]
        return createElement(HotPage, { ...pageProps, key: pageProps.pagePath })
    }
    return createElement(Fragment, null, pages.map(pageProps => createElement(HotPage, { ...pageProps, key: pageProps.pagePath })))
}

function HotPage({ pagePath, asPath, className, style }: URL & TransitionProps) {
    const [hot, setHot] = useState<{ Component: ComponentType<any> | null, staticProps?: Record<string, any> | null }>(() => {
        const {
            __POST_PAGES: pages = {},
            __POST_SSR_DATA: ssrData = {}
        } = window as any
        if (pagePath in pages) {
            return {
                Component: pages[pagePath].Component,
                staticProps: ssrData[asPath]?.staticProps
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
            __POST_SSR_DATA: ssrData = {},
            __POST_BUILD_MANIFEST: buildManifest = {}
        } = window as any
        const hotUpdate = (Component: ComponentType) => {
            setHot({
                Component,
                staticProps: ssrData[asPath]?.staticProps
            })
        }

        if (!(pagePath in pages)) {
            if (pagePath in (buildManifest.pages || {})) {
                setIsFetching(true)
                fetchPage(pagePath, asPath).then(() => {
                    setHot({
                        Component: pages[pagePath].Component,
                        staticProps: ssrData[asPath]?.staticProps
                    })
                }).catch(error => {
                    setError(error.message)
                }).finally(() => {
                    setIsFetching(false)
                })
            } else {
                setError('page not found')
            }
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

    // console.log('[render] HotPage', pagePath)

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

