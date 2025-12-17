import { HttpsProxyAgent } from 'https-proxy-agent';

export type PlaywrightProxySettings = {
  server: string;
};

export function toPlaywrightProxySettings(url: string): PlaywrightProxySettings {
  return { server: url };
}

export function toPuppeteerArgs(url: string): Array<string> {
  return [`--proxy-server=${url}`];
}

export function toSeleniumArgs(url: string): string {
  return `--proxy-server=${url}`;
}

export function createNodeProxyAgent(url: string): HttpsProxyAgent<any> {
  return new HttpsProxyAgent(url);
}


