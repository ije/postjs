import autoprefixer from 'autoprefixer'
import Cssnano from 'cssnano-simple'
import fs from 'fs-extra'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'
import path from 'path'
import postcss from 'postcss'
import { MinifyOptions } from 'terser'
import TerserPlugin from 'terser-webpack-plugin'
import webpack from 'webpack'
import './loaders/post-app-loader'
import './loaders/post-component-loader'
import './loaders/post-page-loader'
import './plugins/babel-plugin-post-module-resolver'

export type Config = Pick<webpack.Configuration, 'externals' | 'plugins'> & {
    isServer?: boolean
    isProduction?: boolean
    terserOptions?: MinifyOptions
    useSass?: boolean
    useStyledComponents?: boolean
    postcssPlugins?: postcss.AcceptedPlugin[]
    browserslist?: string | Record<string, any>
    polyfillsMode?: 'usage' | 'entry'
}

// https://webpack.js.org/configuration/
export default function createConfig(context: string, entry: webpack.Entry, config?: Config): webpack.Configuration {
    const {
        externals,
        plugins,
        isServer,
        isProduction,
        terserOptions,
        useSass,
        useStyledComponents,
        postcssPlugins,
        browserslist = '> 1%, last 2 versions, Firefox ESR',
        polyfillsMode = 'usage'
    } = config || {}
    const cssLoader: webpack.RuleSetUse = [
        isProduction || isServer ? MiniCssExtractPlugin.loader : 'style-loader',
        {
            loader: 'css-loader',
            options: {
                importLoaders: 1,
                sourceMap: true
            }
        },
        {
            loader: 'postcss-loader',
            options: {
                ident: 'postcss',
                plugins: ([
                    autoprefixer({ overrideBrowserslist: browserslist })
                ] as postcss.AcceptedPlugin[]).concat(
                    isProduction ? new Cssnano() : [],
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
            path: '/',
            publicPath: '/'
        },
        module: {
            rules: [
                {
                    test: /\.(jsx?|mjs|tsx?)$/,
                    use: [
                        {
                            loader: 'babel-loader',
                            options: {
                                babelrc: false,
                                cacheDirectory: true,
                                exclude: [/[\\/]@babel[\\/]runtime[\\/]/, /[\\/]core-js[\\/]/],
                                sourceType: 'unambiguous',
                                presets: [
                                    ['@babel/preset-env', isServer ? { targets: { node: 'current' } } : {
                                        targets: browserslist,
                                        useBuiltIns: polyfillsMode,
                                        corejs: 3,
                                        modules: false
                                    }],
                                    ['@babel/preset-react', { development: !isProduction }],
                                    ['@babel/preset-typescript', { allowNamespaces: true }]
                                ],
                                plugins: [
                                    [path.join(__dirname, 'plugins/babel-plugin-post-module-resolver'), {
                                        root: context,
                                        alias: (() => {
                                            const alias: Array<string> = []
                                            const items = fs.readdirSync(context)
                                            items.forEach(name => {
                                                const stat = fs.statSync(path.join(context, name))
                                                if (
                                                    stat.isDirectory() &&
                                                    !name.startsWith('.') &&
                                                    !(/^dist|node_modules$/.test(name)) &&
                                                    !fs.existsSync(path.join(context, 'node_modules', name))
                                                ) {
                                                    alias.push(name)
                                                }
                                            })
                                            return alias
                                        })()
                                    }],
                                    ['@babel/plugin-transform-runtime', {
                                        corejs: false, // use preset-env
                                        regenerator: polyfillsMode !== 'usage',
                                        helpers: polyfillsMode === 'usage'
                                    }],
                                    ['@babel/plugin-proposal-class-properties', { loose: true }],
                                    ['@babel/plugin-proposal-object-rest-spread', { useBuiltIns: true }],
                                    '@babel/plugin-proposal-optional-chaining',
                                    '@babel/plugin-proposal-nullish-coalescing-operator',
                                    '@babel/plugin-proposal-numeric-separator',
                                    isServer && '@babel/plugin-syntax-bigint',
                                    !isProduction && ['babel-plugin-transform-react-remove-prop-types', { removeImport: true }],
                                    useStyledComponents && ['babel-plugin-styled-components', { ssr: isServer }]
                                ].filter(Boolean)
                            }
                        }
                    ]
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
                useSass && {
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
            ].filter(Boolean) as webpack.RuleSetRule[]
        },
        plugins: (plugins || []).concat(isProduction || isServer ? new MiniCssExtractPlugin({
            filename: '[name].css',
            chunkFilename: '[name].css',
            ignoreOrder: true // remove order warnings
        }) : []),
        resolve: {
            extensions: ['.js', '.jsx', '.mjs', '.ts', '.tsx', '.json', '.wasm']
        },
        resolveLoader: {
            alias: [
                'post-app-loader',
                'post-component-loader',
                'post-page-loader'
            ].reduce((alias, name) => {
                alias[name] = path.join(__dirname, `loaders/${name}.js`)
                return alias
            }, {}),
            modules: [path.join(context, 'node_modules'), 'node_modules']
        },
        externals,
        optimization: {
            runtimeChunk: !isServer && { name: 'webpack-runtime' },
            splitChunks: !isServer && {
                cacheGroups: {
                    commons: {
                        name: 'commons',
                        minChunks: 2,
                        chunks: 'initial',
                        priority: 1
                    },
                    vendor: {
                        name: 'vendor',
                        test: /[\\/](node_modules|packages[\\/]postjs-core)[\\/]/,
                        chunks: 'initial',
                        priority: 2
                    },
                    ployfills: {
                        name: 'ployfills',
                        test: /[\\/]node_modules[\\/](@babel[\\/]runtime|core-js|regenerator-runtime|whatwg-fetch)[\\/]/,
                        chunks: 'initial',
                        priority: 3
                    }
                }
            },
            minimize: isProduction,
            minimizer: isProduction ? [
                new TerserPlugin({
                    cache: true,
                    extractComments: false,
                    terserOptions: {
                        compress: true,
                        safari10: true,
                        ...terserOptions
                    }
                })
            ] : undefined
        },
        performance: {
            maxEntrypointSize: 1 << 20, // 1mb
            maxAssetSize: 1 << 20
        },
        devtool: !isProduction && !isServer ? 'inline-source-map' : false
    }
}
