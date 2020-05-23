import React from 'https://cdn.pika.dev/react'
import { APIHandle } from '../api.ts'
import { AppContext } from '../app.ts'
import { colors, existsSync, path, ServerRequest, Sha1, walk } from '../deps.ts'
import { renderToTags } from '../head.ts'
import { createHtml } from '../html.ts'
import log from '../log.ts'
import ReactDomServer from '../npm/react-dom/react-dom-server.js'
import { ILocation, route, RouterContext, RouterURL } from '../router.ts'
import { compile } from '../ts/compile.ts'
import util from '../util.ts'
import { apiRequest, apiResponse } from './api.ts'
import { AppConfig, loadAppConfig } from './config.ts'

const regHttp = /^https?:\/\//i
const regModuleExt = /\.(m?jsx?|tsx?)$/i

interface Module {
    sourceFile: string
    sourceHash: string
    sourceMap: string
    js: string
}

export class App {
    readonly config: AppConfig
    readonly mode: 'development' | 'production'

    private _apis: Map<string, APIHandle> = new Map()
    private _deps: Map<string, Module> = new Map()
    private _modules: Map<string, Module> = new Map()
    private _pageModules: Record<string, string> = {}
    private _customApp: { Component: React.ComponentType, staticProps: any } = { Component: React.Fragment, staticProps: null }

    constructor(appDir: string, mode: 'development' | 'production') {
        this.mode = mode
        this.config = loadAppConfig(appDir)
        this._init()
    }

    get isDev() {
        return this.mode === 'development'
    }

    get srcDir() {
        const { rootDir, srcDir } = this.config
        return path.join(rootDir, srcDir)
    }

    async getPageHtml(location: ILocation, locale?: string): Promise<[number, string]> {
        const { defaultLocale, baseUrl } = this.config
        const url = route(baseUrl, Object.keys(this._pageModules), { location, fallback: '/404' })
        const { code, head, body, ssrData } = await this._renderPage(url, locale || defaultLocale)
        const html = createHtml({
            lang: locale || defaultLocale,
            head: head.concat(`<meta name="postjs-head-size" content="${head.length}" />`),
            scripts: [
                { type: 'application/json', id: 'ssr-data', innerText: JSON.stringify(ssrData) },
                { src: path.join(baseUrl, 'main.js') + `?t=${performance.now()}`, type: 'module' },
            ],
            body
        })
        return [code, html]
    }

    async getPageStaticProps(location: ILocation, locale?: string): Promise<any> {
        const { defaultLocale, baseUrl } = this.config
        const url = route(baseUrl, Object.keys(this._pageModules), { location, fallback: '/404' })
        if (url.pagePath in this._pageModules) {
            const pageModule = this._modules.get(this._pageModules[url.pagePath])!
            const { default: Page, getStaticProps } = await import(path.join(this.srcDir, pageModule.sourceFile))
            if (util.isFunction(Page)) {
                const gsp = [Page.getStaticProps, getStaticProps].filter(util.isFunction)[0]
                const staticProps = gsp ? await gsp(url, locale || defaultLocale) : null
                return util.isObject(staticProps) ? staticProps : null
            }
        }
        return null
    }

    getModule(filename: string): Module | null {
        filename = '/' + util.trimPrefix(util.trimPrefix(filename, this.config.baseUrl), '/')
        if (filename.startsWith('/-/')) {
            filename = util.trimPrefix(filename, '/-/')
            if (this._deps.has(filename)) {
                return this._deps.get(filename)!
            }
        } else {
            filename = '.' + filename
            if (this._modules.has(filename)) {
                return this._modules.get(filename)!
            }
        }
        return null
    }

