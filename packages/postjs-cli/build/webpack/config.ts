import path from 'path'
import webpack from 'webpack'
import './loaders/post-page-loader'

const useBuiltIns = 'usage'

export default (context: string, config?: Pick<webpack.Configuration, 'mode' | 'target' | 'entry' | 'plugins' | 'externals' | 'optimization' | 'devtool'>) => ({
    context: context,
    target: config?.target,
    mode: config?.mode,
    entry: config?.entry,
    output: {
        libraryTarget: config?.target === 'node' ? 'umd' : 'var',
        filename: '[name].js',
        path: '/'
    },
    module: {
        rules: [
            {
                test: /\.(js|mjs|ts)x?$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        babelrc: false,
                        cacheDirectory: true,
                        presets: [
                            ['@babel/preset-env', config?.target === 'node' ? { targets: { node: 'current' } } : {
                                useBuiltIns,
                                corejs: 3,
                                modules: 'commonjs', // fix Cannot assign to read only property 'exports' of object '#<Object>'
                                targets: '> 1%, last 2 versions, Firefox ESR, not ie <= 9'
                            }],
                            '@babel/preset-react',
                            ['@babel/preset-typescript', { allowNamespaces: true }]
                        ],
                        plugins: [
                            ['@babel/plugin-transform-runtime', {
                                corejs: false, // polyfills are injected by preset-env
                                regenerator: useBuiltIns !== 'usage',
                                helpers: useBuiltIns === 'usage'
                            }],
                            ['@babel/plugin-proposal-class-properties', { loose: true }],
                            '@babel/plugin-proposal-nullish-coalescing-operator',
                            '@babel/plugin-proposal-numeric-separator',
                            ['@babel/plugin-proposal-object-rest-spread', { useBuiltIns: true }],
                            '@babel/plugin-proposal-optional-chaining',
                            config?.mode !== 'development' && ['babel-plugin-transform-react-remove-prop-types', { removeImport: true }],
                            config?.target === 'node' && '@babel/plugin-syntax-bigint'
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
    plugins: config?.plugins,
    resolve: {
        extensions: ['.js', '.jsx', '.mjs', '.ts', '.tsx', '.json', '.wasm']
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
