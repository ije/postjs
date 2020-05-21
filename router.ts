import React from 'https://cdn.pika.dev/react'
import util from './util.ts'

export interface RouterURL {
    pagePath: string
    asPath: string
    params: Record<string, string>
    query: Record<string, string | string[]>
}

export const RouterContext = React.createContext<RouterURL>({ pagePath: '/', asPath: '/', params: {}, query: {} })
RouterContext.displayName = 'RouterContext'

export function useRouter() {
    return React.useContext(RouterContext)
}

export function withRouter(Component: React.ComponentType<{ router: RouterURL }>) {
    function WithRouter() {
        const router = useRouter()
        return React.createElement(Component, { router })
    }
    return WithRouter
}

export interface ILocation {
    pathname: string
    search?: string
}

export function route(base: string, pagePaths: string[], options?: { location?: ILocation, fallback?: string }): RouterURL {
    const { pathname, search }: ILocation = (options?.location || (window as any).location || { pathname: '/' })
    const asPath = util.cleanPath(util.trimPrefix(pathname, base))
    const query: Record<string, string | string[]> = {}

    if (search) {
        const segs = util.trimPrefix(search, '?').split('&')
        segs.forEach(seg => {
            const [key, value] = util.splitBy(seg, '=')
            if (key in query) {
                const prevValue = query[key]
                if (util.isArray(prevValue)) {
                    prevValue.push(value)
                } else {
                    query[key] = [prevValue, value]
                }
            } else {
                query[key] = value
            }
        })
    }

    let pagePath = ''
    let params: Record<string, string> = {}

    // todo: sort pagePaths to improve preformance
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
