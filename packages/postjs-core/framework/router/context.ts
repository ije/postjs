import { ParsedUrlQuery } from 'querystring'
import { createContext, useContext } from 'react'
import { redirect } from './redirect'

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

    push(pagePath: string, asPath?: string) {
        redirect(pagePath, asPath)
    }

    replace(pagePath: string, asPath?: string) {
        redirect(pagePath, asPath, true)
    }
}

export const RouterContext = createContext(new RouterStore({ pagePath: '/', asPath: '/', params: {}, query: {} }))

export function useRouter() {
    return useContext(RouterContext)
}
