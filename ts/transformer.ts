import { typescript as ts } from '../package.ts';

function transformImport(sf: ts.SourceFile, node: ts.Node): ts.VisitResult<ts.Node> | null {
    if (ts.isImportDeclaration(node)) {
        if (!ts.isStringLiteral(node.moduleSpecifier)) {
            return node;
        }

        let modulePath = node.moduleSpecifier.text
        if (/^https?:\/\//i.test(modulePath)) {
            modulePath = '/-/' + modulePath.replace(/^https?:\/\//i, '') + '.js'
        }

        return ts.updateImportDeclaration(
            node,
            node.decorators,
            node.modifiers,
            node.importClause,
            ts.createLiteral(modulePath)
        )
    }
    return null
}

// https://www.npmjs.com/package/babel-plugin-transform-react-jsx-source
function transformReactJsxSource(sf: ts.SourceFile, node: ts.Node): ts.VisitResult<ts.Node> | null {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const fileNameAttr = ts.createPropertyAssignment(
            'fileName',
            ts.createStringLiteral(sf.fileName)
        )
        const lineNumberAttr = ts.createPropertyAssignment(
            'lineNumber',
            ts.createNumericLiteral(`${sf.getLineAndCharacterOfPosition(node.pos).line + 1}`)
        )
        const sourceJsxAttr = ts.createJsxAttribute(
            ts.createIdentifier('__source'),
            ts.createJsxExpression(undefined, ts.createObjectLiteral([fileNameAttr, lineNumberAttr]))
        )
        const jsxAttributes = ts.createJsxAttributes([
            ...node.attributes.properties,
            sourceJsxAttr
        ])

        if (ts.isJsxSelfClosingElement(node)) {
            return ts.createJsxSelfClosingElement(
                node.tagName,
                node.typeArguments,
                jsxAttributes
            )
        } else if (ts.isJsxOpeningElement(node)) {
            return ts.createJsxOpeningElement(
                node.tagName,
                node.typeArguments,
                jsxAttributes
            )
        }
    }
    return null
}

export interface Transform {
    (sf: ts.SourceFile, node: ts.Node): ts.VisitResult<ts.Node> | null
}

export function CreateTransformer() {
    const transforms: Array<Transform> = [
        transformImport,
        transformReactJsxSource,
    ]
    function nodeVisitor(ctx: ts.TransformationContext, sf: ts.SourceFile) {
        const visitor: ts.Visitor = node => {
            for (const transform of transforms) {
                const ret = transform(sf, node)
                if (ret != null) {
                    return ret
                }
            }
            return ts.visitEachChild(node, visitor, ctx)
        }
        return visitor
    }

    const factory: ts.TransformerFactory<ts.SourceFile> = ctx => sf => ts.visitNode(sf, nodeVisitor(ctx, sf))
    return factory
}
