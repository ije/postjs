// @deno-types="../vendor/typescript/lib/typescript.d.ts"
import ts from '../vendor/typescript/lib/typescript.js';

interface IHookCall {
    expression: ts.Identifier | ts.PropertyAccessExpression
    name: string
    key: string
}

const refreshReg = '$RefreshReg$'
const refreshSig = '$RefreshSig$'

/**
 * TypeScript AST Transformer for react refresh.
 * @ref https://github.com/facebook/react/issues/16604#issuecomment-528663101
 * @ref https://github.com/facebook/react/blob/master/packages/react-refresh/src/ReactFreshBabelPlugin.js
 */
export default function transformReactRefresh(_ctx: ts.TransformationContext, sf: ts.SourceFile): ts.SourceFile {
    const ctx = new TransformContext(sf)
    return sf
}

function isComponentishName(name: string) {
    const c = name.charAt(0)
    return c >= 'A' && c <= 'Z'
}

function isHookName(name: string) {
    let c: string
    return name.startsWith('use') && (c = name.charAt(3)) && c >= 'A' && c <= 'Z'
}

function isBuiltinHook(hookName: string) {
    switch (hookName) {
        case 'useState':
        case 'React.useState':
        case 'useReducer':
        case 'React.useReducer':
        case 'useEffect':
        case 'React.useEffect':
        case 'useLayoutEffect':
        case 'React.useLayoutEffect':
        case 'useMemo':
        case 'React.useMemo':
        case 'useCallback':
        case 'React.useCallback':
        case 'useRef':
        case 'React.useRef':
        case 'useContext':
        case 'React.useContext':
        case 'useImperativeMethods':
        case 'React.useImperativeMethods':
        case 'useDebugValue':
        case 'React.useDebugValue':
            return true;
        default:
            return false;
    }
}

function findInnerComponents(inferredName: string, node: ts.Node, callback: (inferredName: string, node: ts.Node) => void) {
    if (ts.isIdentifier(node)) {
        if (!isComponentishName(node.text)) {
            return false;
        }
        // export default hoc(Foo)
        // const X = hoc(Foo)
        callback(inferredName, node)
        return true
    } else if (ts.isFunctionDeclaration(node)) {
        // function Foo() {}
        // export function Foo() {}
        // export default function Foo() {}
        callback(inferredName, node.name!)
        return true
    } else if (ts.isFunctionExpression(node)) {
        // let Foo = function() {}
        // const Foo = hoc1(forwardRef(function renderFoo() {}))
        // export default memo(function() {})
        callback(inferredName, node)
        return true;
    } else if (ts.isArrowFunction(node)) {
        // skip `let Foo = () => () => {}`
        if (node.body.kind === ts.SyntaxKind.ArrowFunction) {
            return false
        }
        // let Foo = () => {}
        // export default hoc1(hoc2(() => {}))
        callback(inferredName, node)
        return true
    } else if (ts.isCallExpression(node)) {
        const args = node.arguments
        if (args.length === 0) {
            return false
        }
        const { expression } = node
        if (ts.isIdentifier(expression) || ts.isPropertyAccessExpression(expression)) {
            const innerName = inferredName + '$' + expression.getFullText();
            const foundInside = findInnerComponents(
                innerName,
                args[0], // firstArg
                callback,
            );
            if (!foundInside) {
                return false;
            }
            // const Foo = hoc1(hoc2(() => {}))
            // export default memo(React.forwardRef(function() {}))
            callback(inferredName, node);
            return true;
        }
    } else if (ts.isVariableDeclaration(node)) {
        const init = node.initializer;
        if (!init) {
            return false;
        }

        const name = node.name.getText()
        if (!isComponentishName(name)) {
            // Likely component definitions.
            return false;
        }

        if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
            // Likely component definitions.
        } else if (ts.isCallExpression(init)) {
            // Maybe a HOC.
            // Try to determine if this is some form of import.
            const { expression } = init;
            if (ts.isImportDeclaration(expression)) {
                return false
            } else if (ts.isIdentifier(expression)) {
                if (expression.text.indexOf('require') === 0) {
                    return false;
                } else if (expression.text.indexOf('import') === 0) {
                    return false;
                }
                // Neither require nor import. Might be a HOC.
                // Pass through.
            } else if (ts.isPropertyAccessExpression(expression)) {
                // Could be something like React.forwardRef(...)
                // Pass through.
            }
        } else if (ts.isTaggedTemplateExpression(init)) {
            // Maybe something like styled.div`...`
        } else {
            return false
        }

        const initPath = path.get('init');
        const foundInside = findInnerComponents(
            inferredName,
            initPath,
            callback,
        );
        if (foundInside) {
            return true;
        }
        // See if this identifier is used in JSX. Then it's a component.
        const binding = path.scope.getBinding(name);
        if (binding === undefined) {
            return;
        }
        let isLikelyUsedAsType = false;
        const referencePaths = binding.referencePaths;
        for (let i = 0; i < referencePaths.length; i++) {
            const ref = referencePaths[i];
            if (
                ref.node &&
                ref.node.type !== 'JSXIdentifier' &&
                ref.node.type !== 'Identifier'
            ) {
                continue;
            }
            const refParent = ref.parent;
            if (refParent.type === 'JSXOpeningElement') {
                isLikelyUsedAsType = true;
            } else if (refParent.type === 'CallExpression') {
                const callee = refParent.callee;
                let fnName;
                switch (callee.type) {
                    case 'Identifier':
                        fnName = callee.name;
                        break;
                    case 'MemberExpression':
                        fnName = callee.property.name;
                        break;
                }
                switch (fnName) {
                    case 'createElement':
                    case 'jsx':
                    case 'jsxDEV':
                    case 'jsxs':
                        isLikelyUsedAsType = true;
                        break;
                }
            }
            if (isLikelyUsedAsType) {
                // const X = ... + later <X />
                callback(inferredName, init, initPath);
                return true;
            }
        }
        return false
    }
}

