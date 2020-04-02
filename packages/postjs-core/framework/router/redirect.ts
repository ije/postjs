import { CSSProperties } from 'react'
import hotEmitter from 'webpack/hot/emitter'
import utils from '../utils'
import { fetchPage } from './fetch'

const {
    __POST_PAGES: pages = {},
    __POST_BUILD_MANIFEST: buildManifest = {}
} = window as any
let redirectMark: { pagePath: string, asPath?: string } | null = null

export type Transition = {
    enterStyle: CSSProperties
    enterActiveStyle: CSSProperties
    exitStyle: CSSProperties
    exitActiveStyle: CSSProperties
    duration: number | { enter: number, exit: number }
    timing?: string | { enter: string, exit: string }
}

export function fade(duration: number, timing?: string): Transition {
    const enterCommonStyle: CSSProperties = { position: 'relative', top: 0, zIndex: 2 }
    const exitCommonStyle: CSSProperties = { position: 'absolute', top: 0, zIndex: 1 }
    return {
        enterStyle: { ...enterCommonStyle, opacity: 0 },
        enterActiveStyle: { ...enterCommonStyle, opacity: 1 },
        exitStyle: { ...exitCommonStyle, opacity: 1 },
        exitActiveStyle: { ...exitCommonStyle, opacity: 0 },
        duration: Math.max(duration, 40),
        timing
    }
}

export function slide(direction: 'ltr' | 'rtl' | 'ttb' | 'btt', duration: number, timing?: string): Transition {
    return {
        enterStyle: {},
        enterActiveStyle: {},
        exitStyle: {},
        exitActiveStyle: {},
        duration,
        timing
    }
}

export async function redirect(pagePath: string, asPath?: string, replace?: boolean, transition?: Transition) {
    const buildInfo = buildManifest.pages[pagePath]

    if (buildInfo === undefined) {
        if (pagePath in pages) {
            delete pages[pagePath]
        }
        if (replace) {
            history.replaceState({ transition }, '', asPath || pagePath)
        } else {
            history.pushState({ transition }, '', asPath || pagePath)
        }
        hotEmitter.emit('popstate', { type: 'popstate', state: { transition } })
        return
    }

    if (pagePath in pages) {
        const page = pages[pagePath]
        if (utils.isObject(page)) {
            if (page.fetching === true) {
                redirectMark = { pagePath, asPath }
            } else if (page.path === pagePath && utils.isFunction(page.reqComponent)) {
                if (redirectMark !== null) {
                    redirectMark = null
                }
                if (replace) {
                    history.replaceState({ transition }, '', asPath || pagePath)
                } else {
                    history.pushState({ transition }, '', asPath || pagePath)
                }
                hotEmitter.emit('popstate', { type: 'popstate', state: { transition } })
            } else {
                delete pages[pagePath]
            }
        } else {
            delete pages[pagePath]
        }
    } else {
        pages[pagePath] = { fetching: true }
        redirectMark = { pagePath, asPath }
        return fetchPage(pagePath).then(() => {
            if (redirectMark !== null && redirectMark.pagePath === pagePath) {
                const path = redirectMark.asPath || redirectMark.pagePath
                if (replace) {
                    history.replaceState({ transition }, '', path)
                } else {
                    history.pushState({ transition }, '', path)
                }
                hotEmitter.emit('popstate', { type: 'popstate', state: { transition } })
            }
        }).catch(() => {
            delete pages[pagePath]
        })
    }
}
