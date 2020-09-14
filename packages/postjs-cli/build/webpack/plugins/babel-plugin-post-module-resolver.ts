import { PluginObj } from '@babel/core'

export default () => ({
    name: 'post-module-resolver',
    pre(file: any) {
        const { root } = this.opts
        const filename = String(file.opts.filename)
        if (filename.startsWith(root)) {
            this.currentRequest = filename.slice(root.length)
        }
    },
    visitor: {
        ImportDeclaration(path) {
            if (this.currentRequest && !this.currentRequest.startsWith('node_modules/')) {
                const moduleName = path.node.source.value.split('/')[0]
                if (this.opts.alias.includes(moduleName)) {
                    const depth = this.currentRequest.split('/').length - 1
                    path.node.source.value = '../'.repeat(depth) + path.node.source.value
                }
            }
        }
    },
    post() {
        this.currentRequest = ''
    }
}) as PluginObj<{
    opts: {
        root: string,
        alias: Array<string>
    },
    currentRequest: string
}>
