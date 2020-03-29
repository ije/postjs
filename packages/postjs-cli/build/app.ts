import fs from 'fs-extra'
import path from 'path'
import utils from '../shared/utils'

export const pageComponentStaticMethods = [
    'getStaticProps',
    'getStaticPaths'
]

// app.jsx
export const appEntry = (baseUrl: string) => `
    import React, { useEffect, useState } from 'react'
    import ReactDom from 'react-dom'
    import { route, RouterContext, RouterStore, Head } from '@postjs/core'

    function Router({ initialPage }) {
        const [page, setPage] = useState(initialPage)

        useEffect(() => {
            const update = () => {
                const [url, Component] = route('${baseUrl}', window.__POST_PAGES || [])
                let staticProps = null
                if (Component !== null) {
                    const ssrData = window.__POST_SSR_DATA || {}
                    if (url.pagePath && url.pagePath in ssrData) {
                        staticProps = (ssrData[url.pagePath] ||{}).staticProps || null
                    }
                } else {
                    Component = Default404Page
                }
                setPage({ url, staticProps, Component })
            }
            window.addEventListener('popstate', update, false)
            return () => window.removeEventListener('popstate', update, false)
        }, [])

        return (
            <RouterContext.Provider value={new RouterStore(page.url)}>
                <page.Component {...(page.staticProps || {})} />
            </RouterContext.Provider>
        )
    }

    function Default404Page() {
        return (
            <p>
                <Head><title>404 - Page not found</title></Head>
                <strong><code>404</code></strong>
                <small>&nbsp;-&nbsp;</small>
                <span>Page not found</span>
            </p>
        )
    }

    window.addEventListener('load', async () => {
        const ssrData = window.__POST_SSR_DATA || {}
        if ('url' in ssrData) {
            const { url, staticProps } = ssrData
            const { pagePath } = url
            const pageName = pagePath.replace(/^\\/+/, '') || 'index'
            const { default: Component } = await import(/* webpackMode: "weak" */ './pages/' + pageName)
            ssrData[pagePath] = staticProps
            ReactDom.hydrate((
                <Router initialPage={{ url, staticProps, Component }} />
            ), document.querySelector('main'))
            console.log('page ' + pageName + ' hydrated.')
        }
    }, false)
`

export interface AppConfig {
    lang: string
    baseUrl: string
}

export async function getAppConfig(appDir: string) {
    const appConfig: AppConfig = {
        lang: 'en',
        baseUrl: '/'
    }
    const configJson = path.join(appDir, 'post.config.json')
    if (!fs.existsSync(configJson)) {
        return appConfig
    }
    const settings = await fs.readJSON(configJson)

    if (/^[a-z]{2}(\-[a-z0-9]+)?$/i.test(settings.lang)) {
        appConfig.lang = settings.lang
    }
    if (utils.isNEString(settings['baseUrl'])) {
        appConfig.baseUrl = utils.cleanPath(encodeURI(settings['baseUrl']))
    }
    return appConfig
}
