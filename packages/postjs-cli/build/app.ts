import fs from 'fs-extra'
import path from 'path'
import utils from '../shared/utils'

export const pageComponentStaticMethods = [
    'getStaticProps',
    'getStaticPaths'
]

interface AppConfig {
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
