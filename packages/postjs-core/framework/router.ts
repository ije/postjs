import { parse, ParsedUrlQuery } from 'querystring'
import { createContext, useContext } from 'react'
import { redirect } from './redirect'
import { utils } from './utils'

export interface URL {
    pagePath: string
    asPath: string
    params: Record<string, string>
    query: ParsedUrlQuery
}

export class RouterStore {
    private _url: URL

    constructor(url: URL) {
        this._url = url
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
    new RouterStore({ pagePath: '/', asPath: '/', params: {}, query: {} })
)
RouterContext.displayName = 'RouterContext'

export function useRouter() {
    return useContext(RouterContext)
}

export function route(base: string, pagePaths: string[], options?: { location?: { pathname: string, search?: string }, fallback?: string }): URL {
    const loc = (options?.location || location)
    const fallback = options?.fallback

    let pagePath = ''
    let asPath = loc.pathname
    let params: Record<string, string> = {}
    let query: ParsedUrlQuery = loc.search ? parse(loc.search.replace(/^\?/, '')) : {}

    if (base.length > 1 && base.charAt(0) === '/') {
        asPath = utils.trimPrefix(asPath, base)
        if (asPath === '' || asPath.charAt(0) !== '/') {
            asPath = '/' + asPath
        }
    }

    // todo: sort pagePaths

    utils.each(pagePaths, routePath => {
        const [p, ok] = matchPath(routePath, asPath)
        if (ok) {
            pagePath = routePath
            params = p
            return false
        }
        return undefined
    })

    if (pagePath === '' && fallback !== undefined) {
        pagePath = fallback
    }

    return { pagePath, asPath, params, query }
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
