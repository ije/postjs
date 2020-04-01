import utils from '../utils'

export function prefetchPage(pagePath: string) {
    const { __POST_PAGES: postPages = {}, __POST_BUILD_MANIFEST: buildManifest = {} } = window as any
    const buildInfo = buildManifest.pages[pagePath]

    if (buildInfo === undefined) {
        if (pagePath in postPages) {
            delete postPages[pagePath]
        }
        return
    }

    const page = postPages[pagePath]
    if (page === undefined) {
        postPages[pagePath] = { fetching: true, autoRedirect: false }
        fetchPage(pagePath).catch(err => {
            delete postPages[pagePath]
        })
    } else if (!utils.isObject(page) || (page.fetching !== true && page.path !== pagePath)) {
        delete postPages[pagePath]
        prefetchPage(pagePath) // retry
    }
}

export async function fetchPage(pagePath: string) {
    const { __POST_PAGES: postPages = {}, __POST_BUILD_MANIFEST: buildManifest = {} } = window as any
    const buildInfo = buildManifest.pages[pagePath]
    if (buildInfo === undefined) {
        return Promise.reject(new Error(`page '${pagePath}' no found`))
    }

    return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = `_post/pages/${buildInfo.name}.js?v=${buildInfo.hash}`
        script.async = false
        script.onload = () => {
            const page = postPages[pagePath]
            if (page.path === pagePath && utils.isFunction(page.reqComponent)) {
                const pc = page.reqComponent()
                if (pc.hasGetStaticPropsMethod === true) {
                    fetch(`_post/data/${buildInfo.name}.json?v=${buildInfo.hash}`).then(resp => resp.json()).then(data => {
                        (window['__POST_SSR_DATA'] = window['__POST_SSR_DATA'] || {})[pagePath] = data
                        resolve()
                    }).catch(err => {
                        reject(new Error(`can't get page('${pagePath}') data: ${err}`))
                    })
                } else {
                    resolve()
                }
            } else {
                delete postPages[pagePath]
                reject(new Error(`invalid page '${pagePath}'`))
            }
        }
        // script['onreadystatechange'] = () => {
        //     const { readyState } = script as any
        //     if (!done && readyState === 'loaded' || readyState === 'complete') {
        //         done = true
        //         resolve()
        //     }
        // }
        script.onerror = err => {
            reject(err)
        }
        document.body.appendChild(script)
    })
}
