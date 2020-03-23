import React, { PropsWithChildren, Children, ReactText, isValidElement, createElement, ReactNode, Fragment } from 'react'
import utils from '../shared/utils'

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

const isServer = globalThis.process !== undefined
const stateOnServer = new Map<string, { tag: string, props: any, children?: ReactText }>()

export default function Head({ children }: PropsWithChildren<{}>) {
    const nextStep: any[] = []
    Children.forEach(children, child => {
        if (Array.isArray(child)) {
            Head({ children: child })
            return
        }
        if (!isValidElement(child)) {
            return
        }

        const { type: tag, props } = child

        if (tag === SEO) {
            nextStep.push(child)
            return
        }

        if (isServer) {
            switch (tag) {
                case 'title':
                    stateOnServer.set(tag, { tag, props })
                    break
                case 'meta':
                    stateOnServer.set(tag + '.' + (props['name'] || props['property'] || props['charSet'] || ''), { tag, props })
                    break
                case 'link':
                case 'style':
                case 'script':
                case 'no-script':
                    stateOnServer.set(tag + '.' + JSON.stringify(props), { tag, props })
                    break
                default:
                    break
            }
        } else {
            switch (tag) {
                case 'title':
                case 'meta':
                case 'link':
                case 'style':
                case 'script':
                case 'no-script':
                    const el = globalThis.document.createElement(tag)
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
                    document.head.appendChild(el)
                    break
                default:
                    break
            }
        }
    })
    return <Fragment>{nextStep}</Fragment>
}

export function renderHeadToString(spaces?: number): string {
    const html: string[] = []
    stateOnServer.forEach(({ tag, props }) => {
        const attrs = Object.keys(props)
            .filter(key => key !== 'children' && utils.isString(props[key]))
            .map(key => `${key}="${props[key].replace(/"/g, '\\"')}"`)
            .join(' ')
        if (attrs !== '') {
            if (utils.isNEString(props.children)) {
                html.push(`<${tag} ${attrs}>${props.children}</${tag}>`)
            } else {
                html.push(`<${tag} ${attrs} />`)
            }
        } else if (tag === 'title' && utils.isNEString(props.children)) {
            html.push(`<title>${props.children}</title>`)
        }
    })
    stateOnServer.clear() // reset
    if (spaces) {
        return html.map(s => ' '.repeat(spaces) + s).join('\n')
    }
    return html.join('')
}
