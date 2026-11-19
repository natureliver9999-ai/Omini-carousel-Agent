/**
 * MUST be imported before anything else.
 *
 * Under stdio transport, stdout is the JSON-RPC channel. A single stray
 * `console.log()` — ours or a dependency's — corrupts the session and the host
 * silently drops the server. So stdout is re-pointed at stderr here, and only
 * the MCP transport itself writes to the real stdout file descriptor.
 */
const realStdoutWrite = process.stdout.write.bind(process.stdout);

export const realStdout = {
  write: (chunk: string | Uint8Array): void => {
    realStdoutWrite(chunk as never);
  },
};

if (!process.env.OMNI_ALLOW_STDOUT) {
  console.log = (...args: unknown[]) => console.error(...args);
  console.info = (...args: unknown[]) => console.error(...args);
  console.debug = (...args: unknown[]) => console.error(...args);
  process.stdout.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
    // Allow the transport's own frames through untouched.
    if (typeof chunk === 'string' && (chunk.startsWith('{') || chunk.startsWith('event:') || chunk.startsWith('id:'))) {
      return realStdoutWrite(chunk as never, ...(rest as []));
    }
    return process.stderr.write(chunk as never, ...(rest as []));
  }) as typeof process.stdout.write;
}
