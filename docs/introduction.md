## Aluvia Client (Node.js)

Aluvia Client is a **local smart proxy** for AI agents and automation workloads. You run it on your machine, point your tool (Playwright, Puppeteer, Axios, fetch, curl, an agent runtime, etc.) at a **single local proxy address** (`127.0.0.1`), and the client routes **per request** traffic:

- **Direct to the destination**, or
- **Through Aluvia’s gateway**

That decision is based on **hostname routing rules** you generate and update, and those rules are **refreshed live** while the proxy runs, allowing for on the fly updates.

The Node.js package name is `@aluvia/aluvia-node`.

### Why developers love it

If you’ve ever had to thread proxy settings through multiple libraries, environments, and runtimes, Aluvia Client makes that problem go away. You configure your app/tool once (use the local proxy), then control routing centrally via Aluvia.

- **Selective proxying (only where it matters)**: Route a small set of domains through Aluvia while leaving everything else direct.
- **Faster, more reliable runs**: Direct traffic stays direct (less latency, fewer moving parts) while the sites you care about can use Aluvia.
- **Live rule changes without restarts**: Update routing rules in Aluvia and your running agent/browser picks them up automatically.
- **One stable integration point**: Your code keeps using the same local proxy URL; Aluvia Client handles updated credentials and routing logic in the background.
- **Local-only by default**: The proxy binds to `127.0.0.1`, so it’s only accessible from the machine running your workload.

### How it works (mental model)

- **Control plane**: fetches and refreshes your proxy credentials + hostname rules from the Aluvia API.
- **Data plane**: a local HTTP proxy that checks the current rules on every request and routes **direct vs via Aluvia**.

### When you’d use it

- **Browser automation** (Playwright / Puppeteer): proxy only the sites that need Aluvia, keep the rest direct.
- **HTTP clients** (Axios / fetch / curl): selectively proxy requests by hostname without rewriting networking code.
- **Agent runtimes**: set your runtime’s proxy to the session URL and treat routing as configuration (not code).