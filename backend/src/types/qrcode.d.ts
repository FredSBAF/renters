declare module 'qrcode' {
  export function toDataURL(url: string): Promise<string>;
}
