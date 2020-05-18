import React from 'https://cdn.pika.dev/react'
import { events } from './app.ts'
import util from './util.ts'

export interface URI {
    pagePath: string
    asPath: string
    params: Record<string, string>
    query: Record<string, string | string[]>
}

export class RouterState {
    readonly current: URI
    readonly prev?: URI
    readonly sideEffect?: any

    constructor(current: URI, prev?: URI, sideEffect?: any) {
        this.current = current
        this.prev = prev
        this.sideEffect = sideEffect
    }

    get pagePath() {
        return this.current.pagePath
    }

    get asPath() {
        return this.current.asPath
    }

    get params() {
        return this.current.params
    }

    get query() {
        return this.current.query
    }

    push(href: string) {
        const { history } = window as any
        if (history) {
            history.push(null, '', href)
        }
        events.emit('popstate')
    }

    replace(href: string) {
        const { history } = window as any
        if (history) {
            history.replace(null, '', href)
        }
        events.emit('popstate')
    }
}

export const RouterContext = React.createContext(new RouterState({ pagePath: '/', asPath: '/', params: {}, query: {} }))
RouterContext.displayName = 'RouterContext'

export function useRouter() {
    return React.useContext(RouterContext)
}

interface Location {
    pathname: string
    search?: string
}

export function route(base: string, pagePaths: string[], options?: { location?: Location, fallback?: string }): URI {
    const loc: Location = (options?.location || (window as any).location)
    const q = new URLSearchParams(loc.search)

    let pagePath = ''
    let asPath = loc.pathname
    let params: Record<string, string> = {}
    let query = Array.from(q.keys()).reduce((query, key) => {
        const value = q.getAll(key)
        if (value.length === 1) {
            query[key] = value[0]
        } else if (value.length > 1) {
            query[key] = value
        }
        return query
    }, {} as Record<string, string | string[]>)

    if (/^\/.+/.test(base)) {
        asPath = util.trimPrefix(asPath, base)
        if (asPath === '' || asPath.charAt(0) !== '/') {
            asPath = '/' + asPath
        }
    }

    // todo: sort pagePaths
    for (const routePath of pagePaths) {
        const [p, ok] = matchPath(routePath, asPath)
        if (ok) {
            pagePath = routePath
            params = p
            break
        }
    }

    if (pagePath === '' && options?.fallback) {
        pagePath = options?.fallback
    }

    return { pagePath, asPath, params, query }
}

function matchPath(routePath: string, locPath: string): [Record<string, string>, boolean] {
    const routeSegments = util.walkPath(routePath)
    const locSegments = util.walkPath(locPath)
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

        if (routeSeg.startsWith('$')) {
            params[routeSeg.slice(1)] = decodeURIComponent(locSeg)
        } else if (routeSeg !== locSeg) {
            ok = false
            break
        }
    }

    return [params, ok]
}
