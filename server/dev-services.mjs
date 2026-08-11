import { createServer } from 'node:net';

export async function inspectDevService({ host, port, url, matches, fetchImpl = fetch }) {
  const urls = Array.isArray(url) ? url : [url];
  const hosts = Array.isArray(host) ? host : [host];

  if (
    (
      await Promise.all(
        urls.map((candidateUrl) => isExpectedService({ url: candidateUrl, matches, fetchImpl })),
      )
    ).some(Boolean)
  ) {
    return 'running';
  }

  const availability = await Promise.all(
    hosts.map((candidateHost) => isPortAvailable({ host: candidateHost, port })),
  );
  return availability.every(Boolean) ? 'available' : 'conflict';
}

async function isExpectedService({ url, matches, fetchImpl }) {
  try {
    const response = await fetchImpl(url, {
      headers: { accept: 'text/html, application/json' },
      signal: AbortSignal.timeout(1_500),
    });
    const body = await response.text();
    return response.ok && matches(body, response);
  } catch {
    return false;
  }
}

function isPortAvailable({ host, port }) {
  return new Promise((resolve, reject) => {
    const probe = createServer();

    probe.once('error', (error) => {
      if (error?.code === 'EADDRINUSE' || error?.code === 'EACCES') {
        resolve(false);
        return;
      }
      reject(error);
    });

    probe.listen({ host, port, exclusive: true }, () => {
      probe.close((error) => {
        if (error) reject(error);
        else resolve(true);
      });
    });
  });
}
