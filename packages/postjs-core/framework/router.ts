import { createContext, useContext } from 'react'
import { redirect } from './redirect'
import { utils } from './utils'

export interface URL {
    locale: string
    pagePath: string
    asPath: string
    params: Record<string, string>
    query: Record<string, string | string[]>
}

export class RouterStore {
    private _url: URL

    constructor(url: URL) {
        this._url = url
    }

    get locale() {
        return this._url.locale
    }

    get pagePath() {
        return this._url.pagePath
    }

    get asPath() {
        return this._url.asPath
    }

    get params() {
        return { ...this._url.params }
    }

    get query() {
        return { ...this._url.query }
    }

    push(href: string) {
        redirect(href)
    }

    replace(href: string) {
        redirect(href, true)
    }
}

export const RouterContext = createContext(
    new RouterStore({ locale: 'en', pagePath: '/', asPath: '/', params: {}, query: {} })
)
RouterContext.displayName = 'RouterContext'

export function useRouter() {
    return useContext(RouterContext)
}

export function route(base: string, pagePaths: string[], options?: { location?: { pathname: string, search?: string }, fallback?: string, defaultLocale?: string, locales?: string[] }): URL {
    const { pathname, search }: Location = (options?.location || (window as any).location || { pathname: '/' })
    const asPath = utils.cleanPath(utils.trimPrefix(pathname, base))
    const query: Record<string, string | string[]> = {}

    if (search) {
        const segs = utils.trimPrefix(search, '?').split('&')
        segs.forEach(seg => {
            const [key, value] = utils.splitBy(seg, '=')
            if (key in query) {
                const prevValue = query[key]
                if (utils.isArray(prevValue)) {
                    prevValue.push(value)
                } else {
                    query[key] = [prevValue, value]
                }
            } else {
                query[key] = value
            }
        })
    }

    let locale = options?.defaultLocale || 'en'
    let asPagePath = asPath
    let pagePath = ''
    let params: Record<string, string> = {}

    if (asPagePath !== '/') {
        const a = asPagePath.slice(1).split('/')
        if (options?.locales?.includes(a[0])) {
            locale = a[0]
            asPagePath = '/' + a.slice(1).join('/')
        }
    }

    for (const routePath of pagePaths) {
        const [p, ok] = matchPath(routePath, asPagePath)
        if (ok) {
            pagePath = routePath
            params = p
            break
        }
    }

    if (pagePath === '' && options?.fallback) {
        pagePath = options?.fallback
    }

    return { locale, asPath, pagePath, params, query }
}

function matchPath(routePath: string, locPath: string): [Record<string, string>, boolean] {
    const routeSegments = utils.cleanPath(routePath).replace(/^\//, '').split('/')
    const locSegments = utils.cleanPath(locPath).replace(/^\//, '').split('/')
    const isRoot = locSegments[0] === ''
    const max = Math.max(routeSegments.length, locSegments.length)
    const params: Record<string, string> = {}

    let ok = true

    for (let i = 0; i < max; i++) {
        const routeSeg = routeSegments[i]
        const locSeg = locSegments[i]

        if (locSeg === undefined || routeSeg === undefined) {
            ok = false
            break
        }

        if (routeSeg === '*') {
            params['*'] = locSegments.slice(i).map(decodeURIComponent).join('/')
            break
        }

        if (!isRoot && routeSeg.startsWith('$')) {
            params[routeSeg.slice(1)] = decodeURIComponent(locSeg)
        } else if (routeSeg !== locSeg) {
            ok = false
            break
        }
    }

    return [params, ok]
}
