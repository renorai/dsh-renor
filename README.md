# dsh-renor

A DeepSeek Harness (DSH) plugin that connects DSH to [Renor](https://renor.cloud), a hosted memory service for AI agents. It adds one row to your DSH profile: the `@deepseek-ai/dsh-mcp-client` plugin pointed at `https://mcp.renor.cloud/mcp` (MCP, Streamable HTTP).

It contains no code of its own. It is a configuration file (`cordis.patch.yml`) and this README.

## What you get

After DSH starts, the tools Renor serves appear as `mcp__renor__<tool>`, for example `mcp__renor__get_context` (read what Renor remembers that matches a request) and `mcp__renor__remember` (save a statement). The list comes from the server at connect time; see the [tool reference](https://renor.mintlify.app/tools) for the current set. Each tool's description and schema is sent to the model on every request, so the full set adds roughly 10,000 tokens to each request (figure from the tool reference).

The model uses memory when it chooses to call these tools. Nothing here saves or recalls memory automatically.

## Install

1. Create a Renor account at <https://renor.cloud>.
2. In the dashboard at <https://app.renor.cloud>, open **API keys** and choose **Create key**. The key is shown once, works for 365 days, and can be revoked on the same page.
3. Put the key in the environment of the process that runs `dsh`:

   ```sh
   export RENOR_API_KEY="paste-your-key-here"
   ```

4. Install the plugin and restart DSH:

   ```sh
   dsh plugin --profile <name> add github:renorai/dsh-renor
   ```

5. Start a session and ask the agent to list its Renor tools, or ask it to call `get_context`.

To remove it, delete the `renor` row from your profile's `cordis.patch.yml` (or remove the plugin with `dsh plugin`) and restart DSH.

## Why an API key and not a browser sign-in

Renor also supports OAuth for MCP clients that implement it. The `@deepseek-ai/dsh-mcp-client` version checked when this was written (0.2.2-rc.1) has no OAuth option: its streamable-http config accepts a URL and static headers only. So this plugin sends your Renor API key as `Authorization: Bearer <key>`. The key is read from `RENOR_API_KEY` when DSH loads the profile; it is not written to `cordis.patch.yml`. If a later DSH release adds OAuth for MCP servers, this plugin should switch to it.

If `RENOR_API_KEY` is not set, the plugin sends an empty `Authorization` header. Renor answers 401, the Renor tools do not appear, an error is logged, and DSH still starts.

## What data goes where

- **To Renor** (`mcp.renor.cloud`): your API key, and whatever the model puts in tool arguments: search queries, and statements it saves with `remember`. Tool results come back into the conversation and so go to your DSH model provider like any other tool result.
- **Where Renor keeps it**: memory is stored on Google Cloud in `us-central1` (United States). To search by meaning, note text and queries are sent to Google Vertex AI in the same region. Renor's [security page](https://renor.cloud/security) describes this, retention, and what telemetry Renor collects and how to turn it off.
- **Not sent**: this plugin does not read your files or your session history and sends nothing by itself. Only tool calls the model makes reach Renor.
- **Your control**: you can export all memory as Markdown, delete memories, and revoke the key in the dashboard.

## Configuration

`cordis.patch.yml`:

```yaml
- insert:
    - id: renor
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: renor
        transport: streamable-http
        url: https://mcp.renor.cloud/mcp
        headers:
          Authorization: !!js "process.env.RENOR_API_KEY ? `Bearer ${process.env.RENOR_API_KEY}` : ''"
```

A patch replaces a row's whole `config`, so to change a field (for example `toolCallTimeoutMs`), copy the row into your own profile patch and edit it there. To use a self-hosted Renor HTTP server, change `url`.

## Tests

```sh
npm install
npm test
```

`test/patch.test.js` parses `cordis.patch.yml` and checks it against the documented `@deepseek-ai/dsh-mcp-client` streamable-http config (known fields only, valid `serverName`, no stdio fields), checks that `package.json` declares `dsh.bundle`, and evaluates the `Authorization` expression with and without a key set. DSH publishes no standalone schema file for patches, so this is a check against the package's documented fields, not against DSH itself. It makes no network calls.

Not yet tested: installing the plugin into a running DSH and connecting to the live server. Do that before relying on it.

## License

MIT. See [LICENSE](LICENSE).
