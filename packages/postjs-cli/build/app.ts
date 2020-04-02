import fs from 'fs-extra'
import path from 'path'
import utils from '../shared/utils'

export interface AppConfig {
    readonly rootDir: string
    readonly srcDir: string
    readonly lang: string
    readonly baseUrl: string
    readonly browserslist?: any
    readonly polyfillsMode?: 'usage' | 'entry'
    readonly polyfills?: string[]
}

export function loadAppConfig(appDir: string) {
    const appConfig: AppConfig = {
        rootDir: path.resolve(appDir),
        srcDir: '/',
        lang: 'en',
        baseUrl: '/'
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
        lang,
        baseUrl,
        srcDir,
        browserslist,
        polyfillsMode,
        polyfills
    } = settings
    if (/^[a-z]{2}(\-[a-z0-9]+)?$/i.test(lang)) {
        Object.assign(appConfig, { lang })
    }
    if (utils.isNEString(baseUrl)) {
        Object.assign(appConfig, { baseUrl: utils.cleanPath(encodeURI(baseUrl)) })
    }
    if (utils.isNEString(srcDir)) {
        Object.assign(appConfig, { srcDir: utils.cleanPath(srcDir) })
    }
    if (utils.isNEString(browserslist) || utils.isObject(browserslist) || utils.isArray(browserslist)) {
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
export function craeteAppEntry({ baseUrl, polyfillsMode = 'usage', polyfills = ['core-js/stable', 'whatwg-fetch'] }: AppConfig) {
    return (`
        import React from 'react'
        import ReactDom from 'react-dom'
        import { App } from '@postjs/core'

        // ployfills
        ${polyfillsMode === 'entry' ? polyfills.map(name => `import ${JSON.stringify(name)}`).join('\n') : ''}
        ${polyfillsMode === 'entry' ? "import 'regenerator-runtime/runtime'" : "import 'whatwg-fetch'"}

        window.addEventListener('load', () => {
            const { __POST_INITIAL_PAGE: initialPage, __POST_SSR_DATA: ssrData } = window
            document.head.querySelectorAll('[data-jsx]').forEach(el => {
                 document.head.removeChild(el)
            })
            if (initialPage && ssrData) {
                const { reqComponent } = initialPage
                const { url, staticProps } = ssrData
                ssrData[url.pagePath] = { staticProps }
                ReactDom.hydrate((
                    <App baseUrl="${baseUrl}" initialPage={{ url, staticProps, Component: reqComponent() }} />
                ), document.querySelector('main'))
                if (process.env.NODE_ENV === 'development') {
                    console.log("[postjs] page '" + url.pagePath + "' hydrated.")
                }
            }
        }, false)
    `)
}
