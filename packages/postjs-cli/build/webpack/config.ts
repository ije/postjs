import webpack from 'webpack'
import path from 'path'
import './loaders/post-page-loader'

export default (context: string, config?: Pick<webpack.Configuration, 'mode' | 'target' | 'entry' | 'plugins' | 'externals' | 'optimization' | 'devtool'>) => ({
    context: context,
    target: config?.target || 'web',
    mode: config?.mode || 'production',
    entry: config?.entry,
    output: {
        libraryTarget: config?.target === 'node' ? 'umd' : 'var',
        filename: '[name].js',
        path: '/'
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
                            //     config?.target === 'node' ? { targets: { node: 'current' } } : {
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
                            ['@babel/plugin-transform-runtime', { regenerator: true }],
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
                            singleton: true
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
    plugins: config?.plugins,
    resolve: {
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.json', '.wasm']
    },
    resolveLoader: {
        alias: {
            'post-page-loader': path.join(__dirname, 'loaders/post-page-loader.js')
        },
        modules: [path.join(context, 'node_modules'), 'node_modules']
    },
    externals: config?.externals,
    optimization: config?.optimization,
    devtool: config?.devtool
} as webpack.Configuration)
