import { HttpsProxyAgent } from 'https-proxy-agent';
import type { PlaywrightProxySettings } from './types.js';

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

export function createNodeProxyAgent(serverUrl: string): HttpsProxyAgent<any> {
  return new HttpsProxyAgent(serverUrl);
}
