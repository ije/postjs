import { App } from './app'

export default async (appDir: string) => {
    const app = new App(appDir)
    const { hash } = await app.build()

    console.log('done', hash)
}
