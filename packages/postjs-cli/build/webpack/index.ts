import { CleanWebpackPlugin } from 'clean-webpack-plugin'
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
            webpackEntry['app'] = './__app.jsx'
        } else if (utils.isObject(entry)) {
            Object.keys(entry).forEach(name => {
                webpackEntry[name] = `./__${name}.jsx`
            })
        }
        if (config?.enableHMR) {
            Object.keys(webpackEntry).forEach(key => {
                webpackEntry[key] = [require.resolve('webpack/hot/dev-server'), './__hmr_client.js', String(webpackEntry[key])]
            })
        }
        this._memfs = new MemoryFS()
        this._config = createConfig(context, {
            ...config,
            entry: webpackEntry,
            plugins: ([new CleanWebpackPlugin(), vmp] as any[]).concat(config?.enableHMR ? [new webpack.HotModuleReplacementPlugin()] : [], config?.plugins || []),
            optimization: {
                splitChunks: config?.splitVendorChunk ? {
                    cacheGroups: {
                        vendor: {
                            test: /[\\/](node_modules|packages[\\/]postjs-core)[\\/]/,
                            name: 'vendor',
                            chunks: 'all'
                        }
                    }
                } : undefined,
                minimize: config?.enableTerser,
                minimizer: config?.enableTerser ? [
                    new TerserPlugin({
                        chunkFilter: ({ name }) => name !== 'vendor'
                    })
                ] : undefined
            }
        })
        this._compiler = webpack(this._config)
        this._compiler.outputFileSystem = this._memfs
        if (utils.isNEString(entry)) {
            vmp.writeModule('./__app.jsx', entry)
        } else if (utils.isObject(entry)) {
            Object.keys(entry).forEach(name => {
                vmp.writeModule(`./__${name}.jsx`, entry[name])
            })
        }
        if (config?.enableHMR) {
            vmp.writeModule('./__hmr_client.js', `
                const hotEmitter = require('webpack/hot/emitter')

                window.addEventListener('load', async () => {
                    const url = 'ws://' + location.host + '/_hmr_socket'
                    const socket = new WebSocket(url, 'hot-update')
                    socket.onmessage = ({ data }) => {
                        const message = JSON.parse(data)
                        if (message.hash) {
                            hotEmitter.emit('webpackHotUpdate', message.hash)
                        }
                    }
                }, false)
            `)
        }
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
                    const ret: MiniStats = {
                        hash: stats.hash,
                        chunks: new Map(),
                        startTime: stats.startTime,
                        endTime: stats.endTime
                    }
                    namedChunks.forEach(({ hash }, name) => {
                        const content = this._getChunkContent(name)
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

    private _getChunkContent(name: string): string | null {
        const { filename, path: outPath } = this._config.output!
        const filepath = path.join(outPath!, String(filename!).replace('[name]', name))
        if (this._memfs.existsSync(filepath)) {
            return this._memfs.readFileSync(filepath).toString()
        }
        return null
    }
}
