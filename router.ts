// @deno-types="./@types/react/index.d.ts"
import React from 'https://dev.jspm.io/react'

export interface URI {
    pagePath: string
    asPath: string
    params: Record<string, string>
    query: Record<string, string | Array<string>>
}

export class RouterState {
    readonly pagePath: string
    readonly asPath: string
    readonly params: Record<string, string>
    readonly query: Record<string, string | Array<string>>

    constructor({ pagePath, asPath, params, query }: URI) {
        this.pagePath = pagePath
        this.asPath = asPath
        this.params = params
        this.query = query
    }

    push(href: string) {
        const { __post_router_events } = window as any
        __post_router_events.emit('push', href)
    }

    replace(href: string) {
        const { __post_router_events } = window as any
        __post_router_events.emit('replace', href)
    }
}

export const RouterContext = React.createContext(new RouterState({ pagePath: '/', asPath: '/', params: {}, query: {} }))
RouterContext.displayName = 'RouterContext'

export function useRouter() {
    return React.useContext(RouterContext)
}
