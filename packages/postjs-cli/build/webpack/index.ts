import MemoryFS from 'memory-fs'
import path from 'path'
import webpack from 'webpack'
import VirtualModulesPlugin from 'webpack-virtual-modules'
import utils from '../../shared/utils'
import createConfig, { Config } from './config'

export interface MiniStats {
    readonly hash: string,
    readonly chunks: Map<string, ChunkWithContent>
    readonly warnings: any[]
    readonly errors: any[]
    readonly startTime?: number
    readonly endTime?: number
}

export interface ChunkWithContent {
    readonly name: string
    readonly hash: string
    readonly content: string
    readonly css?: string
}

export class Compiler {
    private _memfs: MemoryFS
    private _config: webpack.Configuration
    private _compiler: webpack.Compiler

    constructor(context: string, entry: string | Record<string, string>, config?: Config & { enableHMR?: true }) {
        const vmp = new VirtualModulesPlugin()
        const webpackEntry: webpack.Entry = {}
        if (utils.isNEString(entry)) {
            webpackEntry['main'] = './_main.js'
        } else if (utils.isObject(entry)) {
            Object.keys(entry).forEach(name => {
                webpackEntry[name] = `./_${name}.js`
            })
        }
        if (config?.enableHMR) {
            Object.keys(webpackEntry).forEach(key => {
                webpackEntry[key] = [
                    require.resolve('webpack/hot/dev-server'),
                    './_hmr_client.js',
                    String(webpackEntry[key])
                ]
            })
        }
        this._memfs = new MemoryFS()
        this._config = createConfig(context, webpackEntry, {
            ...config,
            plugins: ([vmp] as webpack.Plugin[]).concat(config?.enableHMR ? [new webpack.HotModuleReplacementPlugin()] : [], config?.plugins || [])
        })
        this._compiler = webpack(this._config)
        this._compiler.outputFileSystem = this._memfs
        if (utils.isNEString(entry)) {
            vmp.writeModule('./_main.js', entry)
        } else if (utils.isObject(entry)) {
            Object.keys(entry).forEach(name => {
                vmp.writeModule(`./_${name}.js`, entry[name])
            })
        }
        if (config?.enableHMR) {
            vmp.writeModule('./_hmr_client.js', `
                window.addEventListener('load', async () => {
                    const hotEmitter = require('webpack/hot/emitter')
                    const url = 'ws://' + location.host + '/_post/hmr-socket?page=' + encodeURI(location.pathname)
                    const socket = new WebSocket(url, 'hot-update')
                    socket.onmessage = ({ data }) => {
                        const buildManifest = JSON.parse(data)
                        if (buildManifest.hash) {
                            window.__POST_BUILD_MANIFEST = buildManifest
                            if (!(Array.isArray(buildManifest.errors) && buildManifest.errors.length > 0)) {
                                hotEmitter.emit('webpackHotUpdate', buildManifest.hash)
                            }
                        }
                    }
                }, false)
            `)
        }
    }

    get memfs() {
        return this._memfs
    }

    get context() {
        return this._compiler.context
    }

    get hooks() {
        return this._compiler.hooks
    }

    compile(): Promise<MiniStats> {
        return new Promise((resolve: (stats: MiniStats) => void, reject: (err: Error) => void) => {
            this._compiler.run((err, stats) => {
                if (err) {
                    reject(err)
                    return
                }

                if (stats.hash && !stats.hasErrors()) {
                    const { namedChunks } = stats.compilation
                    const errorsWarnings = stats.toJson('errors-warnings')
                    const ret: MiniStats = {
                        hash: stats.hash,
                        chunks: new Map(),
                        startTime: stats.startTime,
                        endTime: stats.endTime,
                        warnings: errorsWarnings.warnings,
                        errors: []
                    }
                    namedChunks.forEach(({ hash }, name) => {
                        const { filename, path: outPath } = this._config.output!
                        const filepath = path.join(outPath!, String(filename!).replace('[name]', name))
                        if (this._memfs.existsSync(filepath)) {
                            const content = this._memfs.readFileSync(filepath).toString()
                            const chunk = { name, hash, content } as ChunkWithContent
                            const cssFilepath = filepath.replace(/\.js$/, '.css')
                            if (this._memfs.existsSync(cssFilepath)) {
                                const css = this._memfs.readFileSync(cssFilepath).toString()
                                Object.assign(chunk, { css })
                            }
                            ret.chunks.set(name, chunk)
                        }
                    })
                    resolve(ret)
                } else {
                    reject(new Error(stats.toString('minimal')))
                }
            })
        })
    }

    watch(watchOptions: webpack.Compiler.WatchOptions, handler: webpack.Compiler.Handler) {
        return this._compiler.watch(watchOptions, handler)
    }
}
