import { ParsedUrlQuery, parse } from 'querystring'
import { createContext, useContext, ComponentType } from 'react'
import utils from './utils'

export interface URL {
    pagePath: string
    pathname: string
    params: Record<string, string>
    query: ParsedUrlQuery
}

export interface Route {
    path: string
    component: ComponentType<any>
}

export class RouterStore {
    private _url: URL

    constructor(url?: URL) {
        this._url = url || { pagePath: '/', pathname: '/', params: {}, query: {} }
    }

    // url returns the url as copy
    get url(): URL {
        return { ...this._url }
    }

    push(url: string, as?: string) {

    }

    replace(url: string, as?: string) {

    }
}

export const RouterContext = createContext(new RouterStore())

export function useRouter() {
    return useContext(RouterContext)
}

export function route(base: string, routes: Route[], options?: { location?: { pathname: string, search?: string }, fallback?: Route }): [URL, ComponentType<any> | null] {
    const loc = (options?.location || location)
    const fallback = options?.fallback

    let pagePath = ''
    let pathname = loc.pathname
    let params: Record<string, string> = {}
    let query: ParsedUrlQuery = parse((loc.search || '').replace(/^\?/, ''))
    let component: ComponentType<any> | null = null

    if (base.length > 1 && base.startsWith('/')) {
        pathname = utils.trimPrefix(pathname, base)
        if (!pathname.startsWith('/')) {
            pathname = '/' + pathname
        }
    }

    routes.sort()
    utils.each(routes, route => {
        const [_params, ok] = matchPath(route.path, pathname)
        if (ok) {
            pagePath = route.path
            params = _params
            component = route.component
            return false
        }
        return undefined
    })

    if (component === null && fallback !== undefined) {
        pagePath = fallback.path
        component = fallback.component
    }

    return [{ pagePath, pathname, params, query }, component]
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
        const isWild = routeSeg === '*'

        if (isWild) {
            params['*'] = locSegments.slice(i).map(decodeURIComponent).join('/')
            break
        }

        if (locSeg === undefined) {
            ok = false
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
