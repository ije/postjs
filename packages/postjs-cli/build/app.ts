import fs from 'fs-extra'
import path from 'path'
import postcss from 'postcss'
import utils from '../shared/utils'

export interface AppConfig {
    readonly rootDir: string
    readonly srcDir: string
    readonly baseUrl: string
    readonly lang: string
    readonly browserslist?: string | string[] | Record<string, any>
    readonly polyfillsMode?: 'usage' | 'entry'
    readonly polyfills?: string[]
    readonly postcss?: {
        plugins?: postcss.AcceptedPlugin[]
    }
}

export function loadAppConfig(appDir: string) {
    const appConfig: AppConfig = {
        rootDir: path.resolve(appDir),
        srcDir: '/',
        baseUrl: '/',
        lang: 'en'
    }
    let settings: any = {}

    try {
        const configJson = path.join(appDir, 'post.config.json')
        if (!fs.existsSync(configJson)) {
            return appConfig
        }
        settings = fs.readJSONSync(configJson)
    } catch (err) {
        console.log('bad app config: ', err)
    }

    const {
        srcDir,
        baseUrl,
        lang,
        browserslist,
        polyfillsMode,
        polyfills
    } = settings
    if (utils.isNEString(srcDir)) {
        Object.assign(appConfig, { srcDir: utils.cleanPath(srcDir) })
    }
    if (utils.isNEString(baseUrl)) {
        Object.assign(appConfig, { baseUrl: utils.cleanPath(encodeURI(baseUrl)) })
    }
    if (/^[a-z]{2}(\-[a-z0-9]+)?$/i.test(lang)) {
        Object.assign(appConfig, { lang })
    }
    if (utils.isNEString(browserslist) || utils.isNEArray(browserslist) || utils.isObject(browserslist)) {
        Object.assign(appConfig, { browserslist })
    }
    if (/^usage|entry$/.test(polyfillsMode)) {
        Object.assign(appConfig, { polyfillsMode })
    }
    if (utils.isNEArray(polyfills)) {
        Object.assign(appConfig, { polyfills: polyfills.filter(utils.isNEString) })
    }
    return appConfig
}

// app.js
export const craeteAppEntry = ({ baseUrl, polyfillsMode = 'usage', polyfills = ['core-js/stable', 'whatwg-fetch'] }: AppConfig) => `
    import React from 'react'
    import ReactDom from 'react-dom'
    import { AppRouter } from '@postjs/core'

    // ployfills
    ${polyfillsMode === 'entry' ? polyfills.map(name => `import ${JSON.stringify(name)}`).join('\n') : ''}
    ${polyfillsMode === 'entry' ? "import 'regenerator-runtime/runtime'" : "import 'whatwg-fetch'"}

    window.addEventListener('load', () => {
        const { __POST_APP: App = React.Fragment, __POST_INITIAL_PAGE: initialPage } = window
        const ssrData = JSON.parse(document.getElementById('ssr-data').innerHTML)
        if (initialPage && ssrData && 'url' in ssrData) {
            const { reqComponent } = initialPage
            const { url, staticProps, appStaticProps = {} } = ssrData

            // delete ssr head elements
            let toDelHeadEl = document.head.querySelector('meta[charSet]')?.nextElementSibling
            let toDelHeadEls = []
            while (toDelHeadEl) {
                if (toDelHeadEl.tagName.toLowerCase() === 'meta' && toDelHeadEl.getAttribute('name') === 'post-head-end') {
                    toDelHeadEl = null
                } else {
                    toDelHeadEls.push(toDelHeadEl)
                    toDelHeadEl = toDelHeadEl.nextElementSibling
                }
            }
            toDelHeadEls.forEach(el => document.head.removeChild(el))
            toDelHeadEls = null

            // store current ssr data
            window.__POST_SSR_DATA = { [url.pagePath]: { staticProps } }

            // hydrate app
            ReactDom.hydrate((
                <AppRouter
                    baseUrl="${baseUrl}"
                    initialPage={{ url, staticProps, Component: reqComponent() }}
                    initialApp={{ App, staticProps: appStaticProps }}
                />
            ), document.querySelector('main'))
            if (process.env.NODE_ENV === 'development') {
                console.log("[postjs] page '" + url.pagePath + "' hydrated.")
            }
        }
    })
`
