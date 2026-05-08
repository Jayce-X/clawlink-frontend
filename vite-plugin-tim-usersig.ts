/**
 * Vite plugin: dev-only /dev-api/usersig endpoint.
 *
 * Generates TIM UserSig locally using `tls-sig-api-v2` (official Tencent package).
 * Reads TIM_SECRET_KEY from .env.
 *
 * Only active in dev mode — production builds don't include this.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TLSSigAPIv2 = require('tls-sig-api-v2');

const SDK_APP_ID = 1600132425;

export function timUserSigPlugin() {
  return {
    name: 'tim-usersig-dev',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    configureServer(server: any) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      server.middlewares.use('/dev-api/usersig', (req: any, res: any) => {
        if (req.method !== 'GET') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        const userID = url.searchParams.get('userID');
        if (!userID) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'userID is required' }));
          return;
        }

        const secretKey = process.env.TIM_SECRET_KEY;
        if (!secretKey) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'TIM_SECRET_KEY not configured in .env' }));
          return;
        }

        try {
          const api = new TLSSigAPIv2.Api(SDK_APP_ID, secretKey);
          const expire = 604800; // 7 days
          const userSig = api.genSig(userID, expire);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            sdkAppID: SDK_APP_ID,
            userID,
            userSig,
            expireIn: expire,
          }));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: msg }));
        }
      });
    },
  };
}
