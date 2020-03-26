import webpack from 'webpack'
import path from 'path'

export default (appDir: string, custom?: Pick<webpack.Configuration, 'mode' | 'target' | 'externals' | 'entry'>) => ({
    mode: custom?.mode || 'production',
    target: custom?.target || 'web',
    context: appDir,
    entry: custom?.entry,
    output: {
        path: '/dist/',
        filename: '[name].js',
        libraryTarget: 'umd'
    },
    module: {
        rules: [
            {
                test: /\.(js|ts)x?$/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        babelrc: false,
                        cacheDirectory: true,
                        presets: [
                            // [
                            //     '@babel/preset-env',
                            //     custom?.target === 'node' ? { targets: { node: 'current' } } : {
                            //         useBuiltIns: 'usage',
                            //         corejs: 3,
                            //         modules: false,
                            //         targets: '> 0.5%, last 2 versions, Firefox ESR, not dead'
                            //     }
                            // ],
                            '@babel/preset-typescript',
                            '@babel/preset-react'
                        ],
                        plugins: [
                            ['@babel/plugin-transform-runtime', { 'regenerator': true }],
                            ['@babel/plugin-proposal-class-properties', { loose: true }],
                            '@babel/plugin-proposal-optional-chaining',
                            '@babel/plugin-proposal-nullish-coalescing-operator'
                        ]
                    }
                }
            },
            {
                test: /\.(less|css)$/i,
                use: [
                    {
                        loader: 'style-loader',
                        options: {
                            attrs: {
                                class: 'post-style'
                            }
                        }
                    },
                    'css-loader',
                    'less-loader'
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
    externals: custom?.externals,
    optimization: {
        splitChunks: custom?.target === 'node' ? undefined : {
            cacheGroups: {
                vendor: {
                    test: /[\\/](node_modules|packages[\\/]postjs-core)[\\/]/,
                    name: 'vendor',
                    chunks: 'all'
                }
            }
        }
    },
    devtool: false
} as webpack.Configuration)
