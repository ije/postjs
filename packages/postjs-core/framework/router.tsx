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

    // url returns a copy url
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

const segmentize = (s: string) => utils.cleanPath(s).replace(/^\/+|\/+$/g, '').split('/')

function matchPath(routePath: string, locPath: string): [Record<string, string>, boolean] {
    const routeSegments = segmentize(routePath)
    const locSegments = segmentize(locPath)
    const isRoot = locSegments[0] === ''
    const max = Math.max(routeSegments.length, locSegments.length)
    const params: Record<string, string> = {}

    let ok = true

    for (let i = 0; i < max; i++) {
        const routeSegment = routeSegments[i]
        const locSegment = locSegments[i]
        const isSplat = routeSegment === '*'

        if (isSplat) {
            // Hit a splat, just grab the rest, and return a match
            // uri:   /files/documents/work
            // route: /files/*
            params['*'] = locSegments.slice(i).map(decodeURIComponent).join('/')
            break
        }

        if (locSegment === undefined) {
            // URI is shorter than the route, no match
            // uri:   /users
            // route: /users/$userId
            ok = false
            break
        }

        if (!isRoot && routeSegment.startsWith('$')) {
            params[routeSegment.slice(1)] = decodeURIComponent(locSegment)
        } else if (routeSegment !== locSegment) {
            // Current segments don't match, not dynamic, not splat, so no match
            // uri:   /users/123/settings
            // route: /users/$id/profile
            ok = false
            break
        }
    }

    return [params, ok]
}
