import { utils } from '@postjs/core'
import MemoryFS from 'memory-fs'
import path from 'path'
import webpack from 'webpack'
import VirtualModulesPlugin from 'webpack-virtual-modules'
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
    private _vmp: VirtualModulesPlugin
    private _config: webpack.Configuration
    private _compiler: webpack.Compiler

    constructor(context: string, entry: string | Record<string, string>, config?: Config & { enableHMR?: true }) {
        const webpackEntry: webpack.Entry = {}
        const modules: Record<string, string> = {}
        if (utils.isNEString(entry)) {
            const filename = './_main.js'
            webpackEntry['main'] = [filename]
            modules[filename] = entry
        } else if (utils.isObject(entry)) {
            Object.keys(entry).forEach(name => {
                if (utils.isNEString(entry[name])) {
                    const filename = `./_${name}.js`
                    webpackEntry[name] = [filename]
                    modules[filename] = entry[name]
                }
            })
        }
        if (config?.enableHMR) {
            const filename = './_hmr_client.js'
            Object.keys(webpackEntry).forEach(key => {
                webpackEntry[key] = [
                    require.resolve('webpack/hot/dev-server'),
                    filename
                ].concat(webpackEntry[key])
            })
            modules[filename] = `
                window['__POST_HMR'] = true
                window.addEventListener('load', () => {
                    const hotEmitter = require('webpack/hot/emitter')
                    const url = location.protocol.replace(/^http/, 'ws') + '//' + location.host + '/_post/hmr-socket?page=' + encodeURI(location.pathname)
                    const socket = new WebSocket(url, 'hot-update')
                    socket.onmessage = ({ data }) => {
                        const buildManifest = JSON.parse(data)
                        if (buildManifest && buildManifest.hash) {
                            window.__POST_BUILD_MANIFEST = buildManifest
                            if (!(Array.isArray(buildManifest.errors) && buildManifest.errors.length > 0)) {
                                hotEmitter.emit('webpackHotUpdate', buildManifest.hash)
                            }
                        }
                    }
                })
            `
        }
        this._memfs = new MemoryFS()
        this._vmp = new VirtualModulesPlugin(modules)
        this._config = createConfig(context, webpackEntry, {
            ...config,
            plugins: ([this._vmp] as webpack.Plugin[]).concat(config?.enableHMR ? [new webpack.HotModuleReplacementPlugin()] : [], config?.plugins || [])
        })
        this._compiler = webpack(this._config)
        this._compiler.outputFileSystem = this._memfs
    }

    get memfs() {
        return this._memfs
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

    writeVirtualModule(filePath: string, content: string) {
        this._vmp.writeModule(filePath, content)
    }
}
