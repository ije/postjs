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
        const [p, ok] = utils.matchPath(routePath, asPath)
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

