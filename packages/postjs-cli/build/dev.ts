import { renderHeadToString, URL, utils } from '@postjs/core'
import { EventEmitter } from 'events'
import fs from 'fs-extra'
import path from 'path'
import { Watching } from 'webpack'
import { App } from './app'
import { route } from './app/router'
import { addEntry, createHtml, getJSXFiles } from './utils'
import { ChunkWithContent, Compiler } from './webpack'

export class DevWatcher {
    private _app: App
    private _jsxFiles: string[]
    private _pageChunks: Map<string, ChunkWithContent & { html?: string, staticProps?: any }>
    private _componentChunks: Map<string, ChunkWithContent>
    private _commonChunks: Map<string, ChunkWithContent>
    private _buildManifest: Record<string, any> | null
    private _compiler: Compiler
    private _watching: Watching
    private _hotUpdateEmitter: EventEmitter

    constructor(appDir: string) {
        const app = new App(appDir)
        this._app = app
        this._jsxFiles = [
            ...getJSXFiles('components/', app.srcDir),
            ...getJSXFiles('pages/', app.srcDir)
        ]
        this._pageChunks = new Map()
        this._componentChunks = new Map()
        this._commonChunks = new Map()
        this._buildManifest = null
        this._compiler = new Compiler(app.srcDir, app.entryJS, {
            enableHMR: true,
            splitVendorChunk: true,
            browserslist: app.config.browserslist,
            useBuiltIns: app.config.polyfillsMode
        })
        this._compiler.hooks.make.tapPromise(
            'add page/component entries',
            async compilation => {
                this._jsxFiles = this._jsxFiles.filter(jsxFile => {
                    return fs.existsSync(path.join(this._app.srcDir, jsxFile))
                })
                return Promise.all(this._jsxFiles.map(jsxFile => {
                    let loader = { type: '', options: { rawRequest: './' + jsxFile } }
                    let chunkName = jsxFile.replace(/\.(jsx?|mjs|tsx?)$/i, '').replace(/ /g, '-')
                    if (chunkName === 'pages/_app') {
                        loader.type = 'app'
                        chunkName = 'app'
                    } else if (chunkName.startsWith('pages/')) {
                        const pagePath = utils.trimPrefix(chunkName, 'pages').replace(/\/index$/i, '') || '/'
                        loader.type = 'page'
                        loader.options['pagePath'] = pagePath
                    } else if (chunkName.startsWith('components/')) {
                        const name = utils.trimPrefix(chunkName, 'components/')
                        loader.type = 'component'
                        loader.options['name'] = name
                    } else {
                        return Promise.resolve()
                    }
                    return addEntry(
                        compilation,
                        this._app.srcDir,
                        chunkName,
                        [`post-${loader.type}-loader?${JSON.stringify(loader.options)}!`]
                    )
                })).catch(err => console.error('add entries:', err))
            }
        )
    }

    get isInitiated() {
        return this._buildManifest !== null
    }

    // buildManifest returns the buildManifest as copy
    get buildManifest() {
        if (!this.isInitiated) {
            return null
        }
        return { ...this._buildManifest }
    }

    getChunk(name: string): ChunkWithContent | null {
        if (name.startsWith('pages/')) {
            const pagePath = '/' + name.replace(/^pages\/(index)?/, '')
            if (this._pageChunks.has(pagePath)) {
                return this._pageChunks.get(pagePath)!
            }
        } if (name.startsWith('components/')) {
            name = utils.trimPrefix(name, 'components/')
            if (this._componentChunks.has(name)) {
                return this._componentChunks.get(name)!
            }
        } else if (this._commonChunks.has(name)) {
            return this._commonChunks.get(name)!
        }
        return null
    }

    getOutputContent(filename: string) {
        if (!this.isInitiated) {
            return null
        }

        const memfs = this._compiler!.memfs
        const filepath = path.join('/', filename)
        if (memfs.existsSync(filepath)) {
            return memfs.readFileSync(filepath)
        }
        return null
    }

    async getAppStaticProps() {
        return await this._app.getStaticProps()
    }

    async getPageStaticProps(pathname: string) {
        if (!this.isInitiated) {
            return undefined
        }

        const url = route('/', Array.from(this._pageChunks.keys()), { location: { pathname } })
        const { pagePath } = url
        if (pagePath !== '' && this._pageChunks.has(pagePath)) {
            const pageChunk = this._pageChunks.get(pagePath)!
            if (pageChunk.staticProps === undefined) {
                await this._renderPage(url)
            }
            return pageChunk.staticProps
        }
        return undefined
    }

    async getPageHtml(pathname: string): Promise<[number, string]> {
        if (!this.isInitiated) {
            return [501, createHtml({
                lang: this._app.config.lang,
                head: ['<title>501 - First compilation not ready</title>'],
                body: '<p style="margin: 50px"><strong><code>501</code></strong><small>&nbsp;-&nbsp;</small><span>First compilation not ready</span></p>'
            })]
        }

        const url = route('/', Array.from(this._pageChunks.keys()), { location: { pathname } })
        const { pagePath } = url
        if (pagePath !== '' && this._pageChunks.has(pagePath)) {
            const pageChunk = this._pageChunks.get(pagePath)!
            if (pageChunk.html === undefined) {
                await this._renderPage(url)
            }
            if (pageChunk.html) {
                return [200, pageChunk.html]
            }
        }

        if (this._pageChunks.has('/_404')) {
            const pageChunk = this._pageChunks.get('/_404')!
            if (pageChunk.html === undefined) {
                await this._renderPage({ ...url, pagePath: '/_404' })
            }
            if (pageChunk.html) {
                return [404, pageChunk.html]
            }
        }

        return [404, createHtml({
            lang: this._app.config.lang,
            head: ['<title>404 - Page not found</title>'],
            body: '<p style="margin: 50px"><strong><code>404</code></strong><small>&nbsp;-&nbsp;</small><span>Page not found</span></p>'
        })]
    }

