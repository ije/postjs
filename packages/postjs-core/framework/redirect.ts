import hotEmitter from 'webpack/hot/emitter'
import { fetchPage } from './page'
import { route } from './router'
import { PageTransition } from './transition'
import { isServer, utils } from './utils'

let redirectMark: string | null = null

export async function redirect(href: string, replace?: boolean, transition?: PageTransition | string) {
    // only in browser
    if (isServer()) {
        return Promise.reject(new Error('can\'t redirect on server'))
    }

    if (/^(https?|file):/.test(href)) {
        location.href = href
        return
    }

    href = utils.cleanPath(href)
    if (location.protocol === 'file:') {
        const dataEl = document.getElementById('ssr-data')
        if (dataEl) {
            const ssrData = JSON.parse(dataEl.innerHTML)
            if (ssrData && 'url' in ssrData) {
                const { url: { pagePath: initialPagePath } } = ssrData
                location.href = location.href.replace(
                    '/' + (initialPagePath.replace(/^\/+/, '') || 'index') + '.html',
                    '/' + (href.replace(/^\/+/, '') || 'index') + '.html'
                )
            }
        }
        return
    }

    const {
        __POST_APP: app = {},
        __POST_BUILD_MANIFEST: buildManifest = {},
        __POST_PAGES: pages = {}
    } = window as any

    const { pagePath } = route(app.config?.baseUrl || '/', Object.keys(buildManifest.pages), { fallback: '/_404', location: { pathname: href } })
    if (pagePath === '/_404' && !(pagePath in (buildManifest.pages || {}))) {
        if (replace) {
            history.replaceState({ transition }, '', href)
        } else {
            history.pushState({ transition }, '', href)
        }
        hotEmitter.emit('popstate', { type: 'popstate', state: { transition } })
        return
    }

    if (pagePath in pages) {
        const page = pages[pagePath]
        if (utils.isObject(page) && page.path === pagePath && utils.isFunction(page.reqComponent)) {
            if (replace) {
                history.replaceState({ transition }, '', href)
            } else {
                history.pushState({ transition }, '', href)
            }
            hotEmitter.emit('popstate', { type: 'popstate', state: { transition } })
            if (redirectMark !== null) {
                redirectMark = null
            }
            return
        }
        delete pages[pagePath]
    }

    redirectMark = href
    return fetchPage(pagePath).then(() => {
        if (redirectMark !== null) {
            if (replace) {
                history.replaceState({ transition }, '', redirectMark)
            } else {
                history.pushState({ transition }, '', redirectMark)
            }
            hotEmitter.emit('popstate', { type: 'popstate', state: { transition } })
            redirectMark = null
        }
    })
}
