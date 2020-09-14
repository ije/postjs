import { isValidElementType } from 'react-is'
import hotEmitter from 'webpack/hot/emitter'
import { fetchPage } from './page'
import { route } from './router'
import { PageTransition } from './transition'
import { utils } from './utils'

let redirectMark: string | null = null

export async function redirect(href: string, replace?: boolean, transition?: PageTransition | string) {
    // only in browser
    if (!process['browser']) {
        return Promise.reject(new Error('can\'t redirect on server'))
    }

    if (/^https?:\/\//i.test(href)) {
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
        __POST_I18N: i18n = {},
        __POST_PAGES: pages = {}
    } = window as any

    const url = route(
        app.config?.baseUrl || '/',
        Object.keys(buildManifest.pages),
        {
            fallback: '/_404',
            location: { pathname: href },
            defaultLocale: app.config?.defaultLocale || 'en',
            locales: (buildManifest.locales || []).map(({ code }) => code)
        }
    )

    if (!(url.locale in i18n)) {
        const i = (buildManifest.locales || []).find(({ code }) => code === url.locale)
        if (i) {
            await loadI18n(i.code, i.hash)
        }
    }

    if (url.pagePath === '/_404' && !(url.pagePath in (buildManifest.pages || {}))) {
        if (replace) {
            history.replaceState({ transition }, '', url.asPath)
        } else {
            history.pushState({ transition }, '', url.asPath)
        }
        hotEmitter.emit('popstate', { type: 'popstate', resetScroll: true, state: { transition } })
        return
    }

    if (url.pagePath in pages) {
        const page = pages[url.pagePath]
        if (utils.isObject(page) && page.path === url.pagePath && isValidElementType(page.Component)) {
            if (replace) {
                history.replaceState({ transition }, '', url.asPath)
            } else {
                history.pushState({ transition }, '', url.asPath)
            }
            hotEmitter.emit('popstate', { type: 'popstate', resetScroll: true, state: { transition } })
            if (redirectMark !== null) {
                redirectMark = null
            }
            return
        }
        delete pages[url.pagePath]
    }

    redirectMark = url.asPath
    return fetchPage(url).then(() => {
        if (redirectMark !== null) {
            if (replace) {
                history.replaceState({ transition }, '', redirectMark)
            } else {
                history.pushState({ transition }, '', redirectMark)
            }
            hotEmitter.emit('popstate', { type: 'popstate', resetScroll: true, state: { transition } })
            redirectMark = null
        }
    })
}

export async function loadI18n(code: string, hash?: string) {
    return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = `/_post/i18n/${code}.js?v=${hash || Date.now()}`
        script.async = false
        script.onload = () => {
            resolve()
        }
        script.onerror = err => {
            reject(err)
        }
        document.head.appendChild(script)
    })
}