    callAPI(req: ServerRequest, location: ILocation) {
        const { pagePath, params, query } = route(
            this.config.baseUrl,
            Array.from(this._apis.keys()).map(p => path.join('/api/', p)),
            { location }
        )
        if (pagePath) {
            const handle = this._apis.get(util.trimPrefix(pagePath, '/api'))!
            handle(new apiRequest(req, params, query), new apiResponse(req))
            return
        }

        req.respond({
            status: 404,
            headers: new Headers({
                'Content-Type': 'application/json'
            }),
            body: JSON.stringify({
                error: {
                    status: 404,
                    message: 'page not found'
                }
            })
        })
    }

    private async _init() {
        const walkOptions = { includeDirs: false, exts: ['.js', '.jsx', '.mjs', '.ts', '.tsx'], skip: [/\.d\.ts$/i] }
        const w1 = walk(path.join(this.srcDir), { ...walkOptions, maxDepth: 1 })
        const w2 = walk(path.join(this.srcDir, 'pages'), walkOptions)
        const w3 = walk(path.join(this.srcDir, 'api'), walkOptions)

        for await (const { path: fp } of w1) {
            const name = path.basename(fp)
            if (name.split('.')[0] === 'app') {
                const { default: Component, getStaticProps } = await import(fp)
                if (Component && util.isFunction(Component)) {
                    const gsp = [Component.getStaticProps, getStaticProps].filter(util.isFunction)[0]
                    if (gsp) {
                        const props = await gsp()
                        if (util.isObject(props)) {
                            this._customApp.staticProps = props
                        }
                    }
                    this._customApp.Component = Component
                }
            }
            await this._compile('./' + name)
        }

        for await (const { path: fp } of w2) {
            const name = path.basename(fp)
            const pagePath = '/' + name.replace(regModuleExt, '').replace(/\s+/g, '-').replace(/\/?index$/i, '')
            this._pageModules[pagePath] = './pages/' + name.replace(regModuleExt, '') + '.js'
            await this._compile('./pages/' + name)
        }

        await this._compile('./main.js', `
            import { bootstrap } from 'https://postjs.io/app.ts'
            bootstrap({
                baseUrl: ${JSON.stringify(this.config.baseUrl)},
                pageModules: ${JSON.stringify(this._pageModules)},
                hmr: ${this.isDev}
            })
        `)

        for await (const { path: fp } of w3) {
            const name = path.basename(fp)
            const apiPath = '/' + name.replace(regModuleExt, '').replace(/\s+/g, '-')
            const { default: handle } = await import(fp)
            if (util.isFunction(handle)) {
                this._apis.set(apiPath, handle)
            }
        }

        log.info(colors.bold('Pages'))
        for (const path in this._pageModules) {
            log.info(`▲ ${path}`, path == '/' ? '(home)' : '')
        }
        log.info(colors.bold('APIs'))
        for (const path of this._apis.keys()) {
            log.info(`λ /api${path}`)
        }

        if (this.isDev) {
            this._watch()
        }
    }

    private async _watch() {
        const w = Deno.watchFs(this.srcDir, { recursive: true })
        log.info('Start watching code changes.')
        for await (const event of w) {
            for (const p of event.paths) {
                const rp = util.trimPrefix(util.trimPrefix(p, this.config.rootDir), '/')
                if (regModuleExt.test(rp) && !rp.startsWith('.postjs') && !rp.startsWith(this.config.outputDir.slice(1))) {
                    console.log(event.kind, './' + rp)
                }
            }
        }
    }