    private async _renderPage(url: URL) {
        if (this._commonChunks.has('app')) {
            const { hash } = this._commonChunks.get('app')!
            if (this._app.hash !== hash) {
                const { reqComponent } = await this._app.requirePage('/_app')
                this._app.update(hash, reqComponent())
            }
        }
        if (this._pageChunks.has(url.pagePath)) {
            const app = this._app
            const baseUrl = app.config.baseUrl.replace(/\/+$/, '')
            const pageChunk = this._pageChunks.get(url.pagePath)!
            const { reqComponent, css } = await app.requirePage(url.pagePath)
            const { staticProps, html } = await app.renderPage(url, reqComponent())
            const head = renderHeadToString()

            pageChunk.staticProps = staticProps
            pageChunk.html = createHtml({
                lang: app.config.lang,
                head: head.concat('<meta name="post-head-end" content="true" />'),
                styles: css ? [{ 'data-post-style': pageChunk.name, content: css }] : undefined,
                scripts: [
                    { type: 'application/json', id: 'ssr-data', innerText: JSON.stringify({ url, staticProps }) },
                    { src: baseUrl + `/_post/build-manifest.js?v=${pageChunk.hash}`, async: true },
                    { src: baseUrl + `/_post/pages/${url.pagePath.replace(/^\/+/, '') || 'index'}.js?v=${pageChunk.hash}`, async: true },
                    ...Array.from(this._commonChunks.values()).map(({ name, hash }) => ({ src: baseUrl + `/_post/${name}.js?v=${hash}`, async: true }))
                ],
                body: html
            })

            console.log(`page '${url.pagePath}' rendered`)
        }
    }

    watch(emitter: EventEmitter) {
        this._hotUpdateEmitter = emitter
        this._watching = this._compiler.watch({
            aggregateTimeout: 150,
            ignored: /[\\/]node_modules[\\/]/
        }, (err, stats) => {
            if (err) {
                console.error('watch error:', err)
                return
            }

            const memfs = this._compiler!.memfs
            const { hash, startTime, endTime, compilation } = stats
            const { isInitiated } = this
            const errorsWarnings = stats.toJson('errors-warnings')

            // reset build manifest
            this._buildManifest = {
                hash,
                startTime,
                endTime,
                errors: errorsWarnings.errors,
                warnings: errorsWarnings.warnings,
                components: {},
                pages: {}
            }

            if (!stats.hasErrors()) {
                compilation.namedChunks.forEach(({ name, hash }) => {
                    const chunkFileName = '/' + name + '.js'
                    if (memfs.existsSync(chunkFileName)) {
                        const content = memfs.readFileSync(chunkFileName).toString()
                        if (name.startsWith('pages/')) {
                            const pageName = utils.trimPrefix(name, 'pages/')
                            const pagePath = ('/' + pageName).replace(/\/index$/i, '') || '/'
                            name = utils.trimPrefix(name, 'pages/')
                            if (compilation.namedChunks.has('app')) {
                                hash = compilation.namedChunks.get('app')!.hash + '.' + hash
                            }
                            if (!this._pageChunks.has(pagePath) || this._pageChunks.get(pagePath)!.hash !== hash) {
                                this._pageChunks.set(pagePath, { name: pageName, hash, content })
                            }
                            this._buildManifest!.pages[pagePath] = { name: pageName, hash }
                        } else if (name.startsWith('components/')) {
                            name = utils.trimPrefix(name, 'components/')
                            if (!this._componentChunks.has(name) || this._componentChunks.get(name)!.hash !== hash) {
                                this._componentChunks.set(name, { name, hash, content })
                            }
                            this._buildManifest!.components[name] = { hash }
                        } else if (!this._commonChunks.has(name) || this._commonChunks.get(name)!.hash !== hash) {
                            this._commonChunks.set(name, { name, hash, content })
                        }
                    }
                })

                // cleanup
                if (this._commonChunks.has('app') && !compilation.namedChunks.has('app')) {
                    this._commonChunks.delete('app')
                    this._app.update(null, null)
                }
                Array.from(this._pageChunks.keys()).filter(pagePath => !Object.keys(this._buildManifest!.pages).includes(pagePath)).forEach(pagePath => {
                    this._pageChunks.delete(pagePath)
                })
                Array.from(this._componentChunks.keys()).filter(name => !Object.keys(this._buildManifest!.components).includes(name)).forEach(name => {
                    this._componentChunks.delete(name)
                })
            }

            if (isInitiated) {
                emitter.emit('webpackHotUpdate', this._buildManifest)
            }

            [errorsWarnings.errors, errorsWarnings.warnings].flat().forEach(msg => {
                console.error(msg)
            })
        })
    }

    reload() {
        if (this._watching) {
            this._watching.close(() => {
                this.watch(this._hotUpdateEmitter)
            })
        }
    }
}
