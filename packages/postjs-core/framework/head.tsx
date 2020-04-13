import React, { Children, Fragment, isValidElement, PropsWithChildren, ReactElement, ReactNode, useEffect } from 'react'
import { isServer, utils } from './utils'

const stateOnServer = new Map<string, { type: string, props: any }>()

export function Head({ children }: PropsWithChildren<{}>) {
    if (isServer()) {
        parse(children).forEach(({ type, props }, key) => stateOnServer.set(key, { type, props }))
    }

    useEffect(() => {
        const nodes = parse(children)
        const prevTitle = nodes.has('title') ? document.title : null
        const prevMetas: Array<{ el: HTMLElement, props: Record<string, string> }> = []
        const insertedEls: Array<HTMLElement> = []

        nodes.forEach(({ type, props }, key) => {
            if (type === 'title') {
                const { children } = props
                if (utils.isString(children)) {
                    document.title = children
                } else if (utils.isArray(children)) {
                    document.title = children.join('')
                }
                return
            }

            if (type === 'meta') {
                const prevEl = document.head.querySelector(key)
                if (prevEl) {
                    const prevProps: Record<string, string> = {}
                    const propKeys = Object.keys(props)
                    prevEl.getAttributeNames().forEach(name => {
                        prevProps[name] = prevEl.getAttribute(name)!
                        if (!propKeys.includes(name)) {
                            prevEl.removeAttribute(name)
                        }
                    })
                    propKeys.forEach(key => {
                        prevEl.setAttribute(key, String(props[key] || ''))
                    })
                    prevMetas.push({
                        props: prevProps,
                        el: prevEl as HTMLElement
                    })
                    return
                }
            }

            const el = document.createElement(type)
            const anchor = document.head.querySelector('meta[name="post-head-end"]')
            if (anchor) {
                document.head.insertBefore(el, anchor)
            } else {
                document.head.appendChild(el)
            }
            insertedEls.push(el)
            Object.keys(props).forEach(key => {
                const value = props[key]
                if (key === 'children') {
                    if (utils.isNEString(value)) {
                        el.innerText = value
                    } else if (utils.isNEArray(value)) {
                        el.innerText = value.join('')
                    }
                } else {
                    el.setAttribute(key, String(value || ''))
                }
            })
        })

        return () => {
            if (prevTitle) {
                document.title = prevTitle
            }
            prevMetas.forEach(({ el, props }) => {
                const propKeys = Object.keys(props)
                el.getAttributeNames().filter(name => !propKeys.includes(name)).forEach(name => {
                    el.removeAttribute(name)
                })
                propKeys.forEach(key => el.setAttribute(key, props[key]))
            })
            insertedEls.forEach(el => document.head.removeChild(el))
        }
    }, [])

    return null
}

interface SEOProps {
    title: string
    description: string
    keywords: string
    image?: string
    url?: string
}

export function SEO({ title, description, keywords, url, image }: SEOProps) {
    return (
        <Head>
            <title>{title}</title>
            <meta name="description" content={description} />
            <meta name="keywords" content={keywords} />
            <meta name="og:title" content={title} />
            <meta name="og:description" content={description} />
            {image && (
                <Fragment>
                    <meta name="og:image" content={image} />
                    <meta name="twitter:image" content={image} />
                    <meta name="twitter:card" content="summary_large_image" />
                </Fragment>
            )}
            {url && (
                <Fragment>
                    <meta name="og:url" content={url} />
                    <meta name="twitter:site" content={url} />
                </Fragment>
            )}
        </Head>
    )
}

interface ViewportProps {
    width: number | 'device-width'
    height?: number | 'device-height'
    initialScale?: number
    minimumScale?: number
    maximumScale?: number
    userScalable?: boolean
    targetDensitydpi?: number | 'device-dpi' | 'low-dpi' | 'medium-dpi' | 'high-dpi'
}

export function Viewport(props: ViewportProps) {
    const content = Object.keys(props)
        .map(key => `${key.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}=${key === 'userScalable' ? (props[key] ? 'yes' : 'no') : props[key]}`)
        .join(',')
    return (
        <Head>
            <meta name="viewport" content={content} />
        </Head>
    )
}

export function renderHeadToString(): string[] {
    const tags: string[] = []
    stateOnServer.forEach(({ type, props }) => {
        if (type === 'title') {
            if (utils.isNEString(props.children)) {
                tags.push(`<title>${props.children}</title>`)
            } else if (utils.isNEArray(props.children)) {
                tags.push(`<title>${props.children.join('')}</title>`)
            }
        } else {
            const attrs = Object.keys(props)
                .filter(key => key !== 'children')
                .map(key => ` ${key}=${JSON.stringify(props[key])}`)
                .join('')
            if (utils.isNEString(props.children)) {
                tags.push(`<${type}${attrs}>${props.children}</${type}>`)
            } else if (utils.isNEArray(props.children)) {
                tags.push(`<${type}${attrs}>${props.children.join('')}</${type}>`)
            } else {
                tags.push(`<${type}${attrs} />`)
            }
        }
    })
    stateOnServer.clear()
    return tags
}

function parse(node: ReactNode, nodes?: Map<string, { type: string, props: any }>) {
    if (nodes === undefined) {
        nodes = new Map()
    }

    Children.forEach(node, child => {
        if (!isValidElement(child)) {
            return
        }

        const { type, props } = child
        switch (type) {
            case Fragment:
                parse(props.children, nodes)
                break
            case SEO:
            case Viewport:
                parse((type(props) as ReactElement).props.children, nodes)
                break
            case 'base':
            case 'title':
            case 'meta':
            case 'link':
            case 'style':
            case 'script':
            case 'no-script':
                {
                    let key = type
                    if (type === 'meta') {
                        const propKeys = Object.keys(props).map(k => k.toLowerCase())
                        if (propKeys.includes('charset')) {
                            return // ignore charset, always use utf-8
                        }
                        if (propKeys.includes('name')) {
                            key += `[name=${JSON.stringify(props['name'])}]`
                        } else if (propKeys.includes('property')) {
                            key += `[property=${JSON.stringify(props['property'])}]`
                        } else if (propKeys.includes('http-equiv')) {
                            key += `[http-equiv=${JSON.stringify(props['http-equiv'])}]`
                        } else {
                            key += Object.keys(props).filter(k => !(/^content|children$/i.test(k))).map(k => `[${k.toLowerCase()}=${JSON.stringify(props[k])}]`).join('')
                        }
                    } else if (type !== 'title') {
                        key += '-' + (nodes!.size + 1)
                    }
                    // remove children prop of base/meta/link tag
                    if ('children' in props && /^base|meta|link$/.test(type)) {
                        const { children, ...rest } = props
                        nodes!.set(key, { type, props: rest })
                    } else {
                        nodes!.set(key, { type, props })
                    }
                }
                break
        }
    })

    return nodes!
}