function traverse(node: ts.Node, callback: (node: ts.Node) => void) {
    callback(node)
    ts.forEachChild(node, c => traverse(c, callback))
}

export class TransformContext {
    private _hookCalls: WeakMap<ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction, IHookCall[]>
    private _seenForRegistration: WeakSet<ts.Node>

    constructor(sf: ts.SourceFile) {
        this._hookCalls = new WeakMap()
        this._seenForRegistration = new WeakSet()
        this._traverse(sf)
    }

    hasRegistration(node: ts.Node) {
        return this._seenForRegistration.has(node)
    }

    addRegistration(node: ts.Node) {
        this._seenForRegistration.add(node)
    }

    private _traverse(sourceFile: ts.SourceFile) {
        traverse(sourceFile, node => {
            if (ts.isCallExpression(node)) {
                let name: string
                const { expression } = node
                if (ts.isIdentifier(expression)) {
                    name = expression.text
                } else if (ts.isPropertyAccessExpression(expression)) {
                    name = expression.name.text
                } else {
                    return
                }
                if (!isHookName(name)) {
                    return
                }

                let fnNode: ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | null = null
                let n = node.parent
                while (!ts.isSourceFile(n)) {
                    if (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n)) {
                        fnNode = n
                        break
                    }
                    n = n.parent
                }
                if (fnNode === null) {
                    return
                }

                if (!this._hookCalls.has(fnNode)) {
                    this._hookCalls.set(fnNode, [])
                }
                const hookCallsForFn = this._hookCalls.get(fnNode)
                let key = '';
                if (ts.isVariableDeclaration(node.parent)) {
                    // TODO: if there is no LHS, consider some other heuristic.
                    key = node.parent.name.getText();
                }

                // Some built-in Hooks reset on edits to arguments.
                const args = node.arguments;
                if (name === 'useState' && args.length > 0) {
                    // useState second argument is initial state.
                    key += '(' + args[0].getFullText() + ')';
                } else if (name === 'useReducer' && args.length > 1) {
                    // useReducer second argument is initial state.
                    key += '(' + args[1].getFullText() + ')';
                }

                hookCallsForFn!.push({
                    expression,
                    name,
                    key,
                });
            }
        })
    }

    getHookCallsSignature(functionNode: ts.FunctionDeclaration | ts.ArrowFunction) {
        const fnHookCalls = this._hookCalls.get(functionNode);
        if (fnHookCalls === undefined) {
            return null;
        }
        return {
            key: fnHookCalls.map(call => call.name + '{' + call.key + '}').join('\n'),
            customHooks: fnHookCalls
                .filter(call => !isBuiltinHook(call.name))
                .map(call => JSON.parse(JSON.stringify(call))),
        };
    }
}
