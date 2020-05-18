export interface APIRequest {
    readonly url: string
    readonly method: string
    readonly proto: string
    readonly protoMinor: number
    readonly protoMajor: number
    readonly headers: Headers
    readonly cookies: ReadonlyMap<string, string>
    readonly params: ReadonlyMap<string, string>
    readonly query: Record<string, string | string[]>
}

export interface APIResponse {
    status(code: number): this
    addHeader(key: string, value: string): this
    setHeader(key: string, value: string): this
    removeHeader(key: string): this
    send(data: string | Uint8Array | ArrayBuffer): void
    json(data: any): void
}

export interface APIHandle {
    (req: APIRequest, res: APIResponse): void
}
