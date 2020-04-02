import path from 'path'
import TerserPlugin from 'terser-webpack-plugin'
import webpack from 'webpack'
import './loaders/post-page-loader'

export type Config = Pick<webpack.Configuration, 'externals' | 'plugins' | 'devtool'> & {
    isServer?: boolean
    isProduction?: boolean
    enableTerser?: boolean
    splitVendorChunk?: boolean
    babelPresetEnv?: {
        targets?: string | Record<string, any>
        useBuiltIns?: 'usage' | 'entry'
    }
}

export default function createConfig(context: string, entry: webpack.Entry, config?: Config): webpack.Configuration {
    const {
        externals,
        plugins,
        devtool,
        isServer,
        isProduction,
        enableTerser,
        splitVendorChunk,
        babelPresetEnv
    } = config || {}
    const {
        targets = '> 1%, last 2 versions, Firefox ESR',
        useBuiltIns = 'usage'
    } = babelPresetEnv || {}

    return {
        context,
        entry,
        target: isServer ? 'node' : 'web',
        mode: isProduction ? 'production' : 'development',
        output: {
            libraryTarget: isServer ? 'umd' : 'var',
            filename: '[name].js',
            path: '/'
        },
        module: {
            rules: [
                {
                    test: /\.(js|mjs|ts)x?$/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            babelrc: false,
                            cacheDirectory: true,
                            exclude: [/[\\/]@babel[\\/]runtime[\\/]/, /[\\/]core-js[\\/]/],
                            sourceType: 'unambiguous',
                            presets: [
                                ['@babel/preset-env', isServer ? { targets: { node: 'current' } } : {
                                    targets,
                                    useBuiltIns,
                                    corejs: 3,
                                    modules: false
                                }],
                                '@babel/preset-react',
                                ['@babel/preset-typescript', { allowNamespaces: true }]
                            ],
                            plugins: [
                                !isServer && ['@babel/plugin-transform-runtime', {
                                    corejs: false, // use preset-env
                                    regenerator: useBuiltIns !== 'usage',
                                    helpers: useBuiltIns === 'usage',
                                    version: '^7.8.4' // https://github.com/babel/babel/issues/9903
                                }],
                                ['@babel/plugin-proposal-class-properties', { loose: true }],
                                ['@babel/plugin-proposal-object-rest-spread', { useBuiltIns: true }],
                                '@babel/plugin-proposal-optional-chaining',
                                '@babel/plugin-proposal-nullish-coalescing-operator',
                                '@babel/plugin-proposal-numeric-separator',
                                isServer && '@babel/plugin-syntax-bigint',
                                !isProduction && ['babel-plugin-transform-react-remove-prop-types', { removeImport: true }]
                            ].filter(Boolean)
                        }
                    }
                },
                {
                    test: /\.(less|css)$/i,
                    use: [
                        'style-loader',
                        'css-loader',
                        'less-loader'
                    ]
                },
                {
                    test: /\.(sass|scss)$/i,
                    use: [
                        'style-loader',
                        'css-loader',
                        'sass-loader'
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
        plugins,
        resolve: {
            extensions: ['.js', '.jsx', '.mjs', '.ts', '.tsx', '.json', '.wasm']
        },
        resolveLoader: {
            alias: {
                'post-page-loader': path.join(__dirname, 'loaders/post-page-loader.js')
            },
            modules: [path.join(context, 'node_modules'), 'node_modules']
        },
        externals,
        optimization: {
            runtimeChunk: !isServer && { name: 'webpack-runtime' },
            splitChunks: splitVendorChunk && {
                cacheGroups: {
                    vendor: {
                        priority: 1,
                        test: /[\\/](node_modules|packages[\\/]postjs-core)[\\/]/,
                        name: 'vendor',
                        chunks: 'initial'
                    },
                    ployfills: {
                        priority: 2,
                        test: /[\\/]node_modules[\\/](@babel[\\/]runtime|core-js|regenerator-runtime|object-assign|whatwg-fetch)[\\/]/,
                        name: 'ployfills',
                        chunks: 'initial'
                    }
                }
            },
            minimize: enableTerser,
            minimizer: enableTerser ? [
                new TerserPlugin({
                    cache: true,
                    extractComments: false,
                    terserOptions: {
                        ecma: 2015,
                        compress: true,
                        safari10: true
                    }
                })
            ] : undefined
        },
        devtool
    }
}
