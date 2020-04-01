import MemoryFS from 'memory-fs'
import path from 'path'
import TerserPlugin from 'terser-webpack-plugin'
import webpack from 'webpack'
import VirtualModulesPlugin from 'webpack-virtual-modules'
import utils from '../../shared/utils'
import createConfig from './config'

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
}

type Config = Pick<webpack.Configuration, 'mode' | 'target' | 'externals' | 'plugins' | 'devtool'> & {
    enableHMR?: boolean
    enableTerser?: boolean
    splitVendorChunk?: boolean
}

export class Compiler {
    private _memfs: MemoryFS
    private _config: webpack.Configuration
    private _compiler: webpack.Compiler

    constructor(context: string, entry: string | Record<string, string>, config?: Config) {
        const vmp = new VirtualModulesPlugin()
        const webpackEntry: webpack.Entry = {}
        if (utils.isNEString(entry)) {
            webpackEntry['app'] = './[vmp]app.js'
        } else if (utils.isObject(entry)) {
            Object.keys(entry).forEach(name => {
                webpackEntry[name] = `./[vmp]${name}.js`
            })
        }
        if (config?.enableHMR) {
            Object.keys(webpackEntry).forEach(key => {
                webpackEntry[key] = [
                    require.resolve('webpack/hot/dev-server'),
                    './[vmp]hmr-client.js',
                    String(webpackEntry[key])
                ]
            })
        }
        this._memfs = new MemoryFS()
        this._config = createConfig(context, {
            ...config,
            entry: webpackEntry,
            plugins: ([vmp] as any[]).concat(config?.enableHMR ? [new webpack.HotModuleReplacementPlugin()] : [], config?.plugins || []),
            optimization: {
                runtimeChunk: config?.target === 'node' ? undefined : { name: 'webpack-runtime' },
                splitChunks: config?.splitVendorChunk ? {
                    cacheGroups: {
                        vendor: {
                            test: /[\\/]node_modules[\\/]/,
                            name: 'vendor',
                            chunks: 'initial'
                        }
                    }
                } : undefined,
                minimize: config?.enableTerser,
                minimizer: config?.enableTerser ? [
                    new TerserPlugin({
                        cache: true,
                        terserOptions: {
                            ecma: 2015,
                            compress: true,
                            output: {
                                comments: true
                            }
                        }
                    })
                ] : undefined
            }
        })
        this._compiler = webpack(this._config)
        this._compiler.outputFileSystem = this._memfs
        if (utils.isNEString(entry)) {
            vmp.writeModule('./[vmp]app.js', entry)
        } else if (utils.isObject(entry)) {
            Object.keys(entry).forEach(name => {
                vmp.writeModule(`./[vmp]${name}.js`, entry[name])
            })
        }
        if (config?.enableHMR) {
            vmp.writeModule('./[vmp]hmr-client.js', `
                window.addEventListener('load', async () => {
                    const hotEmitter = require('webpack/hot/emitter')
                    const url = 'ws://' + location.host + '/_post/hmr-socket?page=' + location.pathname
                    const socket = new WebSocket(url, 'hot-update')
                    socket.onmessage = ({ data }) => {
                        const buildManifest = JSON.parse(data)
                        if (buildManifest.hash) {
                            window.__POST_BUILD_MANIFEST = buildManifest
                            if (!buildManifest.errors || (Array.isArray(buildManifest.errors) && buildManifest.errors.length === 0)) {
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

    getChunkContent(name: string): string | null {
        const { filename, path: outPath } = this._config.output!
        const filepath = path.join(outPath!, String(filename!).replace('[name]', name))
        if (this._memfs.existsSync(filepath)) {
            return this._memfs.readFileSync(filepath).toString()
        }
        return null
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
                        const content = this.getChunkContent(name)
                        if (content !== null) {
                            ret.chunks.set(name, { name, hash, content })
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
