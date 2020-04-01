import hotEmitter from 'webpack/hot/emitter'
import utils from '../utils'
import { fetchPage } from './fetch'

let redirectMark: { pagePath: string, asPath?: string } | null = null

export function redirect(pagePath: string, asPath?: string, replace?: boolean) {
    const { __POST_PAGES: postPages = {}, __POST_BUILD_MANIFEST: buildManifest = {} } = window as any
    const buildInfo = buildManifest.pages[pagePath]

    if (buildInfo === undefined) {
        if (pagePath in postPages) {
            delete postPages[pagePath]
        }
        if (replace) {
            history.replaceState(null, '', asPath || pagePath)
        } else {
            history.pushState(null, '', asPath || pagePath)
        }
        hotEmitter.emit('popstate')
        return
    }

    if (pagePath in postPages) {
        const page = postPages[pagePath]
        if (utils.isObject(page)) {
            if (page.fetching === true) {
                redirectMark = { pagePath, asPath }
            } else if (page.path === pagePath && utils.isFunction(page.reqComponent)) {
                if (redirectMark !== null) {
                    redirectMark = null
                }
                if (replace) {
                    history.replaceState(null, '', asPath || pagePath)
                } else {
                    history.pushState(null, '', asPath || pagePath)
                }
                hotEmitter.emit('popstate')
            } else {
                delete postPages[pagePath]
            }
        } else {
            delete postPages[pagePath]
        }
    } else {
        postPages[pagePath] = { fetching: true }
        redirectMark = { pagePath, asPath }
        fetchPage(pagePath).then(() => {
            if (redirectMark !== null && redirectMark.pagePath === pagePath) {
                const path = redirectMark.asPath || redirectMark.pagePath
                if (replace) {
                    history.replaceState(null, '', path)
                } else {
                    history.pushState(null, '', path)
                }
                hotEmitter.emit('popstate')
            }
        }).catch(err => {
            delete postPages[pagePath]
            alert(`can not load page '${pagePath}': ${err}`)
            location.reload()
        })
    }
}
