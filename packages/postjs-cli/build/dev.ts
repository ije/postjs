import { route, URL, utils } from '@postjs/core'
import chokidar from 'chokidar'
import { EventEmitter } from 'events'
import glob from 'glob'
import { Watching } from 'webpack'
import DynamicEntryPlugin from 'webpack/lib/DynamicEntryPlugin'
import { colorful } from '../shared/colorful'
import { App } from './app'
import { createHtml } from './utils'
import { ChunkWithContent, Compiler } from './webpack'

export class DevWatcher {
    private _app: App
    private _entryFiles: string[]
    private _buildManifest: Record<string, any> | null
    private _commonChunks: Map<string, ChunkWithContent>
    private _componentChunks: Map<string, ChunkWithContent>
    private _pageChunks: Map<string, ChunkWithContent & { rendered: Record<string, Record<string, any>> }>
    private _compiler: Compiler
    private _fsWatcher: chokidar.FSWatcher
    private _watching: Watching

    constructor(appDir: string) {
        const app = new App(appDir)
        const { useSass, useStyledComponents, browserslist, polyfillsMode } = app.config
        this._app = app
        this._entryFiles = []
        this._buildManifest = null
        this._commonChunks = new Map()
        this._componentChunks = new Map()
        this._pageChunks = new Map()
        this._compiler = new Compiler(
            app.srcDir,
            app.entryJS,
            {
                enableHMR: true,
                useSass,
                useStyledComponents,
                browserslist,
                polyfillsMode
            }
        )
        this._compiler.hooks.make.tapPromise(
            'add page/component entries',
            async compilation => {
                return Promise.all(this._entryFiles.map(entryFile => {
                    let loader = { type: '', options: { rawRequest: './' + entryFile } }
                    let chunkName = entryFile.replace(/\.(jsx?|mjs|tsx?)$/i, '').replace(/ /g, '-')
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
                    return new Promise((resolve, reject) => {
                        // based on https://github.com/webpack/webpack/blob/master/lib/DynamicEntryPlugin.js
                        const dep = DynamicEntryPlugin.createDependency(
                            [`post-${loader.type}-loader?${JSON.stringify(loader.options)}!`],
                            chunkName
                        )
                        compilation.addEntry(this._app.srcDir, dep, chunkName, (err: any) => err ? reject(err) : resolve())
                    })
                })).catch(err => {
                    console.error('add page/component entries:', err)
                })
            }
        )
    }

    get isWatched() {
        return this._buildManifest !== null
    }

