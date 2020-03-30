import { ComponentType } from 'react';
import { URL } from './router';
interface AppProps {
    baseUrl: string;
    initialPage: {
        url: URL;
        staticProps: any;
        Component: ComponentType<any>;
    };
}
export declare function App({ baseUrl, initialPage }: AppProps): JSX.Element;
export {};
