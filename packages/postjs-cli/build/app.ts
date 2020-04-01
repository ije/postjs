import fs from 'fs-extra'
import path from 'path'
import utils from '../shared/utils'

// app.js
export const appEntry = (baseUrl: string) => `
    import React from 'react'
    import ReactDom from 'react-dom'
    import { App } from '@postjs/core'

    window.addEventListener('load', () => {
        const { __POST_INITIAL_PAGE, __POST_SSR_DATA } = window
        if (__POST_INITIAL_PAGE && __POST_SSR_DATA) {
            const { reqComponent } = __POST_INITIAL_PAGE
            const { url, staticProps } = __POST_SSR_DATA
            __POST_SSR_DATA[url.pagePath] = { staticProps }
            ReactDom.hydrate((
                <App baseUrl="${baseUrl}" initialPage={{ url, staticProps, Component: reqComponent() }} />
            ), document.querySelector('main'))
            console.log(\`page '\${url.pagePath}' hydrated.\`)
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