    // buildManifest returns the buildManifest as copy
    get buildManifest() {
        if (this._buildManifest !== null) {
            return { ...this._buildManifest }
        }
        return null
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

    async readOutputFile(filename: string) {
        if (!this.isWatched) {
            return null
        }
        if (this._compiler.existsOutput(filename)) {
            return this._compiler.readOutputFile(filename)
        }
        return null
    }

    async getPageStaticProps(pathname: string) {
        if (!this.isWatched) {
            return undefined
        }

        const url = route('/', Array.from(this._pageChunks.keys()), { location: { pathname } })
        const { pagePath, asPath } = url
        if (pagePath !== '' && this._pageChunks.has(pagePath)) {
            const pageChunk = this._pageChunks.get(pagePath)!
            if (pageChunk.rendered[asPath] === undefined) {
                await this._renderPage(url)
            }
            if (pageChunk.rendered[asPath]) {
                return pageChunk.rendered[asPath].staticProps
            }
        }
        return undefined
    }

    async getPageHtml(pathname: string): Promise<[number, string]> {
        if (!this.isWatched) {
            return [501, createHtml({
                lang: this._app.config.lang,
                head: ['<title>501 - First compilation not ready</title>'],
                body: '<p style="margin: 50px"><strong><code>501</code></strong><small>&nbsp;-&nbsp;</small><span>First compilation not ready</span></p>'
            })]
        }

        let url = route('/', Array.from(this._pageChunks.keys()), { location: { pathname } })
        let { pagePath, asPath } = url
        if (pagePath === '' || !this._pageChunks.has(pagePath)) {
            pagePath = '/_404'
            url = { pagePath, asPath: url.asPath, params: {}, query: {} }
        }
        if (pagePath !== '' && this._pageChunks.has(pagePath)) {
            const pageChunk = this._pageChunks.get(pagePath)!
            if (pageChunk.rendered[asPath] === undefined) {
                await this._renderPage(url)
            }
            if (pageChunk.rendered[asPath]) {
                const { staticProps, html, head, styledTags, css } = pageChunk.rendered[asPath]
                const baseUrl = this._app.config.baseUrl.replace(/\/+$/, '')
                return [200, createHtml({
                    lang: this._app.config.lang,
                    head: head.concat('<meta name="post-head-end" content="true" />'),
                    styles: [
                        { 'data-post-style': pageChunk.name, content: css || '' },
                        { plain: true, content: styledTags }
                    ],
                    scripts: [
                        { type: 'application/json', id: 'ssr-data', innerText: JSON.stringify({ url, staticProps }) },
                        { src: baseUrl + `/_post/build-manifest.js?v=${this.buildManifest!.hash}`, async: true },
                        { src: baseUrl + `/_post/pages/${url.pagePath.replace(/^\/+/, '') || 'index'}.js?v=${pageChunk.hash}`, async: true },
                        ...Array.from(this._commonChunks.values()).map(({ name, hash }) => ({ src: baseUrl + `/_post/${name}.js?v=${hash}`, async: true }))
                    ],
                    body: html
                })]
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
            const pageChunk = this._pageChunks.get(url.pagePath)!
            pageChunk.rendered[url.asPath] = await this._app.renderPage(url)
            if (url.asPath !== url.pagePath) {
                console.log(`Page '${url.pagePath}' as '${url.asPath}' rendered.`)
            } else {
                console.log(`Page '${url.pagePath}' rendered.`)
            }
        }
    }

    // ask webpack recompile
    private _emitChange() {
        this._compiler.writeVirtualModule('./_main.js', this._app.entryJS)
    }

    watch(emitter: EventEmitter) {
        const jsPattern = '{pages,components}/**/*.{js,jsx,mjs,ts,tsx}'
        const isValidName = (s: string) => /^[a-z0-9/.$*_~ -]+$/i.test(s)

        if (this._watching) {
            return
        }

        this._entryFiles = glob.sync(jsPattern, { cwd: this._app.srcDir }).filter(isValidName)
        this._fsWatcher = chokidar.watch(jsPattern, {
            cwd: this._app.srcDir,
            ignoreInitial: true
        }).on('add', path => {
            if (isValidName(path)) {
                this._entryFiles.push(path)
                this._emitChange()
            }
        }).on('unlink', path => {
            if (isValidName(path)) {
                const index = this._entryFiles.indexOf(path)
                if (index >= 0) {
                    this._entryFiles.splice(index, 1)
                    this._emitChange()
                }
            }
        })
        this._watching = this._compiler.watch({
            aggregateTimeout: 150,
            ignored: /[\\/]node_modules[\\/]/
        }, (err, stats) => {
            if (err) {
                console.error('Watch error:', err)
                return
            }

            const { hash, startTime, endTime, compilation } = stats
            const { isWatched } = this
            const errorsWarnings = stats.toJson('errors-warnings')

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
                let appChunkChanged = false
                let commonsChunkChanged = false

                compilation.namedChunks.forEach(({ name, hash }) => {
                    const chunkFileName = '/' + name + '.js'
                    if (this._compiler.existsOutput(chunkFileName)) {
                        const content = this._compiler.readOutputFile(chunkFileName).toString()
                        if (name.startsWith('pages/')) {
                            const pageName = utils.trimPrefix(name, 'pages/')
                            const pagePath = ('/' + pageName).replace(/\/index$/i, '') || '/'
                            if (!this._pageChunks.has(pagePath) || this._pageChunks.get(pagePath)!.hash !== hash) {
                                this._pageChunks.set(pagePath, { name: pageName, hash, content, rendered: {} })
                            }
                            this._buildManifest!.pages[pagePath] = { name: pageName, hash }
                        } else if (name.startsWith('components/')) {
                            name = utils.trimPrefix(name, 'components/')
                            if (!this._componentChunks.has(name) || this._componentChunks.get(name)!.hash !== hash) {
                                this._componentChunks.set(name, { name, hash, content })
                            }
                            this._buildManifest!.components[name] = { hash }
                        } else if (!this._commonChunks.has(name) || this._commonChunks.get(name)!.hash !== hash) {
                            if (name === 'app') {
                                appChunkChanged = true
                            } else if (name === 'commons') {
                                commonsChunkChanged = true
                            } else if (name === 'webpack-runtime') {
                                hash = this._buildManifest!.hash
                            }
                            this._commonChunks.set(name, { name, hash, content })
                        }
                    }
                })

                // inject app static props
                if (appChunkChanged) {
                    this._app.getStaticProps().then(appStaticProps => {
                        const chunk = this._commonChunks.get('app')
                        Object.assign(chunk, {
                            content: `(window.__POST_APP = window.__POST_APP || {}).staticProps = ${JSON.stringify(appStaticProps)};\n${chunk!.content}`
                        })
                    })
                }

                // cleanup
                if (appChunkChanged || commonsChunkChanged) {
                    this._pageChunks.forEach(chunk => {
                        chunk.rendered = {}
                    })
                }
                Array.from(this._pageChunks.keys()).filter(pagePath => !Object.keys(this._buildManifest!.pages).includes(pagePath)).forEach(pagePath => {
                    this._pageChunks.delete(pagePath)
                    console.log('[info]', colorful(`Page '${pagePath}' removed.`, 'dim'))
                })
                Array.from(this._componentChunks.keys()).filter(name => !Object.keys(this._buildManifest!.components).includes(name)).forEach(name => {
                    this._componentChunks.delete(name)
                    console.log('[info]', colorful(`Component '${name}' removed.`, 'dim'))
                })
                if (this._commonChunks.has('app') && !compilation.namedChunks.has('app')) {
                    this._commonChunks.delete('app')
                    console.log('[info]', colorful('Custom App removed.', 'dim'))
                }
            }

            errorsWarnings.errors.forEach(msg => {
                console.error('[error]', colorful(msg, 'red'))
            })
            errorsWarnings.warnings.forEach(msg => {
                console.warn('[warn]', colorful(msg, 'yellow'))
            })

            if (isWatched) {
                emitter.emit('webpackHotUpdate', this._buildManifest)
            }
        })
    }

    unwatch() {
        if (this._fsWatcher) {
            this._fsWatcher.close().then(() => {
                delete this._fsWatcher
            })
        }
        if (this._watching) {
            this._watching.close(() => {
                delete this._watching
                this._buildManifest = null
                this._commonChunks.clear()
                this._componentChunks.clear()
                this._pageChunks.clear()
            })
        }
    }
}
