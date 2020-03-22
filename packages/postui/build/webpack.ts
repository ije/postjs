import webpack from 'webpack'
import MemoryFS from 'memory-fs'
import VirtualModulesPlugin from 'webpack-virtual-modules'
import path from 'path'

interface IVirtualModulesPlugin extends webpack.Plugin {
    writeModule(filePath: string, contents: string): void
}

interface CompileResult {
    hash: string,
    chuncks: { [key: string]: string }
}

const webpackConfig = (appDir: string, mode: 'production' | 'development') => ({
    mode,
    target: 'node',
    entry: {
        app: './app.js'
    },
    context: appDir,
    output: {
        path: '/dist/',
        filename: '[name].js',
        libraryTarget: 'umd'
    },
    module: {
        rules: [
            {
                test: /\.(j|t)s(x)?$/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        cacheDirectory: true,
                        babelrc: false,
                        presets: [
                            [
                                '@babel/preset-env',
                                {
                                    // useBuiltIns: 'usage',
                                    // corejs: 3
                                    targets: '> 0.5%, last 2 versions, Firefox ESR, not dead'
                                }
                            ],
                            '@babel/preset-typescript',
                            '@babel/preset-react'
                        ],
                        plugins: [
                            ['@babel/plugin-proposal-decorators', { legacy: true }],
                            ['@babel/plugin-proposal-class-properties', { loose: true }],
                            '@babel/plugin-proposal-optional-chaining',
                            '@babel/plugin-proposal-nullish-coalescing-operator'
                        ]
                    }
                }
            },
            {
                test: /\.css$/i,
                use: [
                    {
                        loader: 'style-loader',
                        options: {
                            singleton: true,
                            attrs: {
                                class: 'post-style'
                            }
                        }
                    },
                    'css-loader'
                ]
            },
            {
                test: /\.(jpe?g|png|gif|webp|svg|eot|ttf|woff2?)$/i,
                use: {
                    loader: 'file-loader',
                    options: {
                        name: '[name].[hash].[ext]'
                    }
                }
            },
            {
                test: /\.wasm$/i,
                type: 'javascript/auto',
                use: {
                    loader: 'file-loader',
                    options: {
                        name: '[name].[hash].[ext]'
                    }
                }
            }
        ]
    },
    resolve: {
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.json', '.wasm']
    },
    resolveLoader: {
        modules: [path.join(appDir, 'node_modules'), 'node_modules']
    },
    externals: [
        {
            'react': {
                root: 'React',
                amd: 'react',
                commonjs: 'react',
                commonjs2: 'react'
            }
        },
        {
            'react-dom': {
                root: 'ReactDOM',
                amd: 'react-dom',
                commonjs: 'react-dom',
                commonjs2: 'react-dom'
            }
        }
    ],
    // optimization: {
    //     splitChunks: {
    //         cacheGroups: {
    //             commons: {
    //                 test: /[\\/]node_modules[\\/]/,
    //                 name: 'vendor',
    //                 chunks: 'initial'
    //             }
    //         }
    //     }
    // },
    devtool: false
} as webpack.Configuration)

/**
 * Dynamic webpack entry.
 * @see https://github.com/webpack/docs/wiki/context
 */
const buildEntry = () => `
const req = require.context('./pages', true, /\\.(j|t)sx$/i)
const pages = {}

req.keys().forEach(path => {
    const name = path.replace(/^[\\.\\/]+/, '').replace(/\\.(j|t)sx$/i, '')
    pages[name] = () => req(path).default
})

exports.pages = pages
`

export class Compiler {
    private _mfs: MemoryFS
    private _vmp: IVirtualModulesPlugin
    private _config: webpack.Configuration
    private _compiler: webpack.Compiler
    private _lastEntry: string | null

    constructor(appDir: string, mode: 'production' | 'development') {
        this._mfs = new MemoryFS()
        this._vmp = new VirtualModulesPlugin()
        this._config = {
            ...webpackConfig(appDir, mode),
            plugins: [this._vmp]
        }
        this._compiler = webpack(this._config)
        this._compiler.outputFileSystem = this._mfs
        this._lastEntry = null
        this.buildEntry()
    }

    get hooks() {
        return this._compiler.hooks
    }

    watch(watchOptions: webpack.Compiler.WatchOptions, handler: webpack.Compiler.Handler) {
        return this._compiler.watch(watchOptions, handler)
    }

    compile(callback: (errors: Error | null, result?: CompileResult) => void) {
        return this._compiler.run((err, stats) => {
            if (err) {
                callback(err)
                return
            }

            if (stats.hasErrors()) {
                callback(new Error(stats.toString('minimal')))
            } else if (stats.hash) {
                if (stats.compilation.namedChunks.has('vendor')) {
                    callback(null, { hash: stats.hash, chuncks: { app: this.getOutput('app'), vendor: this.getOutput('vendor') } })
                } else {
                    callback(null, { hash: stats.hash, chuncks: { app: this.getOutput('app') } })
                }
            }
        })
    }

    buildEntry() {
        const entry = buildEntry()
        if (this._lastEntry === null || entry !== this._lastEntry) {
            this._vmp.writeModule(this._config.entry!['app'], entry)
            this._lastEntry = entry
        }
    }

    getOutput(name: string): string {
        const { filename, path: outPath } = this._config.output!
        const filepath = path.join(outPath!, String(filename!).replace('[name]', name))
        if (this._mfs.existsSync(filepath)) {
            return this._mfs.readFileSync(filepath).toString()
        }
        return ''
    }

    clear() {
        ['app', 'vendor'].forEach(name => {
            const { filename, path: outPath } = this._config.output!
            this._mfs.unlinkSync(path.join(outPath!, String(filename!).replace('[name]', name)))
        })
    }
}

export class Watcher {
    private _lastHash: string | null
    private _lastVendorChunkHash: string | null
    private _compiler: Compiler

    constructor(dir: string) {
        this._lastHash = null
        this._lastVendorChunkHash = null
        this._compiler = new Compiler(dir, 'development')
    }

    watch(onChange: (errors: Error | null, result?: CompileResult) => void) {
        this._compiler.hooks.watchRun.tap('update entry', () => this._compiler.buildEntry())
        return new UnWatcher(this._compiler, this._compiler.watch(
            { aggregateTimeout: 150 },
            (err, stats) => {
                if (err) {
                    onChange(err)
                    return
                }

                if (stats.hasErrors()) {
                    onChange(new Error(stats.toString('minimal')))
                } else if (stats.hash && (this._lastHash === null || this._lastHash !== stats.hash)) {
                    this._lastHash = stats.hash
                    if (stats.compilation.namedChunks.has('vendor')) {
                        const vendorHash = stats.compilation.namedChunks.get('vendor')!.hash
                        if (this._lastVendorChunkHash === null || this._lastVendorChunkHash !== vendorHash) {
                            this._lastVendorChunkHash = vendorHash
                            onChange(null, { hash: stats.hash, chuncks: { app: this._compiler.getOutput('app'), vendor: this._compiler.getOutput('vendor') } })
                            return
                        }
                    }
                    onChange(null, { hash: stats.hash, chuncks: { app: this._compiler.getOutput('app') } })
                }
            }
        ))
    }
}

class UnWatcher {
    private _compiler: Compiler
    private _watching: webpack.Compiler.Watching

    constructor(compiler: Compiler, watching: webpack.Compiler.Watching) {
        this._compiler = compiler
        this._watching = watching
    }

    unwatch(callback?: () => void) {
        this._watching.close(() => {
            this._compiler.clear()
            if (callback) {
                callback()
            }
        })
    }
}
