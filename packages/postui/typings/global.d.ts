declare module 'webpack-virtual-modules' {
    import webpack from 'webpack'
    export default class IVirtualModulesPlugin extends webpack.Plugin {
        writeModule(filePath: string, contents: string): void
    }
}
