import utils from '../utils'

export async function fetchPage(pagePath: string) {
    const {
        __POST_PAGES: pages = {},
        __POST_BUILD_MANIFEST: buildManifest = {}
    } = window as any
    const buildInfo = buildManifest.pages[pagePath]
    if (buildInfo === undefined) {
        if (pagePath in pages) {
            delete pages[pagePath]
        }
        return
    }

    const page = pages[pagePath]
    if (utils.isObject(page) && (page.fetching === true || page.path === pagePath)) {
        return
    }

    pages[pagePath] = { fetching: true }
    return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = `_post/pages/${buildInfo.name}.js?v=${buildInfo.hash}`
        script.async = false
        script.onload = () => {
            const page = pages[pagePath]
            if (page.path === pagePath && utils.isFunction(page.reqComponent)) {
                const pc = page.reqComponent()
                if (pc.hasGetStaticPropsMethod === true) {
                    fetch(`_post/pages/${buildInfo.name}.json?v=${buildInfo.hash}`).then(resp => resp.json()).then(data => {
                        (window['__POST_SSR_DATA'] = window['__POST_SSR_DATA'] || {})[pagePath] = data
                        resolve()
                    }).catch(err => {
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
        // script['onreadystatechange'] = () => {
        //     const { readyState } = script as any
        //     if (!done && readyState === 'loaded' || readyState === 'complete') {
        //         done = true
        //         resolve()
        //     }
        // }
        script.onerror = err => {
            delete pages[pagePath]
            reject(err)
        }
        document.head.appendChild(script)
    })
}