    private async _compile(sourceFile: string, sourceCode?: string) {
        const { baseUrl, cacheDeps, rootDir, importMap } = this.config
        const isRemote = regHttp.test(sourceFile)
        const name = path.basename(sourceFile).replace(regModuleExt, '')
        const moduleName = sourceFile.replace(regHttp, '').replace(regModuleExt, '') + '.js'
        const cacheDir = path.join(rootDir, '.postjs', path.dirname(isRemote ? sourceFile.replace(regHttp, 'deps/') : this.mode + sourceFile.slice(1)))
        const metaCacheFile = path.join(cacheDir, `${name}.meta.json`)
        const jsCacheFile = path.join(cacheDir, `${name}.js`)
        const sourceMapCacheFile = path.join(cacheDir, `${name}.js.map`)

        if ((isRemote && this._deps.has(moduleName)) || this._modules.has(moduleName)) {
            return
        }

        let source = ''
        let sourceHash = ''
        let deps: Array<string> = []
        let js: string = ''
        let sourceMap: string = ''

        if (existsSync(metaCacheFile) && existsSync(jsCacheFile) && existsSync(sourceMapCacheFile)) {
            try {
                const { sourceHash: _sourceHash, deps: _deps } = JSON.parse(Deno.readTextFileSync(metaCacheFile))
                if (util.isNEString(_sourceHash)) {
                    sourceHash = _sourceHash
                    if (util.isNEArray(_deps)) {
                        deps = _deps
                    }
                    js = Deno.readTextFileSync(jsCacheFile)
                    sourceMap = Deno.readTextFileSync(sourceMapCacheFile)
                }
            } catch (err) {
                sourceHash = ''
                deps = []
                js = ''
                sourceMap = ''
            }
        }

        if (isRemote) {
            let url = sourceFile
            if (importMap) {
                for (const path in importMap.imports) {
                    const alias = importMap.imports[path]
                    if (path === url) {
                        url = alias
                        break
                    } else if (path.endsWith('/') && url.startsWith(path)) {
                        url = util.trimSuffix(alias, '/') + '/' + util.trimPrefix(url, path)
                        break
                    }
                }
            }
            if (sourceHash === '') {
                log.info('Download', sourceFile, url != sourceFile ? colors.dim(`• ${url}`) : '')
                try {
                    source = await fetch(url).then(resp => {
                        if (resp.status == 200) {
                            return resp.text()
                        }
                        return Promise.reject(new Error(`${resp.status} - ${resp.statusText}`))
                    })
                    sourceHash = (new Sha1()).update(source).hex()
                } catch (err) {
                    log.error(`Download ${sourceFile}: ${err.message}`)
                    return
                }
            } else if (/^http:\/\/(localhost|127.0.0.1)(:\d+)?\//.test(url)) {
                const text = await fetch(url).then(resp => {
                    if (resp.status == 200) {
                        return resp.text()
                    }
                    return Promise.reject(new Error(`${resp.status} - ${resp.statusText}`))
                })
                const hash = (new Sha1()).update(text).hex()
                if (sourceHash !== hash) {
                    source = text
                    sourceHash = hash
                }
            }
        } else if (sourceCode) {
            const hash = (new Sha1()).update(sourceCode).hex()
            if (sourceHash === '' || sourceHash !== hash) {
                source = sourceCode
                sourceHash = hash
            }
        } else {
            const filepath = path.join(this.srcDir, sourceFile)
            const fileinfo = await Deno.stat(filepath)

            // 10mb limit
            if (fileinfo.size > 10 * (1 << 20)) {
                log.error(`ignored module '${sourceFile}': too large(${(fileinfo.size / (1 << 20)).toFixed(2)}mb)`)
                return
            }

            const text = await Deno.readTextFile(filepath)
            const hash = (new Sha1()).update(text).hex()
            if (sourceHash === '' || sourceHash !== hash) {
                source = text
                sourceHash = hash
            }
        }

        if (source !== '') {
            deps = []
            js = ''
            sourceMap = ''

            const rewriteImportPath = (importPath: string): string => {
                let newImportPath: string
                if (regHttp.test(importPath)) {
                    if (cacheDeps || /\.(jsx|tsx?)$/i.test(importPath)) {
                        newImportPath = path.join(baseUrl, importPath.replace(regHttp, '-/'))
                    } else {
                        return importPath
                    }
                } else {
                    if (isRemote) {
                        const sourceUrl = new URL(sourceFile)
                        let pathname = importPath
                        if (!pathname.startsWith('/')) {
                            pathname = path.join(path.dirname(sourceUrl.pathname), importPath)
                        }
                        newImportPath = path.join(baseUrl, '-', sourceUrl.host, pathname)
                    } else {
                        newImportPath = path.resolve(baseUrl, path.dirname(sourceFile), importPath)
                    }
                }
                if (regHttp.test(importPath)) {
                    deps.push(importPath)
                } else {
                    if (isRemote) {
                        const sourceUrl = new URL(sourceFile)
                        let pathname = importPath
                        if (!pathname.startsWith('/')) {
                            pathname = path.join(path.dirname(sourceUrl.pathname), importPath)
                        }
                        deps.push(sourceUrl.protocol + '//' + sourceUrl.host + pathname)
                    } else {
                        deps.push('.' + path.resolve('/', path.dirname(sourceFile), importPath))
                    }
                }
                return newImportPath.replace(regModuleExt, '') + '.js'
            }
            const t = performance.now()
            const { diagnostics, outputText, sourceMapText } = compile(sourceFile, source, { mode: this.mode, rewriteImportPath })
            if (diagnostics && diagnostics.length) {
                log.warn(`compile ${sourceFile}:`, diagnostics)
                return
            }

            js = outputText
            sourceMap = sourceMapText!

            if (!existsSync(cacheDir)) {
                await Deno.mkdir(cacheDir, { recursive: true })
            }
            await Promise.all([
                Deno.writeTextFile(metaCacheFile, JSON.stringify({
                    sourceFile,
                    sourceHash,
                    deps: deps
                })),
                Deno.writeTextFile(jsCacheFile, outputText),
                Deno.writeTextFile(sourceMapCacheFile, sourceMapText!)
            ])

            log.debug(`${sourceFile} compiled in ${(performance.now() - t).toFixed(3)}ms`)
        }

        const mod = { js, sourceFile, sourceHash, sourceMap }
        if (isRemote) {
            this._deps.set(moduleName, mod)
        } else {
            this._modules.set(moduleName, mod)
        }

        for (const path of deps) {
            await this._compile(path)
        }
    }

