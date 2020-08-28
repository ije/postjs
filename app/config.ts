import log from '../log.ts'
import { existsSync, path } from '../std.ts'
import util from '../util.ts'

export interface AppConfig {
    readonly rootDir: string
    readonly srcDir: string
    readonly outputDir: string
    readonly cacheDeps: boolean
    readonly baseUrl: string
    readonly defaultLocale: string
    readonly importMap: {
        imports: Record<string, string>
    }
}

export function loadAppConfigSync(appDir: string) {
    const config: AppConfig = {
        rootDir: path.resolve(appDir),
        srcDir: '/',
        outputDir: '/out',
        cacheDeps: true,
        baseUrl: '/',
        defaultLocale: 'en',
        importMap: {
            imports: {}
        }
    }

    const { POSTJS_IMPORT_MAP } = globalThis as any
    if (POSTJS_IMPORT_MAP) {
        try {
            const { imports } = POSTJS_IMPORT_MAP
            Object.assign(config.importMap, { imports: Object.assign({}, config.importMap.imports, imports) })
        } catch (err) {
            log.error('bad POSTJS_IMPORT_MAP: ', err)
        }
    }

    try {
        const mapFile = path.join(appDir, 'import_map.json')
        if (existsSync(mapFile)) {
            const { imports } = JSON.parse(Deno.readTextFileSync(mapFile))
            Object.assign(config.importMap, { imports: Object.assign({}, config.importMap.imports, imports) })
        }
    } catch (err) {
        log.error('bad import_map.json:', err)
    }

    try {
        const configFile = path.join(appDir, 'post.config.json')
        if (existsSync(configFile)) {
            const {
                srcDir,
                ouputDir,
                baseUrl,
                cacheDeps,
                lang
            } = JSON.parse(Deno.readTextFileSync(configFile))
            if (util.isNEString(srcDir)) {
                Object.assign(config, { srcDir: util.cleanPath(srcDir) })
            }
            if (util.isNEString(ouputDir)) {
                Object.assign(config, { ouputDir: util.cleanPath(ouputDir) })
            }
            if (util.isNEString(baseUrl)) {
                Object.assign(config, { baseUrl: util.cleanPath(encodeURI(baseUrl)) })
            }
            if (util.isNEString(lang)) {
                Object.assign(config, { defaultLocale: lang })
            }
            if (typeof cacheDeps === 'boolean') {
                Object.assign(config, { cacheDeps })
            }
        }
    } catch (err) {
        log.error('bad app config: ', err)
    }

    return config
}
