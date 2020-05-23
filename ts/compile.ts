// @deno-types="../vendor/typescript/typescript.d.ts"
import ts from '../vendor/typescript/typescript.js'
import { CreateTransformer, transformImportPathRewrite, transformReactJsxSource } from './transformer.ts'

export interface CompileOptions {
    mode?: 'development' | 'production'
    rewriteImportPath?: (importPath: string) => string
    transformers?: (ts.TransformerFactory<ts.SourceFile> | ts.CustomTransformerFactory)[]
}

export function compile(fileName: string, source: string, { mode, rewriteImportPath }: CompileOptions) {
    const transformers: ts.CustomTransformers = {
        before: [],
        after: []
    }
    if (mode === 'development') {
        transformers.before!.push(CreateTransformer(transformReactJsxSource))
    }
    if (rewriteImportPath) {
        transformers.after!.push(CreateTransformer(transformImportPathRewrite, rewriteImportPath))
    }

    return ts.transpileModule(source, {
        reportDiagnostics: true,
        fileName,
        compilerOptions: {
            target: ts.ScriptTarget.ES2015,
            module: ts.ModuleKind.ES2015,
            allowJs: true,
            jsx: ts.JsxEmit.React,
            experimentalDecorators: true,
            alwaysStrict: true,
            sourceMap: true,
        },
        transformers,
    })
}
