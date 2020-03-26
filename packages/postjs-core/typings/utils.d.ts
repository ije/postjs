declare const _default: {
    isNumber(a: any): a is number;
    isUNumber(a: any): a is number;
    isInt(a: any): a is number;
    isUInt(a: any): a is number;
    isString(a: any): a is string;
    isNEString(a: any): a is string;
    isArray<T = any>(a: any): a is T[];
    isNEArray<T_1 = any>(a: any): a is T_1[];
    isObject(a: any): a is Object;
    isFunction(a: any): a is Function;
    each(a: any, stepCallback: (value: any, key: any) => boolean | void): void;
    trimPrefix(s: string, prefix: string): string;
    trimSuffix(s: string, suffix: string): string;
    cleanPath(path: string): string;
};
export default _default;
