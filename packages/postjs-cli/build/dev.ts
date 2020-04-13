import { renderHeadToString, route, URL, utils } from '@postjs/core'
import { EventEmitter } from 'events'
import fs from 'fs-extra'
import path from 'path'
import webpack, { Watching } from 'webpack'
import { App } from './app'
import { addEntry, createHtml, getJSFiles } from './utils'
import { ChunkWithContent, Compiler } from './webpack'

export class DevWatcher {
    private _app: App
    private _jsFiles: string[]
    private _pageChunks: Map<string, ChunkWithContent & { htmls: Record<string, string>, datas: Record<string, Record<string, any> | null> }>
    private _componentChunks: Map<string, ChunkWithContent>
    private _commonChunks: Map<string, ChunkWithContent>
    private _buildManifest: Record<string, any> | null
    private _compiler: Compiler
    private _watching: Watching
    private _hotUpdateEmitter: EventEmitter

    constructor(appDir: string) {
        const app = new App(appDir)
        this._app = app
        this._jsFiles = [
            ...getJSFiles('components/', app.srcDir),
            ...getJSFiles('pages/', app.srcDir)
        ]
        this._pageChunks = new Map()
        this._componentChunks = new Map()
        this._commonChunks = new Map()
        this._buildManifest = null
        this._compiler = new Compiler(app.srcDir, app.entryJS, {
            enableHMR: true,
            browserslist: app.config.browserslist,
            useBuiltIns: app.config.polyfillsMode
        })
        this._compiler.hooks.make.tapPromise(
            'add page/component entries',
            async compilation => {
                this._jsFiles = this._jsFiles.filter(jsFile => {
                    return fs.existsSync(path.join(this._app.srcDir, jsFile))
                })
                return Promise.all(this._jsFiles.map(jsFile => {
                    let loader = { type: '', options: { rawRequest: './' + jsFile } }
                    let chunkName = jsFile.replace(/\.(jsx?|mjs|tsx?)$/i, '').replace(/ /g, '-')
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
            // todo: ensure page/component
        } if (name.startsWith('components/')) {
            name = utils.trimPrefix(name, 'components/')
            if (this._componentChunks.has(name)) {
                return this._componentChunks.get(name)!
            }
            // todo: ensure page/component
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

    async getPageStaticProps(pathname: string) {
        if (!this.isInitiated) {
            return undefined
        }

        const url = route('/', Array.from(this._pageChunks.keys()), { location: { pathname } })
        const { pagePath, asPath } = url
        // todo: ensure page/component
        if (pagePath !== '' && this._pageChunks.has(pagePath)) {
            const pageChunk = this._pageChunks.get(pagePath)!
            if (pageChunk.datas[asPath] === undefined) {
                const staticProps = await this._app.getStaticProps(pagePath, url)
                pageChunk.datas[asPath] = staticProps
            }
            return pageChunk.datas[asPath]
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
        const { pagePath, asPath } = url
        // todo: ensure page/component
        if (pagePath !== '' && this._pageChunks.has(pagePath)) {
            const pageChunk = this._pageChunks.get(pagePath)!
            if (pageChunk.htmls[asPath] === undefined) {
                await this._renderPage(url)
            }
            if (pageChunk.htmls[asPath]) {
                return [200, pageChunk.htmls[asPath]]
            }
        }

        if (this._pageChunks.has('/_404')) {
            const pageChunk = this._pageChunks.get('/_404')!
            if (pageChunk.htmls[asPath] === undefined) {
                await this._renderPage({ pagePath: '/_404', asPath: url.asPath, params: {}, query: {} })
            }
            if (pageChunk.htmls[asPath]) {
                return [404, pageChunk.htmls[asPath]]
            }
        }

        return [404, createHtml({
            lang: this._app.config.lang,
            head: ['<title>404 - Page not found</title>'],
            body: '<p style="margin: 50px"><strong><code>404</code></strong><small>&nbsp;-&nbsp;</small><span>Page not found</span></p>'
        })]
    }

    private async _renderPage(url: URL) {
        if (this._pageChunks.has(url.pagePath)) {
            const app = this._app
            const baseUrl = app.config.baseUrl.replace(/\/+$/, '')
            const pageChunk = this._pageChunks.get(url.pagePath)!
            const { staticProps, html, css } = await app.renderPage(url)
            const head = renderHeadToString()

            pageChunk.htmls[url.asPath] = createHtml({
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

            if (url.asPath !== url.pagePath) {
                console.log(`page '${url.pagePath}' as '${url.asPath}' rendered.`)
            } else {
                console.log(`page '${url.pagePath}' rendered.`)
            }
        }
    }

    watch(emitter: EventEmitter, compiled?: (stat: webpack.Stats.ToJsonOutput) => void) {
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
                        let content = memfs.readFileSync(chunkFileName).toString()
                        if (name.startsWith('pages/')) {
                            const pageName = utils.trimPrefix(name, 'pages/')
                            const pagePath = ('/' + pageName).replace(/\/index$/i, '') || '/'
                            name = utils.trimPrefix(name, 'pages/')
                            if (compilation.namedChunks.has('app')) {
                                hash = compilation.namedChunks.get('app')!.hash + '.' + hash
                            }
                            if (!this._pageChunks.has(pagePath) || this._pageChunks.get(pagePath)!.hash !== hash) {
                                this._pageChunks.set(pagePath, { name: pageName, hash, content, htmls: {}, datas: {} })
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
                            if (name === 'app') {
                                this._app.getStaticProps('/_app').then(appStaticProps => {
                                    const chunk = this._commonChunks.get('app')!
                                    if (chunk?.hash === hash) {
                                        Object.assign(chunk, {
                                            content: `(window.__POST_APP = window.__POST_APP || {}).staticProps = ${JSON.stringify(appStaticProps)};\n${chunk.content}`
                                        })
                                    }
                                })
                            }
                        }
                    }
                })

                // cleanup
                if (this._commonChunks.has('app') && !compilation.namedChunks.has('app')) {
                    this._commonChunks.delete('app')
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

            if (compiled) {
                compiled(errorsWarnings)
            }
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
