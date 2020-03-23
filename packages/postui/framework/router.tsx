import React, { createContext, PropsWithChildren, useState, useContext, useEffect, useMemo } from 'react'
import { ParsedUrlQuery } from 'querystring'
import utils from '../shared/utils'

export interface URL {
    routePath: string
    pathname: string
    params: Record<string, string>
    query: ParsedUrlQuery
}

export interface Route {
    path: string
    component: React.ComponentType
    isExact?: boolean
}

export class Router {
    routePath: string
    pathname: string
    params: Record<string, string>
    query: ParsedUrlQuery

    constructor(url?: URL) {
        this.routePath = url?.routePath || '/'
        this.pathname = url?.pathname || '/'
        this.params = Object.assign({}, url?.params)
        this.query = Object.assign({}, url?.query)
    }

    get url(): URL {
        return {
            routePath: this.routePath,
            pathname: this.pathname,
            params: this.params,
            query: this.query
        }
    }

    push(url: string, as?: string) {

    }

    replace(url: string, as?: string) {

    }
}

export const RouterContext = createContext<Router>(new Router())

export function useRouter(): Router {
    return useContext(RouterContext)
}

interface RouterComponentProps {
    base: string
    routes: Route[]
}

export default ({
    base: propBase,
    routes,
    children
}: PropsWithChildren<RouterComponentProps>) => {
    const base = useMemo(() => utils.cleanPath(base), [propBase])
    const [router, setRouter] = useState(new Router())

    useEffect(() => {
        const updateRouter = () => setRouter(new Router())
        globalThis.addEventListener('popstate', updateRouter, false)
        return () => globalThis.removeEventListener('popstate', updateRouter, false)
    }, [])

    return (
        <RouterContext.Provider value={router}>
            {children}
        </RouterContext.Provider>
    )
}
