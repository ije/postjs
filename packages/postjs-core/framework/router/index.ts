import { ParsedUrlQuery } from 'querystring'
import { createContext, useContext } from 'react'
import { redirect } from './redirect'

export * from './fetch'
export * from './redirect'
export * from './route'

export interface URL {
    pagePath: string
    pathname: string
    params: Record<string, string>
    query: ParsedUrlQuery
}

export class RouterStore {
    private _url: URL

    constructor(url?: URL) {
        this._url = url || { pagePath: '/', pathname: '/', params: {}, query: {} }
    }

    get pagePath() {
        return this._url.pagePath
    }

    get pathname() {
        return this._url.pathname
    }

    get params() {
        return { ...this._url.params }
    }

    get query() {
        return { ...this._url.query }
    }

    push(pagePath: string, asPath?: string) {
        redirect(pagePath, asPath)
    }

    replace(pagePath: string, asPath?: string) {
        redirect(pagePath, asPath, true)
    }
}

export const RouterContext = createContext(new RouterStore())

export function useRouter() {
    return useContext(RouterContext)
}
