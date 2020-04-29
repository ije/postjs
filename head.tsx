import util from './util.ts'

const headElements = new Map<string, { type: string, props: any }>()

export default function Head({ children }: React.PropsWithChildren<{}>) {
    return null
}

export function renderToTags() {
    const tags: string[] = []
    headElements.forEach(({ type, props }) => {
        if (type === 'title') {
            if (util.isNEString(props.children)) {
                tags.push(`<title>${props.children}</title>`)
            } else if (util.isNEArray(props.children)) {
                tags.push(`<title>${props.children.join('')}</title>`)
            }
        } else {
            const attrs = Object.keys(props)
                .filter(key => key !== 'children')
                .map(key => ` ${key}=${JSON.stringify(props[key])}`)
                .join('')
            if (util.isNEString(props.children)) {
                tags.push(`<${type}${attrs}>${props.children}</${type}>`)
            } else if (util.isNEArray(props.children)) {
                tags.push(`<${type}${attrs}>${props.children.join('')}</${type}>`)
            } else {
                tags.push(`<${type}${attrs} />`)
            }
        }
    })
    headElements.clear()
    return tags
}