    async build() {

    }

    async _renderPage(url: RouterURL, locale = 'en') {
        const ret = {
            code: 404,
            head: ['<title>404 - page not found</title>'],
            body: '<p><strong><code>404</code></strong><small> - </small><span>page not found</span></p>',
            ssrData: { url, locale, staticProps: null as any },
        }
        if (url.pagePath in this._pageModules) {
            try {
                const pageModule = this._modules.get(this._pageModules[url.pagePath])!
                const { default: Page, getStaticProps } = await import(path.join(this.srcDir, pageModule.sourceFile))
                if (util.isFunction(Page)) {
                    const gsp = [Page.getStaticProps, getStaticProps].filter(util.isFunction)[0]
                    const staticProps = gsp ? await gsp(url, locale) : null
                    const html = ReactDomServer.renderToString(
                        React.createElement(
                            AppContext.Provider,
                            {
                                value: {
                                    locale
                                }
                            },
                            React.createElement(
                                RouterContext.Provider,
                                { value: url },
                                React.createElement(
                                    this._customApp.Component,
                                    this._customApp.staticProps,
                                    React.createElement(
                                        Page,
                                        util.isObject(staticProps) ? staticProps : null
                                    )
                                )
                            )
                        )
                    )
                    ret.code = 200
                    ret.head = renderToTags()
                    ret.body = `<main>${html}</main>`
                    ret.ssrData.staticProps = util.isObject(staticProps) ? staticProps : null
                } else {
                    ret.code = 500
                    ret.head = ['<title>500 - render error</title>']
                    ret.body = `<p><strong><code>500</code></strong><small> - </small><span>render error: bad page component</span></p>`
                }
            } catch (err) {
                ret.code = 500
                ret.head = ['<title>500 - render error</title>']
                ret.body = `<p><strong><code>500</code></strong><small> - </small><span>render error: <pre>${err.message}</pre></span></p>` // todo: ansi2html
                log.error(err.message)
                console.log(err)
            }
        }
        return ret
    }
}
