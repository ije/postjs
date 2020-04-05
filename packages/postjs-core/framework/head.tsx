import React, { Children, Fragment, isValidElement, PropsWithChildren, ReactNode, useEffect } from 'react'
import utils from './utils'

const isServer = !process['browser']
const stateOnServer = new Map<string, { type: string, props: any }>()
const stringify = (s: string) => JSON.stringify(s)

export function Head({ children }: PropsWithChildren<{}>) {
    if (isServer) {
        parse(children).forEach(({ type, props }, key) => stateOnServer.set(key, { type, props }))
    }

    useEffect(() => {
        const els: Array<HTMLElement> = []
        parse(children).forEach(({ type, props }) => {
            const el = document.createElement(type)
            document.head.appendChild(el)
            els.push(el)
            Object.keys(props).forEach(key => {
                const value = props[key]
                if (key === 'children') {
                    if (utils.isNEString(value)) {
                        el!.innerText = value
                    } else if (utils.isNEArray(value)) {
                        el!.innerText = value.join('')
                    }
                } else {
                    el!.setAttribute(key, '' + (value || ''))
                }
            })
        })
        return () => els.forEach(el => document.head.removeChild(el))
    }, [children])

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

export function renderHeadToString(): string[] {
    const helmet: string[] = []
    stateOnServer.forEach(({ type, props }) => {
        const attrs = Object.keys(props)
            .filter(key => key !== 'children' && utils.isString(props[key]))
            .map(key => `${key}=${stringify(props[key])}`)
            .join(' ')
        if (attrs !== '') {
            if (utils.isNEString(props.children)) {
                helmet.push(`<${type} ${attrs} data-jsx="true">${props.children}</${type}>`)
            } else if (utils.isNEArray(props.children)) {
                helmet.push(`<${type} ${attrs} data-jsx="true">${props.children.join('')}</${type}>`)
            } else {
                helmet.push(`<${type} ${attrs} data-jsx="true">`)
            }
        } else if (type === 'title') {
            if (utils.isNEString(props.children)) {
                helmet.push(`<title data-jsx="true">${props.children}</title>`)
            } else if (utils.isNEArray(props.children)) {
                helmet.push(`<title data-jsx="true">${props.children.join('')}</title>`)
            }
        }
    })
    stateOnServer.clear()
    return helmet
}

function parse(node: ReactNode, set?: Map<string, { type: string, props: any }>) {
    if (set === undefined) {
        set = new Map()
    }
    Children.forEach(node, child => {
        if (!isValidElement(child)) {
            return
        }

        const { type, props } = child
        switch (type) {
            case SEO:
                parse(child, set)
                break
            case Fragment:
                parse(props.children, set)
                break
            case 'meta':
                if (Object.keys(props).map(key => key.toLowerCase()).includes('charset')) {
                    return // ignore charset, always use utf-8
                }
            case 'base':
            case 'title':
            case 'link':
            case 'style':
            case 'script':
            case 'no-script':
                let key = type
                if (type === 'meta') {
                    if (utils.isString(props['name'])) {
                        key += `[name=${props['name']}]`
                    } else if (utils.isString(props['property'])) {
                        key += `[property=${props['property']}]`
                    } else if (utils.isString(props['http-equiv'])) {
                        key += `[http-equiv=${props['http-equiv']}]`
                    } else {
                        key += '[' + Object.keys(props).filter(k => k !== 'content' && k !== 'children').map(k => k + '=' + JSON.stringify(props[k])).join(',') + ']'
                    }
                } else if (key !== 'title') {
                    key += '[' + Object.keys(props).filter(k => k !== 'children').map(k => k + '=' + JSON.stringify(props[k])).join(',') + '].' + Math.random()
                }
                set!.set(key, { type, props })
                break
        }
    })
    return set!
}
