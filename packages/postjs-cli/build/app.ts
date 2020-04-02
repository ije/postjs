import fs from 'fs-extra'
import path from 'path'
import utils from '../shared/utils'

export interface AppConfig {
    readonly root: string
    readonly lang: string
    readonly baseUrl: string
    readonly srcDir: string
    readonly babelPresetEnv?: {
        targets?: string | Record<string, any>
        useBuiltIns?: 'usage' | 'entry'
    }
}

export function loadAppConfig(appDir: string) {
    const appConfig: AppConfig = {
        root: path.resolve(appDir),
        lang: 'en',
        baseUrl: '/',
        srcDir: '/'
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

    if (/^[a-z]{2}(\-[a-z0-9]+)?$/i.test(settings.lang)) {
        Object.assign(appConfig, { lang: settings.lang })
    }
    if (utils.isNEString(settings['baseUrl'])) {
        Object.assign(appConfig, { baseUrl: utils.cleanPath(encodeURI(settings['baseUrl'])) })
    }
    if (utils.isNEString(settings['srcDir'])) {
        Object.assign(appConfig, { srcDir: utils.cleanPath(settings['srcDir']) })
    }
    return appConfig
}

// app.js
export function craeteAppEntry({ baseUrl, babelPresetEnv }: AppConfig) {
    const { useBuiltIns = 'usage' } = babelPresetEnv || {}

    return (`
        import React from 'react'
        import ReactDom from 'react-dom'
        import { App } from '@postjs/core'

        // ployfills
        // useBuiltIns: ${useBuiltIns}
        ${useBuiltIns !== 'entry' ? '// ' : ''}import 'core-js/stable'
        ${useBuiltIns !== 'entry' ? '// ' : ''}import 'regenerator-runtime/runtime'
        import 'whatwg-fetch'
        import assign from 'object-assign'
        Object.assign = Object.assign || assign

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
                    <App baseUrl="${ baseUrl}" initialPage={{ url, staticProps, Component: reqComponent() }} />
                ), document.querySelector('main'))
                if (process.env.NODE_ENV === 'development') {
                    console.log("[postjs] page '" + url.pagePath + "' hydrated.")
                }
            }
        }, false)
    `)
}
