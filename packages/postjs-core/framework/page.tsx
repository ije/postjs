import { isValidElementType } from 'react-is'
import { URL } from './router'
import { utils } from './utils'

export async function fetchPage({ pagePath, asPath }: URL) {
    // only in browser
    if (!process['browser']) {
        return Promise.reject(new Error(`can't fetch page '${pagePath}' on server`))
    }

    const {
        __POST_PAGES: pages = {},
        __POST_BUILD_MANIFEST: buildManifest
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
            return fetchPageData(page, asPath, buildInfo.hash)
        }
    }

    pages[pagePath] = { fetching: true }
    return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = `/_post/pages/${buildInfo.name}.js?v=${buildInfo.hash}`
        script.async = false
        script.onload = () => {
            const page = pages[pagePath]
            if (isValidPage(page, pagePath)) {
                fetchPageData(page, asPath, buildInfo.hash).then(resolve).catch(reject)
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

async function fetchPageData(page: any, asPath: string, hash: string): Promise<void> {
    const {
        __POST_SSR_DATA: ssrData = {}
    } = window as any

    if (page.Component.hasGetStaticPropsMethod === true) {
        try {
            const asName = asPath.replace(/^\/+/, '') || 'index'
            const data = await fetch(`/_post/pages/${asName}.json?v=${hash}`).then(resp => resp.json())
            ssrData[asPath] = data
        } catch (error) {
            return Promise.reject(new Error('load page data failed'))
        }
    }
}

function isValidPage(page: any, pagePath: string) {
    return utils.isObject(page) && page.path === pagePath && isValidElementType(page.Component)
}

