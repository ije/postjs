import React, { Children, ComponentType, Fragment, PropsWithChildren, useEffect, useState } from 'react'
import hotEmitter from 'webpack/hot/emitter'
import { isServer, utils } from './utils'

export const activatedLazyComponents = new Set<string>()

interface LazyComponentProps {
    is: string
    props?: Record<string, any>
    ssr?: boolean
    package?: string
}

export function LazyComponent({ is: name, props, children }: PropsWithChildren<LazyComponentProps>): JSX.Element | null {
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    if (isServer()) {
        // todo: ssr?
        activatedLazyComponents.add(name)
    }

    useEffect(() => {
        const {
            __POST_COMPONENTS: components = {},
            __POST_BUILD_MANIFEST: buildManifest = {}
        } = window as any
        const buildInfo = (buildManifest.components || {})[name]
        if (buildInfo !== undefined) {
            if (name in components) {
                setIsLoading(false)
            } else {
                const script = document.createElement('script')
                const loadScriptBaseUrl = window['__post_loadScriptBaseUrl'] || ''
                script.src = `${loadScriptBaseUrl}_post/components/${name}.js?v=${buildInfo.hash}`
                script.async = false
                script.onload = () => {
                    setIsLoading(false)
                }
                script.onerror = () => {
                    setIsLoading(false)
                    setError(`can't fetch component '${name}'`)
                }
                document.head.appendChild(script)
            }
        } else {
            setIsLoading(false)
            setError(`component '${name}' not found`)
        }
    }, [name])

    if (isLoading) {
        if (Children.count(children) > 0) {
            return <Fragment>{children}</Fragment>
        }
        return <Loading />
    }

    if (error) {
        return <Loading error={error} />
    }

    return <HotComponent name={name} props={props} />
}

function HotComponent({ name, props }: { name: string, props: any }) {
    const [hot, setHot] = useState<{ Component: ComponentType | null }>(() => {
        const { __POST_COMPONENTS: components = {} } = window as any
        if (name in components) {
            const component = components[name]
            if (utils.isNEString(component.style) && document.head.querySelector(`style[data-post-component-styl=${JSON.stringify(name)}]`) === null) {
                const styleEl = document.createElement('style')
                styleEl.setAttribute('data-post-component-style', name)
                styleEl.innerText = component.style
                document.head.appendChild(styleEl)
            }
            return { Component: component.reqComponent() }
        }
        return { Component: null }
    })

    useEffect(() => {
        const hmr = window['__POST_HMR']
        const hotUpdate = (Component: ComponentType) => setHot({ Component })

        if (hmr) {
            hotEmitter.on('postComponentHotUpdate:' + name, hotUpdate)
        }

        return () => {
            if (hmr) {
                hotEmitter.off('postComponentHotUpdate:' + name, hotUpdate)
            }
        }
    }, [name])

    if (hot.Component === null) {
        return <Loading error={`component '${name}' not found`} />
    }

    return <hot.Component {...props} />
}

export function Loading({ text, error }: { text?: string, error?: string }) {
    if (error) {
        return (
            <div className="post-error">
                <p style={{ padding: 50 }}>{'Error: ' + error}</p>
            </div>
        )
    }

    return <div className="post-loading">{text}</div>
}
