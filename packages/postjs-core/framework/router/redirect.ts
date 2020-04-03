import hotEmitter from 'webpack/hot/emitter'
import utils from '../utils'
import { fetchPage } from './fetch'
import { Transition } from './transition'

let redirectMark: { pagePath: string, asPath?: string } | null = null

export async function redirect(pagePath: string, asPath?: string, replace?: boolean, transition?: Transition) {
    const {
        __POST_INITIAL_PAGE: initialPage = {},
        __POST_PAGES: pages = {},
        __POST_BUILD_MANIFEST: buildManifest
    } = window as any

    if (location.protocol === 'file:') {
        location.href = location.href.replace(initialPage.path.replace(/^\/+/, '') || 'index', pagePath.replace(/^\/+/, '') || 'index')
        return
    }

    if (buildManifest === undefined) {
        location.href = location.protocol + '//' + location.host + (asPath || pagePath)
        return
    }

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
        })
    }
}
