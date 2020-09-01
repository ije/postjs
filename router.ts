import React from 'react'
import util from './util.ts'

export interface RouterURL {
    locale: string
    asPath: string
    pagePath: string
    params: Record<string, string>
    query: Record<string, string | string[]>
}

export interface ILocation {
    pathname: string
    search?: string
}

export const RouterContext = React.createContext<RouterURL>({
    pagePath: '/',
    asPath: '/',
    params: {},
    query: {},
    locale: ''
})
RouterContext.displayName = 'RouterContext'

export function withRouter(Component: React.ComponentType<{ url: RouterURL }>) {
    function WithRouter() {
        const url = useRouter()
        return React.createElement(Component, { url })
    }
    return WithRouter
}

export function useRouter() {
    return React.useContext(RouterContext)
}

export function route(base: string, pagePaths: string[], options?: { location?: ILocation, fallback?: string, defaultLocale?: string, locales?: string[] }): RouterURL {
    const { pathname, search }: ILocation = (options?.location || (window as any).location || { pathname: '/' })
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

    let locale = options?.defaultLocale || 'en'
    let asPath = util.cleanPath(util.trimPrefix(pathname, base))
    let pagePath = ''
    let params: Record<string, string> = {}

    const a = asPath.slice(1).split('/')
    if (options?.locales?.includes(a[0])) {
        locale = a[0]
        asPath = '/' + a.slice(1).join('/')
    }

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

    return { locale, asPath, pagePath, params, query }
}

function matchPath(routePath: string, locPath: string): [Record<string, string>, boolean] {
    const routeSegments = util.splitPath(routePath)
    const locSegments = util.splitPath(locPath)
    const depth = Math.max(routeSegments.length, locSegments.length)
    const params: Record<string, string> = {}

    for (let i = 0; i < depth; i++) {
        const routeSeg = routeSegments[i]
        const locSeg = locSegments[i]

        if (locSeg === undefined || routeSeg === undefined) {
            return [{}, false]
        }

        if (routeSeg.startsWith('$') && routeSeg.length > 1) {
            params[routeSeg.slice(1)] = decodeURIComponent(locSeg)
        } else if (routeSeg.startsWith('~') && routeSeg.length > 1 && i === routeSegments.length - 1) {
            params[routeSeg.slice(1)] = locSegments.slice(i).map(decodeURIComponent).join('/')
            break
        } else if (routeSeg !== locSeg) {
            return [{}, false]
        }
    }

    return [params, true]
}
