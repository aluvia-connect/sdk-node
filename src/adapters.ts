import { HttpsProxyAgent } from 'https-proxy-agent';

export type PlaywrightProxySettings = {
  server: string;
  username?: string;
  password?: string;
};

export type ProxyUrlOrPlaywright =
  | string
  | { server: string; username?: string; password?: string };

export function toPlaywrightProxySettings(input: ProxyUrlOrPlaywright): PlaywrightProxySettings {
  return typeof input === 'string' ? { server: input } : input;
}

function toHostOnlyProxyServer(input: ProxyUrlOrPlaywright): string {
  const server = typeof input === 'string' ? input : input.server;
  // Puppeteer/Selenium want host:port (or scheme://host:port) without embedding creds.
  return server;
}

export function toPuppeteerArgs(input: ProxyUrlOrPlaywright): Array<string> {
  return [`--proxy-server=${toHostOnlyProxyServer(input)}`];
}

export function toSeleniumArgs(input: ProxyUrlOrPlaywright): string {
  return `--proxy-server=${toHostOnlyProxyServer(input)}`;
}

export function createNodeProxyAgent(input: ProxyUrlOrPlaywright): HttpsProxyAgent<any> {
  if (typeof input === 'string') {
    return new HttpsProxyAgent(input);
  }

  const { server, username, password } = input;

  if (username && password) {
    const url = new URL(server);
    url.username = username;
    url.password = password;
    return new HttpsProxyAgent(url.toString());
  }

  return new HttpsProxyAgent(server);
}
