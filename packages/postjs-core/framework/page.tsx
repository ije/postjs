import React, { Children, ComponentType, CSSProperties, Fragment, isValidElement, PropsWithChildren, useEffect, useState } from 'react'
import hotEmitter from 'webpack/hot/emitter'
import { Loading } from './component'
import { Head } from './head'
import { isServer, utils } from './utils'

interface LazyPageProps {
    pagePath: string
    className?: string
    style?: CSSProperties
    fallback?: JSX.Element
}

export function LazyPage({ pagePath, fallback, children, ...rest }: PropsWithChildren<LazyPageProps>): JSX.Element | null {
    const [isFetching, setIsFetching] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const {
            __POST_PAGES: pages = {},
            __POST_BUILD_MANIFEST: buildManifest = {}
        } = window as any
        const buildInfo = (buildManifest.pages || {})[pagePath]
        if (buildInfo !== undefined) {
            if (pagePath in pages) {
                setIsFetching(false)
            } else {
                fetchPage(pagePath).then(() => {
                    if (!(pagePath in (window['__POST_PAGES'] || {}))) {
                        setError('bad page')
                    }
                }).catch(err => {
                    setError(err.message || String(err))
                }).finally(() => {
                    setIsFetching(false)
                })
            }
        } else {
            setIsFetching(false)
            setError('E404')
        }
    }, [pagePath])

    if (isFetching) {
        if (Children.count(children) > 0) {
            return <Fragment>{children}</Fragment>
        }
        return (
            <Loading />
        )
    }

    if (error) {
        if (error === 'E404') {
            if (isValidElement(fallback)) {
                return fallback
            }
            return (
                <p style={{ margin: 50 }}>
                    <Head><title>404 - Page not found</title></Head>
                    <strong><code>404</code></strong>
                    <small>&nbsp;-&nbsp;</small>
                    <span>Page not found</span>
                </p>
            )
        }
        return (
            <Loading error={error} />
        )
    }

    return (
        <HotPage {...rest} pagePath={pagePath} />
    )
}

export function HotPage({ pagePath, forceReload, ...rest }: { pagePath: string, forceReload?: boolean, className?: string, style?: CSSProperties }) {
    const [page, setPage] = useState<{ Component: ComponentType | null, staticProps: any }>(() => {
        const {
            __POST_PAGES: pages = {},
            __POST_SSR_DATA: ssrData = {}
        } = window as any
        if (pagePath in pages) {
            return { Component: pages[pagePath].reqComponent(), staticProps: ssrData[pagePath]?.staticProps }
        }
        return { Component: null, staticProps: null }
    })

    useEffect(() => {
        const hmr = Boolean(window['__POST_HMR'])
        const hotUpdate = (Component: ComponentType) => setPage(({ staticProps }) => {
            return { Component, staticProps }
        })

        if (hmr) {
            hotEmitter.on('postPageHotUpdate:' + pagePath, hotUpdate)
        }

        return () => {
            if (hmr) {
                hotEmitter.off('postPageHotUpdate:' + pagePath, hotUpdate)
            }
        }
    }, [pagePath])

    if (page.Component === null) {
        if (forceReload) {
            //  location.reload()
            return null
        }
        return (
            <Loading error={`page '${pagePath}' not found`} />
        )
    }

    return (
        <page.Component {...page.staticProps} {...rest} />
    )
}

export async function fetchPage(pagePath: string) {
    // only in browser and not a file
    if (isServer() || location.protocol === 'file:') {
        return
    }

    const {
        __POST_PAGES: pages,
        __POST_BUILD_MANIFEST: buildManifest
    } = window as any

    if (buildManifest === undefined) {
        return Promise.reject(new Error('the build-manifest not ready'))
    }

    const buildInfo = buildManifest.pages[pagePath]
    if (buildInfo === undefined) {
        if (pagePath in pages) {
            delete pages[pagePath]
        }
        return
    }

    const page = pages[pagePath]
    if (utils.isObject(page) && (page.fetching === true || page.path === pagePath)) {
        return
    }

    pages[pagePath] = { fetching: true }
    return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        const loadScriptBaseUrl = window['__post_loadScriptBaseUrl'] || ''
        script.src = `${loadScriptBaseUrl}_post/pages/${buildInfo.name}.js?v=${buildInfo.hash}`
        script.async = false
        script.onload = () => {
            const page = pages[pagePath]
            if (page.path === pagePath && utils.isFunction(page.reqComponent)) {
                const pc = page.reqComponent()
                if (pc.hasGetStaticPropsMethod === true) {
                    fetch(`${loadScriptBaseUrl}_post/pages/${buildInfo.name}.json?v=${buildInfo.hash}`).then(resp => resp.json()).then(data => {
                        (window['__POST_SSR_DATA'] = window['__POST_SSR_DATA'] || {})[pagePath] = data
                        resolve()
                    }).catch(() => {
                        delete pages[pagePath]
                        reject(new Error('load page data failed'))
                    })
                } else {
                    resolve()
                }
            } else {
                delete pages[pagePath]
                reject(new Error('bad page'))
            }
        }
        script.onerror = err => {
            delete pages[pagePath]
            reject(err)
        }
        document.head.appendChild(script)
    })
}
