import { DEFAULT_APP_CONFIG, loadAppConfig, resolveAppConfig } from './app-config';

describe('resolveAppConfig', () => {
  it('usa los valores por defecto si el JSON no es un objeto', () => {
    expect(resolveAppConfig(null)).toEqual(DEFAULT_APP_CONFIG);
    expect(resolveAppConfig('texto')).toEqual(DEFAULT_APP_CONFIG);
  });

  it('acepta URLs válidas y quita la barra final', () => {
    expect(
      resolveAppConfig({ apiGoUrl: 'https://go.ejemplo.com/', apiNodeUrl: ' http://node:3000// ', healthPollMs: 5000 }),
    ).toEqual({ apiGoUrl: 'https://go.ejemplo.com', apiNodeUrl: 'http://node:3000', healthPollMs: 5000 });
  });

  it('ignora campos inválidos y conserva los por defecto', () => {
    const config = resolveAppConfig({ apiGoUrl: 'ftp://x', apiNodeUrl: 42, healthPollMs: 10 });
    expect(config).toEqual(DEFAULT_APP_CONFIG);
  });
});

describe('loadAppConfig', () => {
  const fetchReturning = (response: Partial<Response> | Error) =>
    (async () => {
      if (response instanceof Error) throw response;
      return response as Response;
    }) as unknown as typeof fetch;

  it('lee config.json cuando existe', async () => {
    const config = await loadAppConfig(fetchReturning({ ok: true, json: async () => ({ apiGoUrl: 'http://go:1' }) }));
    expect(config.apiGoUrl).toBe('http://go:1');
    expect(config.apiNodeUrl).toBe(DEFAULT_APP_CONFIG.apiNodeUrl);
  });

  it('usa los valores por defecto si config.json no existe (404)', async () => {
    expect(await loadAppConfig(fetchReturning({ ok: false }))).toEqual(DEFAULT_APP_CONFIG);
  });

  it('usa los valores por defecto ante un error de red o JSON inválido', async () => {
    expect(await loadAppConfig(fetchReturning(new Error('offline')))).toEqual(DEFAULT_APP_CONFIG);
    const badJson = fetchReturning({ ok: true, json: async () => Promise.reject(new SyntaxError('x')) });
    expect(await loadAppConfig(badJson)).toEqual(DEFAULT_APP_CONFIG);
  });
});
