import React, { PropsWithChildren, Children, isValidElement, Fragment } from 'react'
import utils from './utils'

const isServer = globalThis.process !== undefined
const stateOnServer: Array<{ type: string, props: any }> = []

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
    stateOnServer.splice(0, stateOnServer.length) // clear
    if (spaces) {
        return html.map(s => ' '.repeat(spaces) + s).join('\n')
    }
    return html.join('')
}

export function Head({ children }: PropsWithChildren<{}>) {
    const nest: any[] = []
    Children.forEach(children, child => {
        if (Array.isArray(child)) {
            Head({ children: child })
            return
        }
        if (!isValidElement(child)) {
            return
        }

        const { type, props } = child

        if (type === SEO) {
            nest.push(child)
            return
        }

        switch (type) {
            case 'title':
            case 'meta':
            case 'link':
            case 'style':
            case 'script':
            case 'no-script':
                if (isServer) {
                    stateOnServer.push({ type, props })
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

    return <Fragment>{nest}</Fragment>
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
            {image && [
                <meta name="og:image" content={image} />,
                <meta name="twitter:image" content={image} />,
                <meta name="twitter:card" content="summary_large_image" />
            ]}
            {url && [
                <meta name="og:url" content={url} />,
                <meta name="twitter:site" content={url} />
            ]}
        </Head>
    )
}
