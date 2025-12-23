import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { ProxyAgent as UndiciProxyAgent, fetch as undiciFetch } from 'undici';
import type { Dispatcher } from 'undici';
import type { Agent as NodeAgent } from 'node:http';
import type { PlaywrightProxySettings } from './types.js';

export type NodeProxyAgents = {
  http: NodeAgent;
  https: NodeAgent;
};

export type AxiosProxyConfig = {
  proxy: false;
  httpAgent: NodeAgent;
  httpsAgent: NodeAgent;
};

export type GotProxyOptions = {
  agent: {
    http: NodeAgent;
    https: NodeAgent;
  };
};

export function toPlaywrightProxySettings(serverUrl: string): PlaywrightProxySettings {
  return { server: serverUrl };
}

export function toPuppeteerArgs(serverUrl: string): Array<string> {
  // Puppeteer wants --proxy-server=<server> without embedding creds.
  return [`--proxy-server=${serverUrl}`];
}

export function toSeleniumArgs(serverUrl: string): string {
  // Selenium/Chromium wants --proxy-server=<server> without embedding creds.
  return `--proxy-server=${serverUrl}`;
}

export function createNodeProxyAgents(serverUrl: string): NodeProxyAgents {
  return {
    http: new HttpProxyAgent(serverUrl),
    https: new HttpsProxyAgent(serverUrl),
  };
}

export function toAxiosConfig(agents: NodeProxyAgents): AxiosProxyConfig {
  return {
    proxy: false,
    httpAgent: agents.http,
    httpsAgent: agents.https,
  };
}

export function toGotOptions(agents: NodeProxyAgents): GotProxyOptions {
  return { agent: { http: agents.http, https: agents.https } };
}

export function createUndiciDispatcher(serverUrl: string): Dispatcher {
  return new UndiciProxyAgent(serverUrl);
}

export function createUndiciFetch(dispatcher: Dispatcher): typeof fetch {
  return ((input: any, init?: any) => {
    const nextInit = init ? { ...init, dispatcher } : { dispatcher };
    return undiciFetch(input, nextInit);
  }) as any;
}


