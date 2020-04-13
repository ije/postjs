import { isServer, utils } from './utils'

export async function fetchPage(pagePath: string) {
    // only in browser
    if (isServer()) {
        return Promise.reject(new Error(`can't fetch page '${pagePath}' on server`))
    }

    const {
        __POST_PAGES: pages = {},
        __POST_BUILD_MANIFEST: buildManifest,
        __post_loadScriptBaseUrl: loadScriptBaseUrl = ''
    } = window as any

    if (buildManifest === undefined) {
        return Promise.reject(new Error('build-manifest not ready'))
    }

    const buildInfo = (buildManifest.pages || {})[pagePath]
    if (buildInfo === undefined) {
        if (pagePath in pages) {
            delete pages[pagePath]
        }
        return Promise.reject(new Error(`page '${pagePath}' not found`))
    }

    const page = pages[pagePath]
    if (utils.isObject(page)) {
        if (page.fetching === true) {
            return new Promise<void>((resolve, reject) => {
                const interval = setInterval(check, 50)
                const timeout = setTimeout(() => {
                    clearInterval(interval)
                    reject(new Error('timeout'))
                }, 6000)
                function check() {
                    const page = pages[pagePath]
                    if (isValidPage(page, pagePath)) {
                        clearInterval(interval)
                        clearTimeout(timeout)
                        resolve()
                    }
                }
            })
        } else if (isValidPage(page, pagePath)) {
            return Promise.resolve()
        }
    }

    pages[pagePath] = { fetching: true }
    return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = `${loadScriptBaseUrl}_post/pages/${buildInfo.name}.js?v=${buildInfo.hash}`
        script.async = false
        script.onload = () => {
            const page = pages[pagePath]
            if (isValidPage(page, pagePath)) {
                const pc = page.reqComponent()
                if (pc.hasGetStaticPropsMethod === true) {
                    fetch(`${loadScriptBaseUrl}_post/pages/${buildInfo.name}.json?v=${buildInfo.hash}`).then(resp => resp.json()).then(data => {
                        (window['__POST_SSR_DATA'] = window['__POST_SSR_DATA'] || {})[pagePath] = data
                        resolve()
                    }).catch(() => {
                        delete pages[pagePath]
                        reject(new Error('load page data failed'))
                    })
                } else {
                    resolve()
                }
            } else {
                delete pages[pagePath]
                reject(new Error('bad page'))
            }
        }
        script.onerror = err => {
            delete pages[pagePath]
            reject(err)
        }
        document.head.appendChild(script)
    })
}

function isValidPage(page: any, pagePath: string) {
    return utils.isObject(page) && page.path === pagePath && utils.isFunction(page.reqComponent)
}
