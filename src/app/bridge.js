// Publishes module bindings on window (live, through getters/setters) so that non-module scripts, the browser tests, and modules that
// load earlier can reach them by name. It is a stepping stone: every name removed from a module's "global" comment is real progress.
export function bridge(defs) {
  for (const [name, [get, set]] of Object.entries(defs)) {
    try { Object.defineProperty(window, name, { get, set, configurable: true, enumerable: false }); }
    catch (e) { console.warn('bridge: cannot publish', name, e); }
  }
}
