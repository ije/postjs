import autoPrefixer from 'autoprefixer'
import CssnanoSimple from 'cssnano-simple'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'
import path from 'path'
import postcss from 'postcss'
import TerserPlugin from 'terser-webpack-plugin'
import webpack from 'webpack'
import './loaders/post-app-loader'
import './loaders/post-page-loader'

export type Config = Pick<webpack.Configuration, 'externals' | 'plugins'> & {
    isServer?: boolean
    isProduction?: boolean
    splitVendorChunk?: boolean
    terserPluginOptions?: TerserPlugin.TerserPluginOptions
    postcssPlugins?: postcss.AcceptedPlugin[]
    babelPresetEnv?: {
        targets?: string | Record<string, any>
        useBuiltIns?: 'usage' | 'entry'
    }
}

// https://webpack.js.org/configuration/
export default function createConfig(context: string, entry: webpack.Entry, config?: Config): webpack.Configuration {
    const {
        externals,
        plugins,
        isServer,
        isProduction,
        splitVendorChunk,
        terserPluginOptions,
        postcssPlugins,
        babelPresetEnv
    } = config || {}
    const {
        targets = '> 1%, last 2 versions, Firefox ESR',
        useBuiltIns = 'usage'
    } = babelPresetEnv || {}
    const cssLoader: webpack.RuleSetUse = [
        isProduction || isServer ? MiniCssExtractPlugin.loader : 'style-loader',
        {
            loader: 'css-loader',
            options: {
                // importLoaders: 1,
                sourceMap: true
            }
        },
        {
            loader: 'postcss-loader',
            options: {
                ident: 'postcss',
                plugins: ([
                    autoPrefixer({ overrideBrowserslist: targets })
                ] as postcss.AcceptedPlugin[]).concat(
                    isProduction ? [new CssnanoSimple()] : [],
                    postcssPlugins || []
                ),
                sourceMap: true
            }
        }
    ]

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
                    test: /\.(jsx?|mjs|tsx?)$/,
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
                                ['@babel/preset-react', { development: !isProduction }],
                                ['@babel/preset-typescript', { allowNamespaces: true }]
                            ],
                            plugins: [
                                !isServer && ['@babel/plugin-transform-runtime', {
                                    corejs: false, // use preset-env
                                    regenerator: useBuiltIns !== 'usage',
                                    helpers: useBuiltIns === 'usage'
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
                    use: cssLoader.concat([
                        {
                            loader: 'less-loader',
                            options: {
                                sourceMap: true
                            }
                        }
                    ])
                },
                {
                    test: /\.(sass|scss)$/i,
                    use: cssLoader.concat([
                        {
                            loader: 'sass-loader',
                            options: {
                                sourceMap: true
                            }
                        }
                    ])
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
        plugins: (isProduction || isServer ? [
            new MiniCssExtractPlugin({
                filename: '[name].css',
                chunkFilename: '[name].css',
                ignoreOrder: true // remove order warnings
            })
        ] : []).concat(plugins || []),
        resolve: {
            extensions: ['.js', '.jsx', '.mjs', '.ts', '.tsx', '.json', '.wasm']
        },
        resolveLoader: {
            alias: {
                'post-app-loader': path.join(__dirname, 'loaders/post-app-loader.js'),
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
                        test: /[\\/]node_modules[\\/](@babel[\\/]runtime|core-js|regenerator-runtime|whatwg-fetch)[\\/]/,
                        name: 'ployfills',
                        chunks: 'initial'
                    }
                }
            },
            minimize: isProduction,
            minimizer: isProduction ? [
                new TerserPlugin(terserPluginOptions || {
                    cache: true,
                    extractComments: false,
                    terserOptions: {
                        safari10: true
                    }
                })
            ] : undefined
        },
        performance: {
            maxEntrypointSize: 1 << 20, // 1mb
            maxAssetSize: 1 << 20
        },
        devtool: !isProduction ? 'eval-source-map' : false
    }
}
