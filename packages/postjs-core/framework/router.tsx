import React, { createContext, useState, useContext, useEffect, ComponentType, PropsWithChildren } from 'react'
import { ParsedUrlQuery, parse } from 'querystring'
import utils from './utils'

export interface URL {
    routePath: string
    pathname: string
    params: Record<string, string>
    query: ParsedUrlQuery
}

export class RouterStore {
    private _url: URL

    constructor(url?: URL) {
        this._url = url || {
            routePath: '/',
            pathname: '/',
            params: {},
            query: {}
        }
    }

    // url returns a copy url
    get url(): URL {
        return {
            routePath: this._url.routePath,
            pathname: this._url.pathname,
            params: this._url.params,
            query: this._url.query
        }
    }

    push(url: string, as?: string) {

    }

    replace(url: string, as?: string) {

    }
}

export const RouterContext = createContext<RouterStore>(new RouterStore())

export function useRouter(): RouterStore {
    return useContext(RouterContext)
}

export interface Route {
    path: string
    component: React.ComponentType
}

interface RouterProps {
    base: string
    routes: Route[]
}

export function Router({
    base,
    routes,
    children
}: PropsWithChildren<RouterProps>) {
    const [loc, setLoc] = useState(getCurrentLoc())
    const [url, Component] = computeRoute(base, routes, loc)

    globalThis.document.head.innerHTML = ''
    console.log(url, Component)

    useEffect(() => {
        const updateLoc = () => setLoc(getCurrentLoc())
        globalThis.addEventListener('popstate', updateLoc, false)
        return () => globalThis.removeEventListener('popstate', updateLoc, false)
    }, [])

    return (
        <RouterContext.Provider value={new RouterStore(url)}>
            {Component !== null ? (
                <Component url={url} />
            ) : children}
        </RouterContext.Provider>
    )
}

function computeRoute(base: string, routes: Route[], { pathname, search }: { pathname: string, search: string }): [URL, ComponentType<any> | null] {
    let routePath = ''
    let params: Record<string, string> = {}
    let query: ParsedUrlQuery = parse(search.replace(/^\?/, ''))
    let component: ComponentType<any> | null = null
    if (base !== '/') {
        pathname = utils.trimPrefix(pathname, base)
    }

    utils.each(routes, route => {
        const match = matchPath(route.path, pathname)
        if (match !== null) {
            routePath = route.path
            params = match
            component = route.component
            return false
        }
        return undefined
    })

    return [
        {
            routePath,
            pathname,
            params,
            query
        },
        component
    ]
}

const regParam = /^:(.+)/
const segmentize = (path: string) => path.replace(/^[\/\s]+|[\/\s]+$/g, '').split('/').map(p => p.trim())
const getCurrentLoc = () => ({
    pathname: globalThis.location.pathname,
    search: globalThis.location.search
})

export function matchPath(routePath: string, locPath: string): Record<string, string> | null {
    const locSegments = segmentize(locPath)
    const routeSegments = segmentize(routePath)
    const max = Math.max(routeSegments.length, locSegments.length)
    const isRoot = locSegments[0] === ''
    const params: Record<string, string> = {}

    let missed = false

    for (let index = 0; index < max; index++) {
        const routeSegment = routeSegments[index]
        const locationSegment = locSegments[index]

        let isSplat = routeSegment === '*'
        if (isSplat) {
            // Hit a splat, just grab the rest, and return a match
            // uri:   /files/documents/work
            // route: /files/*
            params['*'] = locSegments.slice(index).map(decodeURIComponent).join('/')
            break
        }

        if (locationSegment === undefined) {
            // URI is shorter than the route, no match
            // uri:   /users
            // route: /users/:userId
            missed = true
            break
        }

        const paramMatch = regParam.exec(routeSegment)

        if (paramMatch && !isRoot) {
            let value = decodeURIComponent(locationSegment)
            params[paramMatch[1]] = value
        } else if (routeSegment !== locationSegment) {
            // Current segments don't match, not dynamic, not splat, so no match
            // uri:   /users/123/settings
            // route: /users/:id/profile
            missed = true
            break
        }
    }

    if (missed) {
        return null
    }

    return params
}
