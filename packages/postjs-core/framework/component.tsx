import React, { Children, ComponentType, PropsWithChildren, useEffect, useState } from 'react'
import hotEmitter from 'webpack/hot/emitter'
import utils from './utils'

interface ComponentProps {
    is: string
    props?: Record<string, any>
    ssr?: boolean
    package?: string
}

export function Component({ is, props, ssr, children }: PropsWithChildren<ComponentProps>) {
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    useEffect(() => {
        const {
            __POST_COMPONENTS: components = {},
            __POST_BUILD_MANIFEST: buildManifest
        } = window as any
        const buildInfo = buildManifest.components[is]
        if (buildInfo !== undefined) {
            if (is in components) {
                setIsLoading(false)
            } else {
                const script = document.createElement('script')
                script.src = `_post/components/${is}.js?v=${buildInfo.hash}`
                script.async = false
                script.onload = () => {
                    setIsLoading(false)
                }
                script.onerror = () => {
                    setIsLoading(false)
                    setError(new Error(`can't get component '${is}'`))
                }
                document.head.appendChild(script)
            }
        } else {
            setIsLoading(false)
            setError(new Error(`component '${is}' not found`))
        }
    }, [])

    if (isLoading) {
        if (Children.count(children) > 0) {
            return children
        }
        return <Loading text="loading..." />
    }

    if (error) {
        return <Loading error={error} />
    }

    const { __POST_COMPONENTS: components = {} } = window as any
    if (is in components) {
        return <ComponentWrapper component={components[is]} props={props} />
    }

    return null
}

export function Loading({ text, error }: { text?: string, error?: Error }) {
    return <div className="loading">{error ? 'Error: ' + error.message : text}</div>
}

function ComponentWrapper({ component, props }: { component: { name: string, style: string, reqComponent: () => ComponentType }, props: any }) {
    const [mod, setMod] = useState<{ Component: ComponentType }>({ Component: component.reqComponent() })

    useEffect(() => {
        const hmr = window['__POST_HMR'] = true
        const hasStyle = utils.isNEString(component.style)
        const hotUpdate = (Component: ComponentType) => setMod({ Component })

        if (hmr) {
            hotEmitter.on('postComponentHotUpdate-' + component.name, hotUpdate)
        }

        if (hasStyle) {
            const styleEl = document.createElement('style')
            styleEl.setAttribute('data-post-component-style', component.name)
            styleEl.innerText = component.style
            document.head.appendChild(styleEl)
        }

        return () => {
            if (hmr) {
                hotEmitter.off('postComponentHotUpdate-' + component.name, hotUpdate)
            }
            if (hasStyle) {
                const el = document.head.querySelector(`style[data-post-component-style=${JSON.stringify(component.name)}]`)
                if (el) {
                    document.head.removeChild(el)
                }
            }
        }
    }, [])

    return <mod.Component {...props} />
}
