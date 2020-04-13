import { App } from './app'

export default async (appDir: string) => {
    const app = new App(appDir)
    const { hash, warnings } = await app.build()

    if (warnings.length > 0) {
        warnings.forEach(msg => console.warn(msg))
    }
    console.log('done', hash)
}
