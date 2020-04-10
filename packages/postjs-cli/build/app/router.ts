import { HotPage, isDev, PageTransition, RouterContext, RouterStore, transitionsToStyle, URL, utils } from '@postjs/core'
import { parse, ParsedUrlQuery } from 'querystring'
import { ComponentType, createElement, CSSProperties, Fragment, PropsWithChildren, useEffect, useRef, useState } from 'react'
import hotEmitter from 'webpack/hot/emitter'

export function AppRouter({ baseUrl, initialUrl }: { baseUrl: string, initialUrl: URL }) {
    const [url, setUrl] = useState<URL>(initialUrl)
    const [transition, setTransition] = useState<string | PageTransition | null>(null)

    useEffect(() => {
        const {
            __POST_BUILD_MANIFEST: buildManifest = {}
        } = window as any
        const onpopstate = ({ state }) => {
            const url = route(baseUrl, Object.keys(buildManifest.pages), { fallback: '/_404' })
            setUrl(url)
            setTransition(state?.transition || null)
        }

        hotEmitter.on('popstate', onpopstate)
        window.addEventListener('popstate', onpopstate)

        if (isDev()) {
            console.log("[postjs] page '" + url.pagePath + "' hydrated.")
        }

        return () => {
            hotEmitter.off('popstate', onpopstate)
            window.removeEventListener('popstate', onpopstate)
        }
    }, [])

    // console.log('AppRouter()')
    return createElement(
        RouterContext.Provider,
        { value: new RouterStore(url) },
        createElement(
            HotAPP,
            null,
            createElement(
                Switch,
                {
                    enterPage: url.pagePath,
                    transition
                }
            )
        )
    )
}

function HotAPP({ children }: PropsWithChildren<{}>) {
    const [app, setApp] = useState<{ Component: ComponentType, staticProps: any }>(() => {
        return window['__POST_APP'] || { Component: Fragment, staticProps: {} }
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

    // console.log('HotAPP()')
    return createElement(
        app.Component,
        app.staticProps,
        children
    )
}

interface SwitchProps {
    enterPage: string
    transition: string | PageTransition | null
}

function Switch({ enterPage, transition, ...rest }: SwitchProps) {
    const pageRef = useRef(enterPage)
    const [exitPage, setExitPage] = useState<string | null>(null)
    const [enterStyle, setEnterStyle] = useState<{ className?: string, style?: CSSProperties }>({})
    const [exitStyle, setExitStyle] = useState<{ className?: string, style?: CSSProperties }>({})

    useEffect(() => {
        var enterTimer: any = null
        var exitTimer: any = null
        if (transition) {
            if (pageRef.current !== enterPage) {
                setExitPage(pageRef.current)
                pageRef.current = enterPage
            }
            if (typeof transition === 'string') {
                setEnterStyle({ className: transition + '-enter' })
                setExitStyle({ className: transition + '-exit' })
                setTimeout(() => {
                    setEnterStyle({ className: transition + '-enter-active' })
                    setExitStyle({ className: transition + '-exit-active' })
                }, 0)
            } else {
                const [enterStyle, enterActiveStyle, enterDuration] = transitionsToStyle(transition.enter)
                const [exitStyle, exitActiveStyle, exitDuration] = transitionsToStyle(transition.exit)
                setEnterStyle({ style: enterStyle })
                setExitStyle({ style: exitStyle })
                setTimeout(() => {
                    setEnterStyle({ style: enterActiveStyle })
                    setExitStyle({ style: exitActiveStyle })
                }, 0)
                enterTimer = setTimeout(() => {
                    enterTimer = null
                    setEnterStyle({})
                }, enterDuration)
                exitTimer = setTimeout(() => {
                    exitTimer = null
                    setExitPage(null)
                    setExitStyle({})
                }, exitDuration)
            }
        }

        return () => {
            [enterTimer, exitTimer].filter(Boolean).forEach(clearTimeout)
            setEnterStyle({})
            setExitPage(null)
            setExitStyle({})
        }
    }, [enterPage, transition])

    return (
        createElement(
            Fragment,
            null,
            createElement(
                HotPage,
                { ...rest, ...enterStyle, pagePath: enterPage, forceReload: true, key: enterPage }
            ),
            transition && exitPage && exitPage !== enterPage && createElement(
                HotPage,
                { ...rest, ...exitStyle, pagePath: exitPage, forceReload: true, key: exitPage }
            )
        )
    )
}

export function route(base: string, routes: string[], options?: { location?: { pathname: string, search?: string }, fallback?: string }): URL {
    const loc = (options?.location || location)
    const fallback = options?.fallback

    let pagePath = ''
    let asPath = loc.pathname
    let params: Record<string, string> = {}
    let query: ParsedUrlQuery = parse((loc.search || '').replace(/^\?/, ''))

    if (base.length > 1 && base.startsWith('/')) {
        asPath = utils.trimPrefix(asPath, base)
        if (!asPath.startsWith('/')) {
            asPath = '/' + asPath
        }
    }

    // todo: routes.sort()
    utils.each(routes, routePath => {
        const [_params, ok] = matchPath(routePath, asPath)
        if (ok) {
            pagePath = routePath
            params = _params
            return false
        }
        return undefined
    })

    if (pagePath === '' && fallback !== undefined) {
        pagePath = fallback
    }

    return { pagePath, asPath, params, query }
}

export function matchPath(routePath: string, locPath: string): [Record<string, string>, boolean] {
    const routeSegments = utils.cleanPath(routePath).replace(/^\//, '').split('/')
    const locSegments = utils.cleanPath(locPath).replace(/^\//, '').split('/')
    const isRoot = locSegments[0] === ''
    const max = Math.max(routeSegments.length, locSegments.length)
    const params: Record<string, string> = {}

    let ok = true

    for (let i = 0; i < max; i++) {
        const routeSeg = routeSegments[i]
        const locSeg = locSegments[i]

        if (locSeg === undefined || routeSeg === undefined) {
            ok = false
            break
        }

        if (routeSeg === '*') {
            params['*'] = locSegments.slice(i).map(decodeURIComponent).join('/')
            break
        }

        if (!isRoot && routeSeg.startsWith('$')) {
            params[routeSeg.slice(1)] = decodeURIComponent(locSeg)
        } else if (routeSeg !== locSeg) {
            ok = false
            break
        }
    }

    return [params, ok]
}
