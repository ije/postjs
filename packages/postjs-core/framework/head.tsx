import React, { PropsWithChildren, Children, isValidElement, Fragment, ReactNode } from 'react'
import utils from './utils'

const isServer = globalThis.process !== undefined
const stateOnServer = new Map<string, { type: string, props: any }>()

function attr(s?: string) {
    return s?.replace(/"/g, '\\"') || ''
}

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
                            key += '[charset]'
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
                        el = globalThis.document.querySelector('title')
                    } else if (type === 'meta') {
                        let query: string
                        if (utils.isString(props['charset']) || utils.isString(props['charSet'])) {
                            query = 'meta[charset]'
                        } else if (utils.isString(props['name'])) {
                            query = `meta[name="${attr(props['name'])}"]`
                        } else if (utils.isString(props['property'])) {
                            query = `meta[property="${attr(props['property'])}"]`
                        } else {
                            query = Object.keys(props).filter(k => k !== 'content' && k !== 'children').map(k => `meta[${k}="${attr(props[k])}"]`).join(',')
                        }
                        el = globalThis.document.querySelector(query)
                    }
                    if (el === null) {
                        el = globalThis.document.createElement(type)
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
                    globalThis.document.head.appendChild(el)
                }
                break
        }
    })
}

export function Head({ children }: PropsWithChildren<{}>) {
    renderHead(children)
    return null
}

export function renderHeadToString(spaces?: number): string {
    const html: string[] = []
    stateOnServer.forEach(({ type, props }) => {
        const attrs = Object.keys(props)
            .filter(key => key !== 'children' && utils.isString(props[key]))
            .map(key => `${key}="${attr(props[key])}"`)
            .join(' ')
        if (attrs !== '') {
            if (utils.isNEString(props.children)) {
                html.push(`<${type} ${attrs}>${props.children}</${type}>`)
            } else {
                html.push(`<${type} ${attrs} />`)
            }
        } else if (type === 'title') {
            html.push(`<title>${props.children || ''}</title>`)
        }
    })
    stateOnServer.clear()
    if (spaces) {
        return html.map(s => ' '.repeat(spaces) + s).join('\n')
    }
    return html.join('')
}

interface SEOProps {
    title: string
    description: string
    keywords: string
    image?: string
    url?: string
}

export const SEO = ({ title, description, keywords, url, image }: SEOProps) => (
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
