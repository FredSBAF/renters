declare module 'express-list-endpoints' {
    import { Express } from 'express';

    interface Endpoint {
        path: string;
        methods: string[];
        middleware: string[];
    }

    function listEndpoints(app: Express): Endpoint[];

    export default listEndpoints;
}
