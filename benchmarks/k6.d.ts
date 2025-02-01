declare module 'k6/http' {
    export function post(url: string, payload: string, params?: object): any;
    export default { post };
}

declare module 'k6' {
    export function check(res: any, checks: object): boolean;
    export function sleep(seconds: number): void;
} 