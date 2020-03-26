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

export function route(base: string, routes: Route[]): [URL, ComponentType<any> | null] {
    let pagePath = ''
    let pathname = location.pathname
    let params: Record<string, string> = {}
    let query: ParsedUrlQuery = parse(location.search.replace(/^\?/, ''))
    let component: ComponentType<any> | null = null

    if (base.length > 1 && base.startsWith('/')) {
        pathname = utils.trimPrefix(pathname, base)
        if (!pathname.startsWith('/')) {
            pathname = '/' + pathname
        }
    }

    utils.each(routes, route => {
        const match = matchPath(route.path, pathname)
        if (match !== null) {
            pagePath = route.path
            params = match
            component = route.component
            return false
        }
        return undefined
    })

    return [{ pagePath, pathname, params, query }, component]
}

const regParam = /^\$(.+)/
const segmentize = (s: string) => utils.cleanPath(s).replace(/^\/+|\/+$/g, '').split('/')

// raw code copy from https://github.com/reach/router/blob/master/src/lib/utils.js#L30 (MIT License Copyright (c) 2018-present, Ryan Florence)
function matchPath(routePath: string, locPath: string): Record<string, string> | null {
    const locSegments = segmentize(locPath)
    const routeSegments = segmentize(routePath)
    const max = Math.max(routeSegments.length, locSegments.length)
    const isRoot = locSegments[0] === ''
    const params: Record<string, string> = {}
    let missed = false

    for (let i = 0; i < max; i++) {
        const routeSegment = routeSegments[i]
        const locationSegment = locSegments[i]
        const isSplat = routeSegment === '*'

        if (isSplat) {
            // Hit a splat, just grab the rest, and return a match
            // uri:   /files/documents/work
            // route: /files/*
            params['*'] = locSegments.slice(i).map(decodeURIComponent).join('/')
            break
        }

        if (locationSegment === undefined) {
            // URI is shorter than the route, no match
            // uri:   /users
            // route: /users/$userId
            missed = true
            break
        }

        const paramMatch = regParam.exec(routeSegment)
        if (paramMatch && !isRoot) {
            params[paramMatch[1]] = decodeURIComponent(locationSegment)
        } else if (routeSegment !== locationSegment) {
            // Current segments don't match, not dynamic, not splat, so no match
            // uri:   /users/123/settings
            // route: /users/$id/profile
            missed = true
            break
        }
    }

    if (missed) {
        return null
    }

    return params
}
