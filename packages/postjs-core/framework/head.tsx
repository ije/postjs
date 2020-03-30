import React, { Children, Fragment, isValidElement, PropsWithChildren, ReactNode } from 'react'
import utils from './utils'

const isServer = typeof process !== undefined
const stateOnServer = new Map<string, { type: string, props: any }>()
const stringify = (s: string) => JSON.stringify(s)

function renderHead(node: ReactNode) {
    Children.forEach(node, child => {
        if (!isValidElement(child)) {
            return
        }

        const { type, props } = child

        switch (type) {
            case SEO:
                renderHead(child)
                break
            case Fragment:
                renderHead(props.children)
                break
            case 'title':
            case 'meta':
            case 'link':
            case 'style':
            case 'script':
            case 'no-script':
                if (isServer) {
                    let key = type
                    if (type === 'meta') {
                        if (utils.isString(props['charset']) || utils.isString(props['charSet'])) {
                            return // ignore charset, always use utf-8
                        } else if (utils.isString(props['name'])) {
                            key += `[name=${props['name']}]`
                        } else if (utils.isString(props['property'])) {
                            key += `[property=${props['property']}]`
                        } else {
                            key += '[' + Object.keys(props).filter(k => k !== 'content' && k !== 'children').map(k => k + '=' + props[k]).join(',') + ']'
                        }
                    } else if (key !== 'title') {
                        key += '[' + Object.keys(props).filter(k => k !== 'children').map(k => k + '=' + props[k]).join(',') + '].' + Math.random()
                    }
                    stateOnServer.set(key, { type, props })
                } else {
                    let el: HTMLElement | null = null
                    if (type === 'title') {
                        el = document.querySelector('title')
                    } else if (type === 'meta') {
                        let query: string
                        if (utils.isString(props['charset']) || utils.isString(props['charSet'])) {
                            query = 'meta[charset]'
                        } else if (utils.isString(props['name'])) {
                            query = `meta[name=${stringify(props['name'])}]`
                        } else if (utils.isString(props['property'])) {
                            query = `meta[property=${stringify(props['property'])}]`
                        } else {
                            query = Object.keys(props).filter(k => k !== 'content' && k !== 'children').map(k => `meta[${k}=${stringify(props[k])}]`).join(',')
                        }
                        el = document.querySelector(query)
                    }
                    if (el === null) {
                        el = document.createElement(type)
                        el.setAttribute('data-post-' + type, 'true')
                        document.head.appendChild(el)
                    }
                    Object.keys(props).forEach(key => {
                        const value = props[key]
                        if (utils.isString(value)) {
                            if (key === 'children') {
                                el!.innerText = value
                            } else {
                                el!.setAttribute(key, value)
                            }
                        }
                    })
                }
                break
        }
    })
}

export function Head({ children }: PropsWithChildren<{}>) {
    renderHead(children)
    return null
}

export function renderHeadToString(): string[] {
    const helmet: string[] = []
    stateOnServer.forEach(({ type, props }) => {
        const attrs = Object.keys(props)
            .filter(key => key !== 'children' && utils.isString(props[key]))
            .map(key => `${key}=${stringify(props[key])}`)
            .join(' ')
        if (attrs !== '') {
            if (utils.isNEString(props.children)) {
                helmet.push(`<${type} ${attrs} data-post-${type}="true">${props.children}</${type}>`)
            } else {
                helmet.push(`<${type} ${attrs} data-post-${type}="true">`)
            }
        } else if (type === 'title') {
            helmet.push(`<title data-post-title="true">${props.children || ''}</title>`)
        }
    })
    stateOnServer.clear()
    return helmet
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
