declare module 'webpack-virtual-modules' {
    import webpack from 'webpack';
    export default class IVirtualModulesPlugin extends webpack.Plugin {
        constructor(modules?: Record<string, string>)
        writeModule(filePath: string, contents: string): void
    }
}
