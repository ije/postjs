import React, { Children, createElement, isValidElement, PropsWithChildren, ReactElement, ReactNode } from 'react'
import util from './util.ts'

const headElements = new Map<string, { type: string, props: Record<string, any> }>()

export default function Head({ children }: PropsWithChildren<{}>) {
    return null
}

interface SEOProps {
    title: string
    description: string
    keywords?: string | string[]
    image?: string
    url?: string
}

export function SEO({ title, description, keywords, url, image }: SEOProps) {
    return createElement(
        Head,
        undefined,
        createElement('title', undefined, title),
        createElement('meta', { name: 'description', content: description }),
        keywords && createElement('meta', { name: 'keywords', content: util.isArray(keywords) ? keywords.join(',') : keywords }),
        createElement('meta', { name: 'og:title', content: title }),
        createElement('meta', { name: 'og:description', content: description }),
        url && createElement('meta', { name: 'og:url', content: url }),
        image && createElement('meta', { name: 'og:image', content: image }),
        url && createElement('meta', { name: 'twitter:site', content: url }),
        image && createElement('meta', { name: 'twitter:image', content: image }),
        image && createElement('meta', { name: 'twitter:card', content: 'summary_large_image' }),
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
    const content = Object.entries(props)
        .map(([key, value]) => {
            key = key.replace(/[A-Z]/g, c => '-' + c.toLowerCase())
            if (value === true) {
                value = 'yes'
            } else if (value === false) {
                value = 'no'
            }
            return `${key}=${value}`
        })
        .join(',')
    return createElement(
        Head,
        undefined,
        createElement('meta', { name: 'viewport', content })
    )
}

function parse(node: ReactNode, els?: Map<string, { type: string, props: Record<string, any> }>) {
    if (els === undefined) {
        els = new Map()
    }

    Children.forEach(node, child => {
        if (!isValidElement(child)) {
            return
        }

        const { type, props } = child
        switch (type) {
            case React.Fragment:
                parse(props.children, els)
                break
            case SEO:
            case Viewport:
                parse((type(props) as ReactElement).props.children, els)
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
                        key += '-' + (els!.size + 1)
                    }
                    // remove the children prop of base/meta/link
                    if (/^base|meta|link$/.test(type) && 'children' in props) {
                        const { children, ...rest } = props
                        els!.set(key, { type, props: rest })
                    } else {
                        els!.set(key, { type, props })
                    }
                }
                break
        }
    })

    return els!
}

export function renderToTags() {
    const tags: string[] = []
    headElements.forEach(({ type, props }) => {
        if (type === 'title') {
            if (util.isNEString(props.children)) {
                tags.push(`<title>${props.children}</title>`)
            } else if (util.isNEArray(props.children)) {
                tags.push(`<title>${props.children.join('')}</title>`)
            }
        } else {
            const attrs = Object.keys(props)
                .filter(key => key !== 'children')
                .map(key => ` ${key}=${JSON.stringify(props[key])}`)
                .join('')
            if (util.isNEString(props.children)) {
                tags.push(`<${type}${attrs}>${props.children}</${type}>`)
            } else if (util.isNEArray(props.children)) {
                tags.push(`<${type}${attrs}>${props.children.join('')}</${type}>`)
            } else {
                tags.push(`<${type}${attrs} />`)
            }
        }
    })
    headElements.clear()
    return tags
}
