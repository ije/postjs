// @deno-types="../vendor/typescript/lib/typescript.d.ts"
import ts from '../vendor/typescript/lib/typescript.js'

export interface PlainTransform {
    (sf: ts.SourceFile, node: ts.Node, ...args: any[]): ts.VisitResult<ts.Node> | null
}

export function CreatePlainTransformer(transform: PlainTransform, ...args: any[]): ts.TransformerFactory<ts.SourceFile> {
    function nodeVisitor(ctx: ts.TransformationContext, sf: ts.SourceFile) {
        const visitor: ts.Visitor = node => {
            const ret = transform(sf, node, ...args)
            if (ret != null) {
                return ret
            }
            return ts.visitEachChild(node, visitor, ctx)
        }
        return visitor
    }

    return ctx => sf => ts.visitNode(sf, nodeVisitor(ctx, sf))
}

export function CreateTransformer(transform: (ctx: ts.TransformationContext, sf: ts.SourceFile) => ts.SourceFile): ts.TransformerFactory<ts.SourceFile> {
    return ctx => sf => transform(ctx, sf)
}
