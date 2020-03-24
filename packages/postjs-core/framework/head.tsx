import React, { PropsWithChildren, Children, isValidElement, Fragment, ReactNode } from 'react'
import utils from './utils'

const isServer = globalThis.process !== undefined
const stateOnServer = new Map<string, { type: string, props: any }>()

export function renderHeadToString(spaces?: number): string {
    const html: string[] = []
    stateOnServer.forEach(({ type, props }) => {
        const attrs = Object.keys(props)
            .filter(key => key !== 'children' && utils.isString(props[key]))
            .map(key => `${key}="${props[key].replace(/"/g, '\\"')}"`)
            .join(' ')
        if (attrs !== '') {
            if (utils.isNEString(props.children)) {
                html.push(`<${type} ${attrs}>${props.children}</${type}>`)
            } else {
                html.push(`<${type} ${attrs} />`)
            }
        } else if (type === 'title' && utils.isNEString(props.children)) {
            html.push(`<title>${props.children}</title>`)
        }
    })
    stateOnServer.clear()
    if (spaces) {
        return html.map(s => ' '.repeat(spaces) + s).join('\n')
    }
    return html.join('')
}

function parse(node: ReactNode) {
    Children.forEach(node, child => {
        if (!isValidElement(child)) {
            return
        }

        const { type, props } = child

        switch (type) {
            case SEO:
                parse(child)
                break
            case Fragment:
                parse(props.children)
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
                        if (utils.isString(props['charSet']) || utils.isString(props['charset'])) {
                            key += '_charSet'
                        } else if (utils.isString(props['name']) || utils.isString(props['property'])) {
                            key += '_name_' + (props['name'] || props['property'])
                        } else {
                            key += '_' + Object.keys(props).filter(k => k !== 'content').map(k => k + '=' + props[k]).join('_')
                        }
                    } else if (key !== 'title') {
                        key += '_' + Object.keys(props).map(k => k + '=' + props[k]).join('_')
                    }
                    stateOnServer.set(key, { type, props })
                } else {
                    const el = globalThis.document.createElement(type)
                    Object.keys(props).forEach(key => {
                        const value = props['children']
                        if (utils.isString(value)) {
                            if (key === 'children') {
                                el.innerText = value
                            } else {
                                el.setAttribute(key, value)
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
    parse(children)
    return null
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
