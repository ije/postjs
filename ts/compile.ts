import { typescript as ts } from '../deps.ts'
import { CreateTransformer, TransformOptions } from './transformer.ts'

export interface CompileOptions extends TransformOptions {
    transformers?: (ts.TransformerFactory<ts.SourceFile> | ts.CustomTransformerFactory)[]
}

export function compile(fileName: string, source: string, options: CompileOptions) {
    const { transformers = [], ...rest } = options
    return ts.transpileModule(source, {
        reportDiagnostics: true,
        fileName,
        compilerOptions: {
            target: ts.ScriptTarget.ES2015,
            module: ts.ModuleKind.ES2015,
            jsx: ts.JsxEmit.React,
            allowJs: true,
            experimentalDecorators: true,
            alwaysStrict: true,
            sourceMap: true,
        },
        transformers: {
            before: [CreateTransformer({ ...rest }), ...transformers]
        },
    })
}
