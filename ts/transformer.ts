// @deno-types="../vendor/typescript/typescript.d.ts"
import ts from '../vendor/typescript/typescript.js'

export interface TSTransform {
    (sf: ts.SourceFile, node: ts.Node, ...args: any[]): ts.VisitResult<ts.Node> | null
}

export function CreateTransformer(transform: TSTransform, ...args: any[]): ts.TransformerFactory<ts.SourceFile> {
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
