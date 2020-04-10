import hotEmitter from 'webpack/hot/emitter'
import { fetchPage } from './page'
import { PageTransition } from './transition'
import { isServer, utils } from './utils'

let redirectMark: { pagePath: string, asPath?: string } | null = null

export async function redirect(pagePath: string, asPath?: string, replace?: boolean, transition?: PageTransition | string) {
    // only in browser
    if (isServer()) {
        return
    }

    const {
        __POST_PAGES: pages,
        __POST_BUILD_MANIFEST: buildManifest
    } = window as any
    const pathname = asPath || pagePath

    if (location.protocol === 'file:') {
        const dataEl = document.getElementById('ssr-data')
        if (dataEl) {
            const ssrData = JSON.parse(dataEl.innerHTML)
            if (ssrData && 'url' in ssrData) {
                const { url: { pagePath: initialPagePath } } = ssrData
                location.href = location.href.replace(
                    '/' + (initialPagePath.replace(/^\/+/, '') || 'index') + '.html',
                    '/' + (pathname.replace(/^\/+/, '') || 'index') + '.html'
                )
            }
        }
        return
    }

    if (!utils.isObject(buildManifest) || !utils.isObject(pages)) {
        location.href = location.protocol + '//' + location.host + pathname
        return
    }

    const buildInfo = buildManifest.pages[pagePath]
    if (buildInfo === undefined) {
        if (pagePath in pages) {
            delete pages[pagePath]
        }
        if ('/_404' in buildManifest.pages) {
            asPath = asPath || pagePath
            pagePath = '/_404'
        } else {
            if (replace) {
                history.replaceState({ transition }, '', pathname)
            } else {
                history.pushState({ transition }, '', pathname)
            }
            hotEmitter.emit('popstate', { type: 'popstate', state: { transition } })
            return
        }
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
                    history.replaceState({ transition }, '', pathname)
                } else {
                    history.pushState({ transition }, '', pathname)
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
